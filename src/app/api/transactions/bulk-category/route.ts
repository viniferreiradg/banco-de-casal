import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// PATCH /api/transactions/bulk-category
// Atualiza a categoria de todas as transações cujo description contenha matchValue
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });

  const body = await request.json();
  const { matchValue, category } = body as { matchValue: string; category: string };
  if (!matchValue || !category) {
    return NextResponse.json({ error: "matchValue e category são obrigatórios" }, { status: 400 });
  }

  // Busca todos os membros do casal para atualizar transações de ambos
  let memberIds: string[] = [user.id];
  if (dbUser?.coupleId) {
    const couple = await prisma.couple.findUnique({
      where: { id: dbUser.coupleId },
      select: { members: { select: { id: true } } },
    });
    memberIds = couple?.members.map((m) => m.id) ?? [user.id];
  }

  const result = await prisma.transaction.updateMany({
    where: {
      ownerUserId: { in: memberIds },
      description: { contains: matchValue, mode: "insensitive" },
    },
    data: { category },
  });

  return NextResponse.json({ updated: result.count });
}
