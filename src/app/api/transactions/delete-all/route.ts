import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month");
  const accountIds = searchParams.getAll("accountId");

  let where: Prisma.TransactionWhereInput = { ownerUserId: user.id };

  if (month) {
    const [y, m] = month.split("-").map(Number);
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59, 999);
    where = {
      ownerUserId: user.id,
      ...(accountIds.length > 0 && { bankConnectionId: { in: accountIds } }),
      OR: [
        { isCreditCard: true, billingMonth: month },
        { isCreditCard: false, date: { gte: from, lte: to } },
      ],
    };
  } else if (accountIds.length > 0) {
    where = { ownerUserId: user.id, bankConnectionId: { in: accountIds } };
  }

  const { count } = await prisma.transaction.deleteMany({ where });

  return NextResponse.json({ deleted: count });
}
