import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { deleteItem } from "@/lib/pluggy";

export async function DELETE(
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

  const txCount = await prisma.transaction.count({
    where: { bankConnectionId: id },
  });

  // Remove from Pluggy only for automatic connections
  if (!conn.isManual) {
    await deleteItem(conn.pluggyItemId).catch(() => null);
  }

  if (txCount === 0) {
    await prisma.bankConnection.delete({ where: { id } });
  } else {
    await prisma.bankConnection.update({
      where: { id },
      data: { status: "DISCONNECTED" },
    });
  }

  return NextResponse.json({ success: true });
}
