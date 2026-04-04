import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { email, password, name } = await request.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "Campos obrigatórios ausentes" }, { status: 400 });
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 400 });
  }

  try {
    await prisma.user.upsert({
      where: { id: data.user.id },
      update: { name, email },
      create: { id: data.user.id, email, name },
    });
  } catch (dbError) {
    console.error("Prisma error:", dbError);
    return NextResponse.json({ error: "Erro ao salvar usuário no banco" }, { status: 500 });
  }

  return NextResponse.json({ user: data.user }, { status: 201 });
}
