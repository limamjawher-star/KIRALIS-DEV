/**
 * Pure calendar utilities for Africa/Tunis scheduling grids (Monday-first week).
 */

import type { SupportedLocale } from './currency';

export interface CalendarDayCell {
  isoDate: string;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
}

export interface MonthCoordinates {
  year: number;
  month: number; // 0-indexed (0 = January, 11 = December)
}

const LOCALE_TAGS: Record<SupportedLocale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  ar: 'ar-TN',
};

/**
 * Returns YYYY-MM-DD in the Africa/Tunis timezone for a given Date.
 */
export function getTodayIsoInTunis(now: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

/**
 * Shifts a (year, month) pair by deltaMonths (positive or negative).
 */
export function shiftMonth(
  coords: MonthCoordinates,
  deltaMonths: number
): MonthCoordinates {
  const totalMonths = coords.year * 12 + coords.month + deltaMonths;
  const year = Math.floor(totalMonths / 12);
  const month = ((totalMonths % 12) + 12) % 12;
  return { year, month };
}

/**
 * Formats a localized month + year heading (e.g., "Novembre 2026").
 */
export function formatMonthHeading(
  coords: MonthCoordinates,
  locale: SupportedLocale = 'fr'
): string {
  const date = new Date(Date.UTC(coords.year, coords.month, 15));
  const raw = new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/**
 * Generates a 42-day (6-week) Monday-first calendar grid for a given year and 0-indexed month.
 */
export function buildMonthGrid(
  coords: MonthCoordinates,
  todayIso: string
): CalendarDayCell[] {
  const firstDayUtc = new Date(Date.UTC(coords.year, coords.month, 1));
  const jsWeekday = firstDayUtc.getUTCDay(); // 0 = Sunday ... 6 = Saturday
  const mondayOffset = (jsWeekday + 6) % 7; // 0 = Monday ... 6 = Sunday

  const gridStart = new Date(
    Date.UTC(coords.year, coords.month, 1 - mondayOffset)
  );

  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cellDate = new Date(gridStart.getTime() + i * 86_400_000);
    const y = cellDate.getUTCFullYear();
    const m = cellDate.getUTCMonth();
    const d = cellDate.getUTCDate();
    const isoDate = `${String(y).padStart(4, '0')}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

    cells.push({
      isoDate,
      dayOfMonth: d,
      inCurrentMonth: y === coords.year && m === coords.month,
      isToday: isoDate === todayIso,
    });
  }

  return cells;
}
