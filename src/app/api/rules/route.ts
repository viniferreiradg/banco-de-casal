import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOwnerAndUser1(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { couple: { select: { id: true, user1Id: true } } },
  });
  const coupleId = user?.couple?.id ?? null;
  const user1Id = user?.couple?.user1Id ?? null;
  const isUser1 = user1Id ? userId === user1Id : true;
  return { coupleId, userId, isUser1 };
}

// GET /api/rules
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coupleId, userId, isUser1 } = await getOwnerAndUser1(user.id);

  const rules = await prisma.splitRule.findMany({
    where: coupleId ? { coupleId } : { userId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ rules, isCurrentUserUser1: isUser1 });
}

// POST /api/rules
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coupleId, userId, isUser1 } = await getOwnerAndUser1(user.id);
  const { name, matchField, matchValue, pctUser1: myPct, priority } = await request.json();

  // myPct = porcentagem do usuário logado. Converter para pctUser1 do casal (sempre = user1).
  const pctUser1 = isUser1 ? myPct : 100 - myPct;
  const pctUser2 = 100 - pctUser1;

  const rule = await prisma.splitRule.create({
    data: {
      ...(coupleId ? { coupleId } : { userId }),
      name,
      matchField,
      matchValue: matchValue.toLowerCase(),
      pctUser1,
      pctUser2,
      priority: priority ?? 0,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
