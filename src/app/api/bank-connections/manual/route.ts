import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bankName, nickname, accountType, isCreditCard } = await request.json();
  if (!bankName) return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });

  const connection = await prisma.bankConnection.create({
    data: {
      pluggyItemId: `manual_${user.id}_${Date.now()}`,
      bankName,
      nickname: nickname?.trim() || null,
      accountType: accountType ?? "PERSONAL",
      isCreditCard: isCreditCard ?? false,
      isManual: true,
      status: "ACTIVE",
      userId: user.id,
    },
  });

  return NextResponse.json({ connection });
}
