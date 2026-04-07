import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { syncBankConnection } from "@/app/api/pluggy/webhook/route";

// POST /api/bank-connections/:id/sync — trigger manual sync for a specific connection
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const conn = await prisma.bankConnection.findUnique({
    where: { id },
    include: {
      user: {
        include: {
          couple: {
            include: {
              splitRules: { where: { isActive: true } },
              categoryRules: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!conn || conn.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (conn.isManual) {
    return NextResponse.json({ error: "Conta manual não suporta sync automático" }, { status: 400 });
  }

  const newTransactions = await syncBankConnection({
    id: conn.id,
    pluggyItemId: conn.pluggyItemId,
    accountType: conn.accountType as "SHARED" | "PERSONAL",
    isCreditCard: conn.isCreditCard,
    isManual: conn.isManual,
    user: {
      id: conn.userId,
      couple: conn.user.couple
        ? {
            user1Id: conn.user.couple.user1Id,
            closingDay: conn.user.couple.closingDay,
            splitRules: conn.user.couple.splitRules.map((r) => ({
              ...r,
              matchField: r.matchField as "CATEGORY" | "DESCRIPTION" | "ACCOUNT_TYPE",
            })),
            categoryRules: conn.user.couple.categoryRules,
          }
        : null,
    },
  });

  return NextResponse.json({ ok: true, newTransactions: newTransactions ?? 0 });
}
