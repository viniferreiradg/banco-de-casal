import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { format } from "date-fns";

// GET /api/transactions?month=YYYY-MM
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const month = request.nextUrl.searchParams.get("month") ?? format(new Date(), "yyyy-MM");

  let memberIds: string[] = [user.id];
  let isCurrentUserUser1 = true;
  if (dbUser?.coupleId) {
    const couple = await prisma.couple.findUnique({
      where: { id: dbUser.coupleId },
      include: { members: { select: { id: true } } },
    });
    memberIds = couple?.members.map((m) => m.id) ?? [user.id];
    if (couple?.user1Id) isCurrentUserUser1 = user.id === couple.user1Id;
  }

  // Credit card transactions: filter by billingMonth
  // Debit/PIX transactions (billingMonth is null): filter by date range
  const [year, mon] = month.split("-").map(Number);
  const from = new Date(year, mon - 1, 1);
  const to = new Date(year, mon, 0, 23, 59, 59);

  const transactions = await prisma.transaction.findMany({
    where: {
      ownerUserId: { in: memberIds },
      OR: [
        // Credit card: use billingMonth
        { isCreditCard: true, billingMonth: month },
        // Debit/PIX: use date range
        { isCreditCard: false, date: { gte: from, lte: to } },
      ],
    },
    include: {
      split: true,
      bankConnection: { select: { id: true, bankName: true, accountType: true, isCreditCard: true } },
      owner: { select: { id: true, name: true } },
    },
    orderBy: { date: "desc" },
  });

  return NextResponse.json({ transactions, currentUserId: user.id, isCurrentUserUser1 });
}
