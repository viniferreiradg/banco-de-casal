import { format, addMonths } from "date-fns";

/**
 * Determines which billing month a transaction belongs to.
 *
 * Credit card logic:
 *   - If the transaction date is ON OR BEFORE the closing day → same month
 *   - If the transaction date is AFTER the closing day → next month
 *
 * Debit / PIX:
 *   - Always falls in the month of the transaction date
 *
 * Examples with closingDay = 5:
 *   - 15/03 credit → April   (15 > 5, so next month)
 *   - 02/04 credit → April   (2 <= 5, so same month)
 *   - 06/04 credit → May     (6 > 5, so next month)
 *   - 10/04 debit  → April   (always same month)
 */
export function resolveBillingMonth(
  date: Date,
  isCreditCard: boolean,
  closingDay: number
): string {
  if (!isCreditCard) {
    return format(date, "yyyy-MM");
  }

  const day = date.getDate();

  if (day <= closingDay) {
    return format(date, "yyyy-MM");
  } else {
    return format(addMonths(date, 1), "yyyy-MM");
  }
}
