import { Decimal } from "decimal.js";
import type { SplitRule, AccountType, SplitMatchField } from "@/generated/prisma/client";

export interface TransactionInput {
  description: string;
  category: string | null;
  amount: Decimal;
  accountType: AccountType;
}

export interface SplitResult {
  pctUser1: Decimal;
  pctUser2: Decimal;
  amountUser1: Decimal;
  amountUser2: Decimal;
  appliedRuleId: string | null;
}

const HUNDRED = new Decimal(100);

export function applySplitRules(
  transaction: TransactionInput,
  rules: SplitRule[]
): SplitResult {
  // Sort by priority descending (higher priority wins)
  const sorted = [...rules]
    .filter((r) => r.isActive)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sorted) {
    if (matchesRule(transaction, rule)) {
      return computeSplit(transaction.amount, rule.pctUser1, rule.pctUser2, rule.id);
    }
  }

  // Default: shared account → 50/50, personal → 100/0
  const defaultPct1 = transaction.accountType === "SHARED"
    ? new Decimal(50)
    : new Decimal(100);
  const defaultPct2 = new Decimal(100).minus(defaultPct1);

  return computeSplit(transaction.amount, defaultPct1, defaultPct2, null);
}

function matchesRule(tx: TransactionInput, rule: SplitRule): boolean {
  const field = rule.matchField as SplitMatchField;
  const value = rule.matchValue.toLowerCase();

  switch (field) {
    case "CATEGORY":
      return tx.category?.toLowerCase() === value;

    case "DESCRIPTION":
      return tx.description.toLowerCase().includes(value);

    case "ACCOUNT_TYPE":
      return tx.accountType.toLowerCase() === value.toLowerCase();

    default:
      return false;
  }
}

function computeSplit(
  amount: Decimal,
  pctUser1: Decimal,
  pctUser2: Decimal,
  appliedRuleId: string | null
): SplitResult {
  const amountUser1 = amount.mul(pctUser1).div(HUNDRED).toDecimalPlaces(2);
  const amountUser2 = amount.minus(amountUser1);

  return {
    pctUser1,
    pctUser2,
    amountUser1,
    amountUser2,
    appliedRuleId,
  };
}
