import { format, addMonths } from "date-fns";

/**
 * Determines which billing month a transaction belongs to.
 *
 * Credit card logic:
 *   - Purchases made in month X are paid (vencimento) in month X+1.
 *   - So the billing month is always the NEXT calendar month.
 *
 * Debit / PIX:
 *   - Always falls in the month of the transaction date.
 *
 * Examples:
 *   - 01/02 credit → March
 *   - 27/02 credit → March
 *   - 01/03 credit → April
 *   - 10/04 debit  → April
 */
export function resolveBillingMonth(
  date: Date,
  isCreditCard: boolean,
  closingDay: number
): string {
  if (!isCreditCard) {
    return format(date, "yyyy-MM");
  }

  // Credit card: the bill for purchases in month X is due (vencimento) in month X+1
  return format(addMonths(date, 1), "yyyy-MM");
}
