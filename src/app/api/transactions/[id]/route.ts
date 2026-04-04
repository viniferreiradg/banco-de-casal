import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

// PATCH /api/transactions/[id] — override split for a transaction
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
    include: { bankConnection: true },
  });
  if (!transaction) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();

  // Update transaction fields
  const txUpdate: Record<string, unknown> = {};
  if (body.category !== undefined) txUpdate.category = body.category;
  if (body.notes !== undefined) txUpdate.notes = body.notes;
  if (body.customName !== undefined) txUpdate.customName = body.customName;
  if (body.isShared !== undefined) txUpdate.isShared = body.isShared;
  if (body.pendingReview !== undefined) txUpdate.pendingReview = body.pendingReview;

  // Update split if percentages provided
  if (body.pctUser1 !== undefined) {
    const pctUser1 = new Decimal(body.pctUser1);
    const pctUser2 = new Decimal(100).minus(pctUser1);
    const amountUser1 = transaction.amount.mul(pctUser1).div(100).toDecimalPlaces(2);
    const amountUser2 = transaction.amount.minus(amountUser1);

    await prisma.transactionSplit.upsert({
      where: { transactionId: id },
      update: {
        pctUser1,
        pctUser2,
        amountUser1,
        amountUser2,
        isManualOverride: true,
      },
      create: {
        transactionId: id,
        pctUser1,
        pctUser2,
        amountUser1,
        amountUser2,
        isManualOverride: true,
      },
    });
  }

  const updated = await prisma.transaction.update({
    where: { id },
    data: txUpdate,
    include: { split: true, bankConnection: { select: { bankName: true, accountType: true } } },
  });

  return NextResponse.json({ transaction: updated });
}

// DELETE /api/transactions/[id] — remove a transaction (used to discard pending review)
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
