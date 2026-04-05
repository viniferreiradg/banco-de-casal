import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/invite/accept — aceita o convite e vincula o casal
export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invite = await prisma.coupleInvite.findUnique({
    where: { token },
    include: { couple: { include: { members: true } } },
  });

  if (!invite || invite.status !== "PENDING" || invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "Convite inválido ou expirado" }, { status: 400 });
  }

  if (invite.senderId === user.id) {
    return NextResponse.json({ error: "Você não pode aceitar seu próprio convite" }, { status: 400 });
  }

  if (invite.couple.members.length >= 2) {
    return NextResponse.json({ error: "Este casal já está completo" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.coupleInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED" },
    }),
    prisma.couple.update({
      where: { id: invite.coupleId },
      data: { members: { connect: { id: user.id } } },
    }),
    prisma.user.update({
      where: { id: user.id },
      data: { coupleId: invite.coupleId, onboardingCompleted: true },
    }),
  ]);

  return NextResponse.json({ success: true, coupleId: invite.coupleId });
}
