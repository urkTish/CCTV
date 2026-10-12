/** Money for the renovation screens and proposal: "1,234.50 SAR", or "—" when unpriced. */

import { formatMoney } from '../ui/format.ts';

export function money(n: number | null, currency: string): string {
  return n === null ? '—' : `${formatMoney(n)}${currency ? ` ${currency}` : ''}`;
}

/** Whole currency units for ranges and headline totals: "12,400 SAR". */
export function moneyRound(n: number, currency: string): string {
  return `${Math.round(n).toLocaleString('en-GB')}${currency ? ` ${currency}` : ''}`;
}
