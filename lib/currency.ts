/**
 * Precise Tunisian Dinar (TND) currency utilities.
 * Uses integer millimes (1 TND = 1000 millimes) to eliminate floating-point rounding drift.
 */

export const DEFAULT_CURRENCY = 'TND' as const;
export const DEFAULT_TIMEZONE = 'Africa/Tunis' as const;
export const TND_DECIMALS = 3;
export const MILLIMES_PER_DINAR = 1000;

export type SupportedLocale = 'fr' | 'en' | 'ar';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  fr: 'fr-TN',
  en: 'en-US',
  ar: 'ar-TN',
};

/**
 * Formats an integer millimes value as a TND currency string with exactly 3 decimal places.
 * Example: 125500 -> "125,500 TND" (fr) or "125.500 TND" (en)
 */
export function formatTndFromMillimes(
  millimes: number,
  locale: SupportedLocale = 'fr'
): string {
  if (!Number.isFinite(millimes)) {
    throw new RangeError('Millimes amount must be a finite number.');
  }

  const dinars = Math.trunc(millimes) / MILLIMES_PER_DINAR;
  const formattedNumber = new Intl.NumberFormat(LOCALE_MAP[locale], {
    minimumFractionDigits: TND_DECIMALS,
    maximumFractionDigits: TND_DECIMALS,
  }).format(dinars);

  return `${formattedNumber} ${DEFAULT_CURRENCY}`;
}

/**
 * Parses a decimal string (using comma or dot) into integer millimes.
 * Returns null if input is invalid or has more than 3 fractional digits.
 */
export function parseTndToMillimes(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d{1,3})?$/.test(cleaned)) {
    return null;
  }

  const isNegative = cleaned.startsWith('-');
  const unsigned = isNegative ? cleaned.slice(1) : cleaned;
  const [wholePart, fracPart = ''] = unsigned.split('.');
  const paddedFrac = fracPart.padEnd(TND_DECIMALS, '0');
  const total = Number(wholePart) * MILLIMES_PER_DINAR + Number(paddedFrac);

  if (!Number.isSafeInteger(total)) {
    return null;
  }

  return isNegative ? -total : total;
}

/**
 * Sums an array of integer millimes values safely.
 */
export function sumMillimes(amounts: readonly number[]): number {
  let total = 0;
  for (const amount of amounts) {
    if (!Number.isInteger(amount)) {
      throw new RangeError('All millime amounts must be integers.');
    }
    total += amount;
  }
  return total;
}
