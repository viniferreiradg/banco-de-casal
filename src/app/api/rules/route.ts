import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOwnerAndUser1(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { couple: { include: { members: { select: { id: true, name: true } } } } },
  });
  const coupleId = user?.coupleId ?? null;
  let isUser1 = true;
  const myName = user?.name ?? null;
  let partnerName: string | null = null;

  if (user?.couple) {
    const couple = user.couple;
    if (couple.user1Id) isUser1 = userId === couple.user1Id;
    partnerName = couple.members.find((m) => m.id !== userId)?.name ?? null;
  }

  // user1Name = nome de quem é user1; user2Name = nome de quem é user2
  const user1Name = isUser1 ? myName : partnerName;
  const user2Name = isUser1 ? partnerName : myName;

  return { coupleId, userId, isUser1, user1Name, user2Name };
}

// GET /api/rules
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coupleId, userId, isUser1, user1Name, user2Name } = await getOwnerAndUser1(user.id);

  const rawRules = await prisma.splitRule.findMany({
    where: coupleId ? { coupleId } : { userId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    include: { user: { select: { id: true } } },
  });

  // Descobrir user1Id do casal para saber se o criador é user1 ou user2
  let coupleUser1Id: string | null = null;
  if (coupleId) {
    const couple = await prisma.couple.findUnique({ where: { id: coupleId } });
    coupleUser1Id = couple?.user1Id ?? null;
  }

  const rules = rawRules.map((rule) => ({
    ...rule,
    creatorIsUser1: coupleUser1Id
      ? rule.userId === coupleUser1Id
      : rule.userId === userId,
  }));

  return NextResponse.json({ rules, isCurrentUserUser1: isUser1, user1Name, user2Name });
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
      ...(coupleId ? { coupleId } : {}),
      userId, // sempre guardar quem criou
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
