import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// GET /api/couple/settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { couple: { include: { members: { select: { id: true, name: true, email: true } } } } },
  });

  if (!dbUser?.couple) return NextResponse.json({ error: "Sem casal vinculado" }, { status: 404 });

  return NextResponse.json({ couple: dbUser.couple });
}

// PATCH /api/couple/settings
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.coupleId) return NextResponse.json({ error: "Sem casal vinculado" }, { status: 404 });

  const { closingDay } = await request.json();

  if (closingDay !== undefined) {
    const day = Number(closingDay);
    if (isNaN(day) || day < 1 || day > 28) {
      return NextResponse.json({ error: "Dia de fechamento deve ser entre 1 e 28" }, { status: 400 });
    }
  }

  const couple = await prisma.couple.update({
    where: { id: dbUser.coupleId },
    data: { closingDay: closingDay !== undefined ? Number(closingDay) : undefined },
  });

  return NextResponse.json({ couple });
}
