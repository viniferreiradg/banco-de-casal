import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccounts, getTransactions } from "@/lib/pluggy";
import { applySplitRules } from "@/lib/split-engine";
import { resolveBillingMonth } from "@/lib/billing-month";
import { Decimal } from "decimal.js";

export async function POST(request: NextRequest) {
  const event = await request.json();

  if (event.event !== "item/updated" && event.event !== "item/created") {
    return NextResponse.json({ ok: true });
  }

  const itemId = event.itemId as string;
  if (!itemId) return NextResponse.json({ error: "Missing itemId" }, { status: 400 });

  const bankConnection = await prisma.bankConnection.findUnique({
    where: { pluggyItemId: itemId },
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

  if (!bankConnection) return NextResponse.json({ ok: true });

  await syncBankConnection(bankConnection);

  return NextResponse.json({ ok: true });
}

export async function syncBankConnection(bankConnection: {
  id: string;
  pluggyItemId: string;
  accountType: "SHARED" | "PERSONAL";
  isCreditCard?: boolean;
  user: {
    id: string;
    couple: {
      closingDay: number;
      splitRules: Array<{
        id: string;
        matchField: "CATEGORY" | "DESCRIPTION" | "ACCOUNT_TYPE";
        matchValue: string;
        pctUser1: Decimal;
        pctUser2: Decimal;
        priority: number;
        isActive: boolean;
      }>;
    } | null;
  };
}) {
  const accounts = await getAccounts(bankConnection.pluggyItemId);
  const rules = bankConnection.user.couple?.splitRules ?? [];
  const closingDay = bankConnection.user.couple?.closingDay ?? 5;
  const isCreditCard = bankConnection.isCreditCard ?? false;

  for (const account of accounts.results ?? []) {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      .toISOString()
      .slice(0, 10);

    const { results: pluggyTxs } = await getTransactions(account.id, from);

    for (const ptx of pluggyTxs) {
      const existing = await prisma.transaction.findUnique({
        where: { pluggyTxId: ptx.id },
      });
      if (existing) continue;

      const txDate = new Date(ptx.date);
      const amount = new Decimal(Math.abs(ptx.amount));
      const billingMonth = resolveBillingMonth(txDate, isCreditCard, closingDay);

      const split = applySplitRules(
        {
          description: ptx.description,
          category: ptx.category,
          amount,
          accountType: bankConnection.accountType as "SHARED" | "PERSONAL",
        },
        rules as Parameters<typeof applySplitRules>[1]
      );

      await prisma.transaction.create({
        data: {
          pluggyTxId: ptx.id,
          date: txDate,
          billingMonth,
          description: ptx.description,
          amount,
          category: ptx.category,
          isShared: bankConnection.accountType === "SHARED",
          isCreditCard,
          bankConnectionId: bankConnection.id,
          ownerUserId: bankConnection.user.id,
          split: {
            create: {
              pctUser1: split.pctUser1,
              pctUser2: split.pctUser2,
              amountUser1: split.amountUser1,
              amountUser2: split.amountUser2,
              appliedRuleId: split.appliedRuleId,
            },
          },
        },
      });
    }
  }

  await prisma.bankConnection.update({
    where: { id: bankConnection.id },
    data: { lastSyncAt: new Date() },
  });
}
