/**
 * Locale-aware formatting utilities.
 *
 * When `locale` is omitted the browser's current language is used,
 * which aligns with the i18next language setting.
 */

export function formatDate(
  date: string | Date | null | undefined,
  locale?: string,
): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale ?? navigator.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(
  date: string | Date | null | undefined,
  locale?: string,
): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat(locale ?? navigator.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatCurrency(
  amount: number,
  currency = "USD",
  locale?: string,
): string {
  return new Intl.NumberFormat(locale ?? navigator.language, {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatNumber(value: number, locale?: string): string {
  return new Intl.NumberFormat(locale ?? navigator.language).format(value);
}
