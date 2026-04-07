import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAccounts, getTransactions } from "@/lib/pluggy";
import { applySplitRules, applyCategoryRules } from "@/lib/split-engine";
import { PRIMARY_CATEGORY_RULES } from "@/lib/primary-rules";
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
            include: {
              splitRules: { where: { isActive: true } },
              categoryRules: { where: { isActive: true } },
            },
          },
        },
      },
    },
  });

  if (!bankConnection) return NextResponse.json({ ok: true });

  // Skip manual connections — they don't have real Pluggy items
  if (bankConnection.isManual) return NextResponse.json({ ok: true });

  await syncBankConnection(bankConnection);

  return NextResponse.json({ ok: true });
}

export async function syncBankConnection(bankConnection: {
  id: string;
  pluggyItemId: string;
  accountType: "SHARED" | "PERSONAL";
  isCreditCard?: boolean;
  isManual?: boolean;
  user: {
    id: string;
    couple: {
      user1Id: string | null;
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
      categoryRules: Array<{
        matchValue: string;
        category: string;
        isActive: boolean;
      }>;
    } | null;
  };
}): Promise<number> {
  // Skip manual connections — no Pluggy data to fetch
  if (bankConnection.isManual) return 0;

  const accounts = await getAccounts(bankConnection.pluggyItemId);
  const rules = bankConnection.user.couple?.splitRules ?? [];
  const categoryRules = bankConnection.user.couple?.categoryRules ?? [];
  const closingDay = bankConnection.user.couple?.closingDay ?? 5;
  const isCreditCard = bankConnection.isCreditCard ?? false;

  // Determine if the connection owner is user1 of the couple (affects personal account splits)
  const ownerIsUser1 = bankConnection.user.couple
    ? bankConnection.user.id === bankConnection.user.couple.user1Id
    : true;

  let newCount = 0;

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
          ownerIsUser1,
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
          category: applyCategoryRules(ptx.description, categoryRules) ?? applyCategoryRules(ptx.description, PRIMARY_CATEGORY_RULES) ?? ptx.category,
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

      newCount++;
    }
  }

  await prisma.bankConnection.update({
    where: { id: bankConnection.id },
    data: { lastSyncAt: new Date() },
  });

  return newCount;
}
