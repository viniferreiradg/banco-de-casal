import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Buscar coupleId do usuário logado
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { coupleId: true },
  });

  // Se tem casal, buscar contas de todos os membros; senão só as próprias
  let memberIds: string[] = [user.id];
  if (dbUser?.coupleId) {
    const couple = await prisma.couple.findUnique({
      where: { id: dbUser.coupleId },
      include: { members: { select: { id: true } } },
    });
    if (couple) memberIds = couple.members.map((m) => m.id);
  }

  const connections = await prisma.bankConnection.findMany({
    where: { userId: { in: memberIds } },
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    include: {
      _count: { select: { transactions: true } },
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ connections, currentUserId: user.id });
}
