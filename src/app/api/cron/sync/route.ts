import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBankConnection } from "@/app/api/pluggy/webhook/route";

// GET /api/cron/sync — called daily by Vercel Cron
export async function GET() {
  // Only sync automatic (non-manual) active connections
  const connections = await prisma.bankConnection.findMany({
    where: { status: "ACTIVE", isManual: false },
    include: {
      user: {
        include: {
          couple: {
            include: { splitRules: { where: { isActive: true } } },
          },
        },
      },
    },
  });

  const results = await Promise.allSettled(
    connections.map((conn) =>
      syncBankConnection({
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
              }
            : null,
        },
      })
    )
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  return NextResponse.json({ synced: connections.length - failed, failed });
}
