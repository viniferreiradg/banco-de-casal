import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncBankConnection } from "@/app/api/pluggy/webhook/route";

// GET /api/cron/sync — called daily by Vercel Cron
export async function GET() {
  const connections = await prisma.bankConnection.findMany({
    where: { status: "ACTIVE" },
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
        user: {
          id: conn.userId,
          couple: conn.user.couple
            ? {
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
