import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function getOwner(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return { coupleId: user?.coupleId ?? null, userId };
}

// GET /api/rules
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coupleId, userId } = await getOwner(user.id);

  const rules = await prisma.splitRule.findMany({
    where: coupleId ? { coupleId } : { userId },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ rules });
}

// POST /api/rules
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { coupleId, userId } = await getOwner(user.id);
  const { name, matchField, matchValue, pctUser1, priority } = await request.json();

  const rule = await prisma.splitRule.create({
    data: {
      ...(coupleId ? { coupleId } : { userId }),
      name,
      matchField,
      matchValue: matchValue.toLowerCase(),
      pctUser1,
      pctUser2: 100 - pctUser1,
      priority: priority ?? 0,
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
