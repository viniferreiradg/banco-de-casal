import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { applySplitRules } from "@/lib/split-engine";
import { resolveBillingMonth } from "@/lib/billing-month";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { date, description, customName, amount, category, bankConnectionId, pctUser1, notes } = body;

  if (!date || !description || !amount || !bankConnectionId) {
    return NextResponse.json({ error: "Campos obrigatórios: date, description, amount, bankConnectionId" }, { status: 400 });
  }

  const bankConnection = await prisma.bankConnection.findUnique({
    where: { id: bankConnectionId },
    include: {
      user: {
        include: {
          couple: { include: { splitRules: { where: { isActive: true } } } },
        },
      },
    },
  });

  const user1Id = bankConnection?.user.couple?.user1Id ?? null;
  const ownerIsUser1 = user1Id ? user.id === user1Id : true;

  if (!bankConnection) {
    return NextResponse.json({ error: "Conta bancária não encontrada" }, { status: 404 });
  }
  // Conta pessoal: só o dono pode lançar. Conta compartilhada: qualquer membro do casal pode.
  const isOwner = bankConnection.userId === user.id;
  const isSharedAccount = bankConnection.accountType === "SHARED";
  if (!isOwner && !isSharedAccount) {
    return NextResponse.json({ error: "Sem permissão para lançar nesta conta" }, { status: 403 });
  }

  // Parse as local noon to avoid UTC offset shifting the date to the previous day
  const [y, mo, d] = (date as string).split("-").map(Number);
  const txDate = new Date(y, mo - 1, d, 12, 0, 0);
  const closingDay = bankConnection.user.couple?.closingDay ?? 5;
  const billingMonth = resolveBillingMonth(txDate, bankConnection.isCreditCard, closingDay);

  const decimalAmount = new Decimal(String(amount));
  const rules = bankConnection.user.couple?.splitRules ?? [];

  let split;
  if (pctUser1 !== undefined) {
    // pctUser1 enviado pela UI = "minha porcentagem". Converter para user1 do casal.
    const myPct = new Decimal(pctUser1);
    const p1 = ownerIsUser1 ? myPct : new Decimal(100).minus(myPct);
    const p2 = new Decimal(100).minus(p1);
    const a1 = decimalAmount.mul(p1).div(100).toDecimalPlaces(2);
    const a2 = decimalAmount.minus(a1);
    split = { pctUser1: p1, pctUser2: p2, amountUser1: a1, amountUser2: a2, isManualOverride: true, appliedRuleId: null };
  } else {
    const engineResult = applySplitRules(
      {
        description,
        category: category ?? null,
        amount: decimalAmount,
        accountType: bankConnection.accountType as "SHARED" | "PERSONAL",
        ownerIsUser1,
      },
      rules as Parameters<typeof applySplitRules>[1]
    );
    split = { ...engineResult, isManualOverride: false };
  }

  const transaction = await prisma.transaction.create({
    data: {
      date: txDate,
      billingMonth,
      description,
      customName: customName ?? null,
      amount: decimalAmount,
      category: category ?? null,
      notes: notes ?? null,
      isShared: bankConnection.accountType === "SHARED",
      isCreditCard: bankConnection.isCreditCard,
      bankConnectionId,
      ownerUserId: user.id,
      split: {
        create: {
          pctUser1: split.pctUser1,
          pctUser2: split.pctUser2,
          amountUser1: split.amountUser1,
          amountUser2: split.amountUser2,
          isManualOverride: split.isManualOverride,
          appliedRuleId: split.appliedRuleId ?? null,
        },
      },
    },
    include: {
      split: { include: { appliedRule: { select: { name: true } } } },
      bankConnection: { select: { id: true, bankName: true, accountType: true, isCreditCard: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ transaction }, { status: 201 });
}
