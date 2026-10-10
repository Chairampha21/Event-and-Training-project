// Baht formatting and parsing shared by the budget fields and the dashboard.

/** 12345.5 -> "฿12,345.50"; whole amounts drop the decimals ("฿12,345"). */
export function formatBaht(n) {
  const v = Number(n) || 0;
  const whole = Math.abs(v % 1) < 0.005;
  return `฿${v.toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parses what a user typed into a money field ("12,500", " 800.50 ").
 * Returns null for an empty field and NaN for anything that isn't a valid
 * non-negative amount — so callers can tell "not set" from "typed wrong".
 * A lone dash also means "not set": that is how the department's budget
 * sheets mark a source with no money ("-"), so people type it out of habit.
 */
export function parseMoney(text) {
  const s = String(text ?? '').replace(/[,\s฿]/g, '');
  if (s === '' || /^[-–—]$/.test(s)) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return NaN;
  return Number(s);
}
