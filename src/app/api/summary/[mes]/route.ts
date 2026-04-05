import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Decimal } from "decimal.js";

// GET /api/summary/[mes] — returns monthly summary (YYYY-MM)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ mes: string }> }
) {
  const { mes } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { couple: { include: { members: { select: { id: true, name: true } } } } },
  });
  if (!dbUser?.coupleId) return NextResponse.json({ error: "Sem casal vinculado" }, { status: 400 });

  const isUser1 = dbUser.couple?.user1Id ? user.id === dbUser.couple.user1Id : true;

  const [year, mon] = mes.split("-").map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 0, 23, 59, 59);

  const memberIds = dbUser.couple!.members.map((m) => m.id);

  const transactions = await prisma.transaction.findMany({
    where: {
      ownerUserId: { in: memberIds },
      date: { gte: from, lte: to },
      isShared: true,
    },
    include: { split: true },
  });

  let totalUser1 = new Decimal(0);
  let totalUser2 = new Decimal(0);

  for (const tx of transactions) {
    if (!tx.split) continue;
    // amountUser1 = sempre a parte do user1 do casal (fixo, independente de quem comprou)
    totalUser1 = totalUser1.plus(tx.split.amountUser1);
    totalUser2 = totalUser2.plus(tx.split.amountUser2);
  }

  // balance: quanto o usuário atual deve ou tem a receber
  // "currentUser" pode ser user1 ou user2 — totalUser1 é sempre do user1 do casal
  const myTotal = isUser1 ? totalUser1 : totalUser2;
  const paidByUser1 = transactions
    .filter((tx) => tx.ownerUserId === user.id)
    .reduce((sum, tx) => sum.plus(tx.amount), new Decimal(0));

  const balance = myTotal.minus(paidByUser1);

  // Upsert the summary
  const summary = await prisma.monthlySummary.upsert({
    where: { coupleId_month: { coupleId: dbUser.coupleId, month: mes } },
    update: { totalUser1, totalUser2, balance },
    create: {
      coupleId: dbUser.coupleId,
      month: mes,
      totalUser1,
      totalUser2,
      balance,
    },
  });

  const members = dbUser.couple!.members;
  const partner = members.find((m) => m.id !== user.id);

  return NextResponse.json({
    summary,
    user: { id: user.id, name: dbUser.name },
    partner: partner ?? null,
    transactionCount: transactions.length,
  });
}

// POST /api/summary/[mes]/settle — mark month as settled
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ mes: string }> }
) {
  const { mes } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.coupleId) return NextResponse.json({ error: "Sem casal vinculado" }, { status: 400 });

  const { note } = await request.json().catch(() => ({ note: "" }));

  const summary = await prisma.monthlySummary.update({
    where: { coupleId_month: { coupleId: dbUser.coupleId, month: mes } },
    data: { settledAt: new Date(), settledNote: note ?? "" },
  });

  return NextResponse.json({ summary });
}
