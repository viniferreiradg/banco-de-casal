import { Decimal } from "decimal.js";
import type { SplitRule, AccountType, SplitMatchField } from "@/generated/prisma/client";

export interface TransactionInput {
  description: string;
  category: string | null;
  amount: Decimal;
  accountType: AccountType;
  ownerIsUser1?: boolean; // true = dono é user1 do casal; afeta o default de conta pessoal
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

  // Default: shared → 50/50; personal → 100% para quem é o dono
  let defaultPct1: Decimal;
  if (transaction.accountType === "SHARED") {
    defaultPct1 = new Decimal(50);
  } else {
    // Se ownerIsUser1 não for informado, assume que o dono é user1 (comportamento legado)
    defaultPct1 = transaction.ownerIsUser1 !== false ? new Decimal(100) : new Decimal(0);
  }
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

// Aplica regras de categoria: retorna a categoria da primeira regra que bater na descrição.
// matchValue pode conter múltiplos termos separados por vírgula — basta um deles bater.
export function applyCategoryRules(
  description: string,
  rules: { matchValue: string; category: string; isActive: boolean }[]
): string | null {
  const desc = description.toLowerCase();
  for (const rule of rules) {
    if (!rule.isActive) continue;
    const terms = rule.matchValue.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (terms.some((term) => desc.includes(term))) {
      return rule.category;
    }
  }
  return null;
}
