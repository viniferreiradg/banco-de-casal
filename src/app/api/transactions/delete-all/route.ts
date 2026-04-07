import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only delete transactions owned by the logged-in user
  const { count } = await prisma.transaction.deleteMany({
    where: { ownerUserId: user.id },
  });

  return NextResponse.json({ deleted: count });
}
