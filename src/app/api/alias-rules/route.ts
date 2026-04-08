import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { coupleId: true } });
  const coupleId = dbUser?.coupleId ?? null;

  const rules = await prisma.aliasRule.findMany({
    where: coupleId ? { coupleId } : { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { coupleId: true } });
  const coupleId = dbUser?.coupleId ?? null;

  const { name, matchValue, customName } = await request.json();
  if (!name || !matchValue || !customName) {
    return NextResponse.json({ error: "name, matchValue e customName são obrigatórios" }, { status: 400 });
  }

  const rule = await prisma.aliasRule.create({
    data: {
      ...(coupleId ? { coupleId } : {}),
      userId: user.id,
      name,
      matchValue: (Array.isArray(matchValue) ? matchValue.join(",") : matchValue).trim(),
      customName: customName.trim(),
    },
  });

  return NextResponse.json({ rule }, { status: 201 });
}
