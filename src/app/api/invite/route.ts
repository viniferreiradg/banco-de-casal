import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/invite — cria um link de convite para o parceiro
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let couple = dbUser.coupleId
    ? await prisma.couple.findUnique({ where: { id: dbUser.coupleId } })
    : null;

  if (!couple) {
    couple = await prisma.couple.create({
      data: { members: { connect: { id: dbUser.id } } },
    });
    await prisma.user.update({
      where: { id: dbUser.id },
      data: { coupleId: couple.id },
    });
  }

  // Invalidate any existing pending invites
  await prisma.coupleInvite.updateMany({
    where: { coupleId: couple.id, status: "PENDING" },
    data: { status: "EXPIRED" },
  });

  const invite = await prisma.coupleInvite.create({
    data: {
      coupleId: couple.id,
      senderId: dbUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/convite/${invite.token}`;
  return NextResponse.json({ inviteUrl, token: invite.token });
}

// GET /api/invite/[token] — verifica um convite
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });

  const invite = await prisma.coupleInvite.findUnique({
    where: { token },
    include: { sender: { select: { name: true, email: true } } },
  });

  if (!invite) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  if (invite.status !== "PENDING") return NextResponse.json({ error: "Convite já usado ou expirado" }, { status: 400 });
  if (invite.expiresAt < new Date()) {
    await prisma.coupleInvite.update({ where: { id: invite.id }, data: { status: "EXPIRED" } });
    return NextResponse.json({ error: "Convite expirado" }, { status: 400 });
  }

  return NextResponse.json({
    senderName: invite.sender.name,
    senderEmail: invite.sender.email,
    token: invite.token,
  });
}
