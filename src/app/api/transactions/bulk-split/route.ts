import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

// PATCH /api/transactions/bulk-split
// Atualiza o split de todas as transações cujo description contenha matchValue
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const body = await request.json();
  const { matchValue, pctUser1: pctUser1Raw } = body as { matchValue: string; pctUser1: number };
  if (!matchValue || pctUser1Raw === undefined) {
    return NextResponse.json({ error: "matchValue e pctUser1 são obrigatórios" }, { status: 400 });
  }

  const pctUser1 = new Decimal(pctUser1Raw);
  const pctUser2 = new Decimal(100).minus(pctUser1);

  let memberIds: string[] = [user.id];
  if (dbUser?.coupleId) {
    const couple = await prisma.couple.findUnique({
      where: { id: dbUser.coupleId },
      select: { members: { select: { id: true } } },
    });
    memberIds = couple?.members.map((m) => m.id) ?? [user.id];
  }

  const transactions = await prisma.transaction.findMany({
    where: {
      ownerUserId: { in: memberIds },
      description: { contains: matchValue, mode: "insensitive" },
    },
    select: { id: true, amount: true },
  });

  for (const tx of transactions) {
    const amount = new Decimal(tx.amount.toString());
    const amountUser1 = amount.mul(pctUser1).div(100).toDecimalPlaces(2);
    const amountUser2 = amount.minus(amountUser1);
    await prisma.transactionSplit.upsert({
      where: { transactionId: tx.id },
      update: { pctUser1, pctUser2, amountUser1, amountUser2, isManualOverride: true, appliedRuleId: null },
      create: { transactionId: tx.id, pctUser1, pctUser2, amountUser1, amountUser2, isManualOverride: true },
    });
  }

  return NextResponse.json({ updated: transactions.length });
}
