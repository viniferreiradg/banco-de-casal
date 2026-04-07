import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";
import { resolveBillingMonth } from "@/lib/billing-month";

// PATCH /api/transactions/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transaction = await prisma.transaction.findUnique({
    where: { id },
    include: {
      split: true,
      bankConnection: {
        include: {
          user: {
            include: { couple: { select: { user1Id: true, closingDay: true } } },
          },
        },
      },
    },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user1Id = transaction.bankConnection.user.couple?.user1Id ?? null;
  const currentUserIsUser1 = user1Id ? user.id === user1Id : true;

  const body = await request.json();

  // ── Scalar field updates ───────────────────────────────────
  const txUpdate: Record<string, unknown> = {};
  if (body.category !== undefined) txUpdate.category = body.category;
  if (body.notes !== undefined) txUpdate.notes = body.notes;
  if (body.customName !== undefined) txUpdate.customName = body.customName;
  if (body.isShared !== undefined) txUpdate.isShared = body.isShared;
  if (body.pendingReview !== undefined) txUpdate.pendingReview = body.pendingReview;
  if (body.description !== undefined) txUpdate.description = body.description;

  // ── Date update (recalculates billingMonth) ────────────────
  let resolvedDate = transaction.date;
  if (body.date !== undefined) {
    const [y, mo, d] = (body.date as string).split("-").map(Number);
    resolvedDate = new Date(y, mo - 1, d, 12, 0, 0);
    txUpdate.date = resolvedDate;
    const closingDay = transaction.bankConnection.user.couple?.closingDay ?? 5;
    txUpdate.billingMonth = resolveBillingMonth(resolvedDate, transaction.isCreditCard, closingDay);
  }

  // ── Bank connection update ─────────────────────────────────
  let resolvedBankConnectionId = transaction.bankConnectionId;
  if (body.bankConnectionId !== undefined && body.bankConnectionId !== transaction.bankConnectionId) {
    resolvedBankConnectionId = body.bankConnectionId;
    txUpdate.bankConnectionId = resolvedBankConnectionId;
    const newConn = await prisma.bankConnection.findUnique({ where: { id: resolvedBankConnectionId } });
    if (newConn) txUpdate.isShared = newConn.accountType === "SHARED";
  }

  // ── Amount update (recalculates split proportionally) ──────
  let resolvedAmount = transaction.amount;
  if (body.amount !== undefined) {
    resolvedAmount = new Decimal(String(body.amount));
    txUpdate.amount = resolvedAmount;
  }

  // ── Split update ───────────────────────────────────────────
  // Recalculate whenever pctUser1 is provided OR amount changed (keeping existing pct)
  const shouldRecalcSplit = body.pctUser1 !== undefined || body.amount !== undefined;
  if (shouldRecalcSplit) {
    let pctUser1: Decimal;
    if (body.pctUser1 !== undefined) {
      const myPct = new Decimal(body.pctUser1);
      pctUser1 = currentUserIsUser1 ? myPct : new Decimal(100).minus(myPct);
    } else {
      // Keep existing pct, just recalculate amounts with new value
      pctUser1 = transaction.split?.pctUser1 ?? new Decimal(100);
    }
    const pctUser2 = new Decimal(100).minus(pctUser1);
    const amountUser1 = resolvedAmount.mul(pctUser1).div(100).toDecimalPlaces(2);
    const amountUser2 = resolvedAmount.minus(amountUser1);

    await prisma.transactionSplit.upsert({
      where: { transactionId: id },
      update: { pctUser1, pctUser2, amountUser1, amountUser2, isManualOverride: body.pctUser1 !== undefined },
      create: { transactionId: id, pctUser1, pctUser2, amountUser1, amountUser2, isManualOverride: body.pctUser1 !== undefined },
    });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: txUpdate,
    include: {
      split: { include: { appliedRule: { select: { name: true } } } },
      bankConnection: { select: { id: true, bankName: true, accountType: true, isCreditCard: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ transaction: updated });
}

// DELETE /api/transactions/[id] — remove a transaction
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const transaction = await prisma.transaction.findUnique({ where: { id } });
  if (!transaction || transaction.ownerUserId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.transaction.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
