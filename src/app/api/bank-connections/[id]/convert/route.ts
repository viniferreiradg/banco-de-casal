import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

// POST /api/bank-connections/:id/convert — mark manual transactions as pending review
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.bankConnection.findUnique({ where: { id } });
  if (!conn || conn.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Mark all manual transactions on this account as pending review
  const updated = await prisma.transaction.updateMany({
    where: { bankConnectionId: id },
    data: { pendingReview: true },
  });

  // Mark connection as no longer manual
  await prisma.bankConnection.update({
    where: { id },
    data: { isManual: false },
  });

  return NextResponse.json({ pendingCount: updated.count });
}
