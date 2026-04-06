import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, nickname } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  await prisma.user.update({
    where: { id: user.id },
    data: { name: name.trim(), ...(nickname !== undefined ? { nickname: nickname?.trim() || null } : {}) },
  });

  return NextResponse.json({ ok: true });
}
