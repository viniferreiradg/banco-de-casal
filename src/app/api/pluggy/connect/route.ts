import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getItem } from "@/lib/pluggy";

// POST /api/pluggy/connect — saves a new bank connection after widget completes
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { itemId, accountType, isCreditCard } = await request.json();
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });

  const item = await getItem(itemId);

  const connection = await prisma.bankConnection.upsert({
    where: { pluggyItemId: itemId },
    update: {
      status: "ACTIVE",
      bankName: item.connector?.name ?? "Banco",
      bankLogo: item.connector?.imageUrl ?? null,
      accountType: accountType ?? "PERSONAL",
      isCreditCard: isCreditCard ?? false,
    },
    create: {
      pluggyItemId: itemId,
      bankName: item.connector?.name ?? "Banco",
      bankLogo: item.connector?.imageUrl ?? null,
      accountType: accountType ?? "PERSONAL",
      isCreditCard: isCreditCard ?? false,
      userId: user.id,
    },
  });

  return NextResponse.json({ connection });
}
