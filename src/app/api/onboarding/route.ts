import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/onboarding — mark onboarding as complete
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { mode } = await request.json(); // "SOLO" | "COUPLE"

  if (mode === "SOLO" || mode === "COUPLE") {
    try {
      await prisma.user.upsert({
        where: { id: user.id },
        update: { onboardingCompleted: true },
        create: {
          id: user.id,
          email: user.email!,
          name: user.user_metadata?.name ?? user.email!,
          onboardingCompleted: true,
        },
      });
    } catch (e) {
      console.error("Onboarding DB error:", e);
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
    return NextResponse.json({ redirect: mode === "SOLO" ? "/dashboard" : "/perfil" });
  }

  return NextResponse.json({ error: "mode inválido" }, { status: 400 });
}
