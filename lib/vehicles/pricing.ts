import {
  DEFAULT_CURRENCY,
  formatTndFromMillimes,
  parseTndToMillimes,
  sumMillimes,
} from '@/lib/currency';
import {
  diffCalendarDays,
  formatIsoDateFr,
  getTodayIsoDateInTimeZone,
  isValidIsoCalendarDate,
  resolveAgencyTimeZone,
} from './compliance';

/**
 * KIRALIS — Deterministic Advanced Vehicle Pricing Engine (Phase 5B.2)
 *
 * Designed to be server-safe, 100% integer-millime exact (no floating-point
 * monetary arithmetic), timezone-aware on agency calendar dates, and reusable
 * by the future reservation module.
 *
 * PRICING PRECEDENCE & INVARIANTS:
 * 1. Interval semantics: [pickupDate, returnDate) in agency-local calendar dates.
 *    The return date is excluded from charged days. Total charged days must be >= 1.
 * 2. Seasonal precedence: active seasonal rules override the standard daily rate
 *    for their inclusive [start_date, end_date] dates and are charged per day.
 *    Never apply multiple active seasonal rules to the same day (overlaps are
 *    rejected both in PostgreSQL via GiST EXCLUDE and in this calculator).
 * 3. Segment isolation: package blocks (7-day weekly_rate_minor and 30-day
 *    monthly_rate_minor) MUST NOT cross seasonal pricing dates. Mixed rentals
 *    are split into contiguous seasonal and non-seasonal (standard) segments.
 * 4. Standard package optimization: inside each contiguous non-seasonal segment,
 *    exact integer dynamic programming selects the least expensive valid
 *    combination of available 1-day, 7-day, and 30-day blocks. On exact cost
 *    ties, larger package blocks (30-day -> 7-day -> 1-day) are preferred
 *    deterministically.
 * 5. Scope: produces an indicative rental subtotal only — excludes deposit,
 *    taxes, discounts, late fees, and extra charges.
 */

export const WEEKLY_PACKAGE_DAYS = 7;
export const MONTHLY_PACKAGE_DAYS = 30;
export const MAX_SIMULATION_DAYS = 3650; // 10 years upper safety bound
export const MAX_PRICING_MINOR = 999_999_999_000;

export const PRICING_SIMULATOR_DISCLAIMER =
  'Simulation indicative — hors caution, taxes éventuelles et frais supplémentaires.';

export const PRICING_PRECEDENCE_SUMMARY =
  'Les tarifs saisonniers actifs s’appliquent jour par jour sur leurs dates incluses et sont prioritaires sur le tarif journalier standard. Les forfaits 7 jours et 30 jours s’appliquent uniquement aux blocs continus de jours standards, sans jamais traverser une période saisonnière, selon la combinaison la moins chère.';

export interface VehiclePricingInput {
  daily_rate_minor: number;
  weekly_rate_minor: number | null;
  monthly_rate_minor: number | null;
  currency_code?: string | null;
}

export interface VehicleSeasonalRateRecord {
  id: string;
  agency_id: string;
  vehicle_id: string;
  label: string | null;
  start_date: string;
  end_date: string;
  daily_rate_minor: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SeasonalRateRuleInput {
  id: string;
  label?: string | null;
  start_date: string;
  end_date: string;
  daily_rate_minor: number;
  is_active: boolean;
}

export interface SeasonalRateFormValues {
  label: string;
  start_date: string;
  end_date: string;
  daily_rate_tnd: string;
  is_active: boolean;
}

export type SeasonalRateFieldName =
  | 'label'
  | 'start_date'
  | 'end_date'
  | 'daily_rate_minor'
  | 'is_active';

export type SeasonalRateFieldErrors = Partial<
  Record<SeasonalRateFieldName, string>
>;

export interface ValidatedSeasonalRatePayload {
  label: string | null;
  start_date: string;
  end_date: string;
  daily_rate_minor: number;
  is_active: boolean;
}

export interface SeasonalRateValidationResult {
  valid: boolean;
  errors: SeasonalRateFieldErrors;
  data?: ValidatedSeasonalRatePayload;
}

export interface PricingCalculationInput {
  vehicle: VehiclePricingInput;
  seasonalRules: readonly SeasonalRateRuleInput[];
  pickupDate: string;
  returnDate: string;
  agencyTimeZone?: string | null;
  /** Optional reference clock for deterministic agency-local "today" metadata. */
  now?: Date;
}

export type PricingLineItemKind =
  | 'monthly_package'
  | 'weekly_package'
  | 'daily_standard'
  | 'daily_seasonal';

export interface PricingLineItem {
  kind: PricingLineItemKind;
  label: string;
  periodStart: string;
  periodEndInclusive: string;
  quantity: number;
  daysCovered: number;
  unitRateMinor: number;
  subtotalMinor: number;
  standardBaselineMinor: number;
  deltaVsStandardMinor: number;
  ruleId?: string;
  ruleLabel?: string | null;
}

export interface AppliedSeasonalDateDetail {
  date: string;
  ruleId: string;
  ruleLabel: string | null;
  dailyRateMinor: number;
  standardDailyRateMinor: number;
  deltaMinor: number;
}

export interface PricingSegmentBreakdown {
  type: 'standard' | 'seasonal';
  startDate: string;
  endDateInclusive: string;
  days: number;
  subtotalMinor: number;
  ruleId?: string;
  ruleLabel?: string | null;
  seasonalDailyRateMinor?: number;
  packages?: {
    monthlyCount: number;
    weeklyCount: number;
    dailyCount: number;
  };
}

export interface PricingPreviewSuccess {
  ok: true;
  pickupDate: string;
  returnDate: string;
  lastChargedDateInclusive: string;
  agencyTimeZone: string;
  agencyTodayDate: string;
  currencyCode: string;
  chargedDays: number;
  standardDays: number;
  seasonalDays: number;
  standardDailyRateMinor: number;
  weeklyRateMinor: number | null;
  monthlyRateMinor: number | null;
  appliedPackages: {
    monthlyCount: number;
    weeklyCount: number;
    standardDailyCount: number;
    seasonalDailyCount: number;
  };
  seasonalDates: readonly AppliedSeasonalDateDetail[];
  segments: readonly PricingSegmentBreakdown[];
  lineItems: readonly PricingLineItem[];
  subtotalMinor: number;
  standardDailyBaselineMinor: number;
  differenceVsStandardDailyMinor: number;
  totalFormattedTnd: string;
  appliedRulesExplanation: readonly string[];
  disclaimer: string;
}

export type PricingErrorCode =
  | 'invalid_pickup_date'
  | 'invalid_return_date'
  | 'invalid_date_range'
  | 'range_too_long'
  | 'invalid_vehicle_rates'
  | 'invalid_seasonal_rule'
  | 'overlapping_seasonal_rules';

export interface PricingPreviewFailure {
  ok: false;
  code: PricingErrorCode;
  error: string;
}

export type PricingPreviewResult = PricingPreviewSuccess | PricingPreviewFailure;

const MS_PER_DAY = 86_400_000;

/**
 * Adds a signed integer number of calendar days to a validated YYYY-MM-DD date
 * using pure UTC-midnight arithmetic (zero DST drift).
 */
export function addCalendarDays(isoDate: string, daysToAdd: number): string {
  if (!isValidIsoCalendarDate(isoDate)) {
    throw new RangeError(`Date ISO invalide : ${isoDate}`);
  }
  const [y, m, d] = isoDate.split('-').map(Number);
  const utcMs = Date.UTC(y, m - 1, d) + Math.trunc(daysToAdd) * MS_PER_DAY;
  const target = new Date(utcMs);
  const year = String(target.getUTCFullYear()).padStart(4, '0');
  const month = String(target.getUTCMonth() + 1).padStart(2, '0');
  const day = String(target.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Checks whether two inclusive YYYY-MM-DD date ranges share at least one day.
 * Adjacent ranges (e.g. 2026-07-01..2026-07-10 and 2026-07-11..2026-07-20)
 * return false.
 */
export function doInclusiveDateRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  return startA <= endB && startB <= endA;
}

/**
 * Finds the first pair of overlapping active seasonal rules, if any.
 */
export function findOverlappingActiveSeasonalRules(
  rules: readonly SeasonalRateRuleInput[]
): [SeasonalRateRuleInput, SeasonalRateRuleInput] | null {
  const active = rules
    .filter((r) => r.is_active)
    .slice()
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  for (let i = 0; i < active.length - 1; i += 1) {
    const current = active[i];
    const next = active[i + 1];
    if (
      doInclusiveDateRangesOverlap(
        current.start_date,
        current.end_date,
        next.start_date,
        next.end_date
      )
    ) {
      return [current, next];
    }
  }
  return null;
}

function isValidNonNegativeMinor(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_PRICING_MINOR
  );
}

interface StandardSegmentOptimization {
  subtotalMinor: number;
  monthlyCount: number;
  weeklyCount: number;
  dailyCount: number;
}

/**
 * Exact integer dynamic programming for a contiguous block of `days` non-seasonal
 * rental days. Selects the minimum-cost combination of 1-day, optional 7-day,
 * and optional 30-day packages.
 *
 * Tie-breaking (equal total minor cost): prefers larger package blocks first
 * (30-day -> 7-day -> 1-day) for deterministic, predictable breakdowns.
 */
export function optimizeStandardSegment(
  days: number,
  dailyRateMinor: number,
  weeklyRateMinor: number | null,
  monthlyRateMinor: number | null
): StandardSegmentOptimization {
  if (!Number.isSafeInteger(days) || days <= 0) {
    return { subtotalMinor: 0, monthlyCount: 0, weeklyCount: 0, dailyCount: 0 };
  }

  const dpCost = new Array<number>(days + 1).fill(Number.POSITIVE_INFINITY);
  const dpMonthly = new Array<number>(days + 1).fill(0);
  const dpWeekly = new Array<number>(days + 1).fill(0);
  const dpDaily = new Array<number>(days + 1).fill(0);

  dpCost[0] = 0;

  const isBetter = (
    candCost: number,
    candM: number,
    candW: number,
    bestCost: number,
    bestM: number,
    bestW: number
  ): boolean => {
    if (candCost < bestCost) return true;
    if (candCost > bestCost) return false;
    if (candM !== bestM) return candM > bestM;
    return candW > bestW;
  };

  for (let d = 1; d <= days; d += 1) {
    // 1-day transition (always valid)
    const dailyCost = dpCost[d - 1] + dailyRateMinor;
    let bestCost = dailyCost;
    let bestM = dpMonthly[d - 1];
    let bestW = dpWeekly[d - 1];
    let bestD = dpDaily[d - 1] + 1;

    // 7-day package transition (optional)
    if (weeklyRateMinor !== null && d >= WEEKLY_PACKAGE_DAYS) {
      const prev = d - WEEKLY_PACKAGE_DAYS;
      const candCost = dpCost[prev] + weeklyRateMinor;
      const candM = dpMonthly[prev];
      const candW = dpWeekly[prev] + 1;
      const candD = dpDaily[prev];
      if (isBetter(candCost, candM, candW, bestCost, bestM, bestW)) {
        bestCost = candCost;
        bestM = candM;
        bestW = candW;
        bestD = candD;
      }
    }

    // 30-day package transition (optional)
    if (monthlyRateMinor !== null && d >= MONTHLY_PACKAGE_DAYS) {
      const prev = d - MONTHLY_PACKAGE_DAYS;
      const candCost = dpCost[prev] + monthlyRateMinor;
      const candM = dpMonthly[prev] + 1;
      const candW = dpWeekly[prev];
      const candD = dpDaily[prev];
      if (isBetter(candCost, candM, candW, bestCost, bestM, bestW)) {
        bestCost = candCost;
        bestM = candM;
        bestW = candW;
        bestD = candD;
      }
    }

    dpCost[d] = bestCost;
    dpMonthly[d] = bestM;
    dpWeekly[d] = bestW;
    dpDaily[d] = bestD;
  }

  return {
    subtotalMinor: dpCost[days],
    monthlyCount: dpMonthly[days],
    weeklyCount: dpWeekly[days],
    dailyCount: dpDaily[days],
  };
}

/**
 * Computes a deterministic, itemized rental price preview in integer millimes.
 */
export function calculateRentalPricePreview(
  input: PricingCalculationInput
): PricingPreviewResult {
  const agencyTimeZone = resolveAgencyTimeZone(input.agencyTimeZone);
  const agencyTodayDate = getTodayIsoDateInTimeZone(agencyTimeZone, input.now);
  const currencyCode =
    input.vehicle.currency_code?.trim().toUpperCase() || DEFAULT_CURRENCY;

  // 1. Validate calendar dates & half-open [pickupDate, returnDate) interval
  if (!isValidIsoCalendarDate(input.pickupDate)) {
    return {
      ok: false,
      code: 'invalid_pickup_date',
      error: 'Indiquez une date de prise en charge valide (AAAA-MM-JJ).',
    };
  }

  if (!isValidIsoCalendarDate(input.returnDate)) {
    return {
      ok: false,
      code: 'invalid_return_date',
      error: 'Indiquez une date de restitution valide (AAAA-MM-JJ).',
    };
  }

  const chargedDays = diffCalendarDays(input.pickupDate, input.returnDate);
  if (chargedDays <= 0) {
    return {
      ok: false,
      code: 'invalid_date_range',
      error:
        'La date de restitution doit être strictement postérieure à la date de prise en charge (au moins 1 jour facturé).',
    };
  }

  if (chargedDays > MAX_SIMULATION_DAYS) {
    return {
      ok: false,
      code: 'range_too_long',
      error:
        'La durée de simulation ne peut pas dépasser 3 650 jours (10 ans).',
    };
  }

  // 2. Validate vehicle monetary inputs (exact integer millimes)
  const dailyRateMinor = input.vehicle.daily_rate_minor;
  const weeklyRateMinor = input.vehicle.weekly_rate_minor ?? null;
  const monthlyRateMinor = input.vehicle.monthly_rate_minor ?? null;

  if (
    !isValidNonNegativeMinor(dailyRateMinor) ||
    (weeklyRateMinor !== null && !isValidNonNegativeMinor(weeklyRateMinor)) ||
    (monthlyRateMinor !== null && !isValidNonNegativeMinor(monthlyRateMinor))
  ) {
    return {
      ok: false,
      code: 'invalid_vehicle_rates',
      error:
        'Les tarifs du véhicule doivent être des entiers positifs ou nuls en millimes.',
    };
  }

  // 3. Validate active seasonal rules and reject any overlap
  const activeRules: SeasonalRateRuleInput[] = [];
  for (const rule of input.seasonalRules) {
    if (!rule.is_active) continue;
    if (
      !isValidIsoCalendarDate(rule.start_date) ||
      !isValidIsoCalendarDate(rule.end_date) ||
      rule.end_date < rule.start_date ||
      !isValidNonNegativeMinor(rule.daily_rate_minor)
    ) {
      return {
        ok: false,
        code: 'invalid_seasonal_rule',
        error:
          'Une règle tarifaire saisonnière active contient des dates ou un montant invalide.',
      };
    }
    activeRules.push(rule);
  }

  const overlap = findOverlappingActiveSeasonalRules(activeRules);
  if (overlap) {
    return {
      ok: false,
      code: 'overlapping_seasonal_rules',
      error:
        'Deux règles tarifaires saisonnières actives se chevauchent sur la même date. Corrigez ou désactivez la règle en conflit.',
    };
  }

  activeRules.sort((a, b) => a.start_date.localeCompare(b.start_date));

  // 4. Classify every charged calendar day in [pickupDate, returnDate)
  type DaySlot =
    | { date: string; type: 'standard' }
    | { date: string; type: 'seasonal'; rule: SeasonalRateRuleInput };

  const slots: DaySlot[] = [];
  const seasonalDates: AppliedSeasonalDateDetail[] = [];

  for (let i = 0; i < chargedDays; i += 1) {
    const currentDate = addCalendarDays(input.pickupDate, i);
    const matchingRule = activeRules.find(
      (rule) => rule.start_date <= currentDate && currentDate <= rule.end_date
    );

    if (matchingRule) {
      slots.push({ date: currentDate, type: 'seasonal', rule: matchingRule });
      seasonalDates.push({
        date: currentDate,
        ruleId: matchingRule.id,
        ruleLabel: matchingRule.label ?? null,
        dailyRateMinor: matchingRule.daily_rate_minor,
        standardDailyRateMinor: dailyRateMinor,
        deltaMinor: matchingRule.daily_rate_minor - dailyRateMinor,
      });
    } else {
      slots.push({ date: currentDate, type: 'standard' });
    }
  }

  // 5. Group contiguous days into isolated standard & seasonal segments
  interface RawSegment {
    type: 'standard' | 'seasonal';
    startDate: string;
    endDateInclusive: string;
    days: number;
    rule?: SeasonalRateRuleInput;
  }

  const rawSegments: RawSegment[] = [];
  for (const slot of slots) {
    const last = rawSegments[rawSegments.length - 1];
    if (
      last &&
      last.type === slot.type &&
      (slot.type === 'standard' || last.rule?.id === slot.rule.id)
    ) {
      last.endDateInclusive = slot.date;
      last.days += 1;
    } else {
      rawSegments.push({
        type: slot.type,
        startDate: slot.date,
        endDateInclusive: slot.date,
        days: 1,
        rule: slot.type === 'seasonal' ? slot.rule : undefined,
      });
    }
  }

  // 6. Price each segment independently (packages NEVER cross seasonal dates)
  const segments: PricingSegmentBreakdown[] = [];
  const lineItems: PricingLineItem[] = [];

  let totalMonthlyCount = 0;
  let totalWeeklyCount = 0;
  let totalStandardDailyCount = 0;
  let totalSeasonalDailyCount = 0;
  let standardDays = 0;
  let seasonalDays = 0;

  for (const seg of rawSegments) {
    if (seg.type === 'seasonal' && seg.rule) {
      seasonalDays += seg.days;
      totalSeasonalDailyCount += seg.days;
      const subtotalMinor = seg.days * seg.rule.daily_rate_minor;
      const baselineMinor = seg.days * dailyRateMinor;
      const deltaMinor = subtotalMinor - baselineMinor;
      const ruleDisplay = seg.rule.label?.trim()
        ? `Tarif saisonnier — ${seg.rule.label.trim()}`
        : 'Tarif saisonnier';

      segments.push({
        type: 'seasonal',
        startDate: seg.startDate,
        endDateInclusive: seg.endDateInclusive,
        days: seg.days,
        subtotalMinor,
        ruleId: seg.rule.id,
        ruleLabel: seg.rule.label ?? null,
        seasonalDailyRateMinor: seg.rule.daily_rate_minor,
      });

      lineItems.push({
        kind: 'daily_seasonal',
        label: ruleDisplay,
        periodStart: seg.startDate,
        periodEndInclusive: seg.endDateInclusive,
        quantity: seg.days,
        daysCovered: seg.days,
        unitRateMinor: seg.rule.daily_rate_minor,
        subtotalMinor,
        standardBaselineMinor: baselineMinor,
        deltaVsStandardMinor: deltaMinor,
        ruleId: seg.rule.id,
        ruleLabel: seg.rule.label ?? null,
      });
    } else {
      standardDays += seg.days;
      const opt = optimizeStandardSegment(
        seg.days,
        dailyRateMinor,
        weeklyRateMinor,
        monthlyRateMinor
      );

      totalMonthlyCount += opt.monthlyCount;
      totalWeeklyCount += opt.weeklyCount;
      totalStandardDailyCount += opt.dailyCount;

      segments.push({
        type: 'standard',
        startDate: seg.startDate,
        endDateInclusive: seg.endDateInclusive,
        days: seg.days,
        subtotalMinor: opt.subtotalMinor,
        packages: {
          monthlyCount: opt.monthlyCount,
          weeklyCount: opt.weeklyCount,
          dailyCount: opt.dailyCount,
        },
      });

      if (opt.monthlyCount > 0 && monthlyRateMinor !== null) {
        const covered = opt.monthlyCount * MONTHLY_PACKAGE_DAYS;
        const lineSubtotal = opt.monthlyCount * monthlyRateMinor;
        const baseline = covered * dailyRateMinor;
        lineItems.push({
          kind: 'monthly_package',
          label: 'Forfait 30 jours (standard)',
          periodStart: seg.startDate,
          periodEndInclusive: seg.endDateInclusive,
          quantity: opt.monthlyCount,
          daysCovered: covered,
          unitRateMinor: monthlyRateMinor,
          subtotalMinor: lineSubtotal,
          standardBaselineMinor: baseline,
          deltaVsStandardMinor: lineSubtotal - baseline,
        });
      }

      if (opt.weeklyCount > 0 && weeklyRateMinor !== null) {
        const covered = opt.weeklyCount * WEEKLY_PACKAGE_DAYS;
        const lineSubtotal = opt.weeklyCount * weeklyRateMinor;
        const baseline = covered * dailyRateMinor;
        lineItems.push({
          kind: 'weekly_package',
          label: 'Forfait 7 jours (standard)',
          periodStart: seg.startDate,
          periodEndInclusive: seg.endDateInclusive,
          quantity: opt.weeklyCount,
          daysCovered: covered,
          unitRateMinor: weeklyRateMinor,
          subtotalMinor: lineSubtotal,
          standardBaselineMinor: baseline,
          deltaVsStandardMinor: lineSubtotal - baseline,
        });
      }

      if (opt.dailyCount > 0) {
        const lineSubtotal = opt.dailyCount * dailyRateMinor;
        lineItems.push({
          kind: 'daily_standard',
          label: 'Tarif journalier standard',
          periodStart: seg.startDate,
          periodEndInclusive: seg.endDateInclusive,
          quantity: opt.dailyCount,
          daysCovered: opt.dailyCount,
          unitRateMinor: dailyRateMinor,
          subtotalMinor: lineSubtotal,
          standardBaselineMinor: lineSubtotal,
          deltaVsStandardMinor: 0,
        });
      }
    }
  }

  const subtotalMinor = sumMillimes(lineItems.map((item) => item.subtotalMinor));
  const standardDailyBaselineMinor = chargedDays * dailyRateMinor;
  const differenceVsStandardDailyMinor =
    subtotalMinor - standardDailyBaselineMinor;
  const lastChargedDateInclusive = addCalendarDays(input.returnDate, -1);

  // 7. Build clear French rule explanation
  const explanation: string[] = [
    `Période facturée : ${chargedDays} jour(s) calendaires du ${formatIsoDateFr(input.pickupDate)} au ${formatIsoDateFr(lastChargedDateInclusive)} inclus (date de restitution ${formatIsoDateFr(input.returnDate)} exclue, fuseau ${agencyTimeZone}).`,
  ];

  if (seasonalDays > 0 && standardDays > 0) {
    explanation.push(
      `Période mixte découpée en ${segments.length} segment(s) : ${seasonalDays} jour(s) saisonnier(s) facturés au tarif journalier saisonnier et ${standardDays} jour(s) standards évalués séparément (aucun forfait ne traverse une date saisonnière).`
    );
  } else if (seasonalDays > 0) {
    explanation.push(
      `Tous les jours facturés (${seasonalDays} j) relèvent d’un tarif saisonnier actif prioritaire sur le tarif standard.`
    );
  } else {
    explanation.push(
      'Aucun tarif saisonnier actif sur cette période : optimisation appliquée sur la grille standard (combinaison la moins chère parmi les forfaits 30 j, 7 j et le tarif journalier).'
    );
  }

  if (totalMonthlyCount > 0 || totalWeeklyCount > 0) {
    const parts: string[] = [];
    if (totalMonthlyCount > 0) {
      parts.push(`${totalMonthlyCount} × forfait 30 jours`);
    }
    if (totalWeeklyCount > 0) {
      parts.push(`${totalWeeklyCount} × forfait 7 jours`);
    }
    if (totalStandardDailyCount > 0) {
      parts.push(`${totalStandardDailyCount} × jour standard`);
    }
    explanation.push(`Combinaison standard retenue : ${parts.join(' + ')}.`);
  }

  return {
    ok: true,
    pickupDate: input.pickupDate,
    returnDate: input.returnDate,
    lastChargedDateInclusive,
    agencyTimeZone,
    agencyTodayDate,
    currencyCode,
    chargedDays,
    standardDays,
    seasonalDays,
    standardDailyRateMinor: dailyRateMinor,
    weeklyRateMinor,
    monthlyRateMinor,
    appliedPackages: {
      monthlyCount: totalMonthlyCount,
      weeklyCount: totalWeeklyCount,
      standardDailyCount: totalStandardDailyCount,
      seasonalDailyCount: totalSeasonalDailyCount,
    },
    seasonalDates,
    segments,
    lineItems,
    subtotalMinor,
    standardDailyBaselineMinor,
    differenceVsStandardDailyMinor,
    totalFormattedTnd: formatTndFromMillimes(subtotalMinor, 'fr'),
    appliedRulesExplanation: explanation,
    disclaimer: PRICING_SIMULATOR_DISCLAIMER,
  };
}

/**
 * Validates a seasonal rate payload (used both on client forms and API routes).
 */
export function validateSeasonalRatePayload(
  raw: Record<string, unknown>
): SeasonalRateValidationResult {
  const errors: SeasonalRateFieldErrors = {};

  const labelRaw = typeof raw.label === 'string' ? raw.label.trim() : '';
  const label = labelRaw ? labelRaw : null;
  if (label && label.length > 80) {
    errors.label = 'Le libellé ne doit pas dépasser 80 caractères.';
  }

  const startDate =
    typeof raw.start_date === 'string' ? raw.start_date.trim() : '';
  if (!startDate || !isValidIsoCalendarDate(startDate)) {
    errors.start_date =
      'Indiquez une date de début valide au format AAAA-MM-JJ.';
  }

  const endDate = typeof raw.end_date === 'string' ? raw.end_date.trim() : '';
  if (!endDate || !isValidIsoCalendarDate(endDate)) {
    errors.end_date = 'Indiquez une date de fin valide au format AAAA-MM-JJ.';
  }

  if (
    !errors.start_date &&
    !errors.end_date &&
    endDate < startDate
  ) {
    errors.end_date =
      'La date de fin doit être postérieure ou égale à la date de début.';
  }

  let dailyRateMinor: number | null = null;
  if (
    raw.daily_rate_minor !== undefined &&
    raw.daily_rate_minor !== null &&
    raw.daily_rate_minor !== ''
  ) {
    if (
      typeof raw.daily_rate_minor === 'number' &&
      Number.isSafeInteger(raw.daily_rate_minor)
    ) {
      dailyRateMinor = raw.daily_rate_minor;
    } else if (
      typeof raw.daily_rate_minor === 'string' &&
      /^-?\d+$/.test(raw.daily_rate_minor.trim())
    ) {
      const parsed = Number(raw.daily_rate_minor.trim());
      if (Number.isSafeInteger(parsed)) {
        dailyRateMinor = parsed;
      }
    }
  } else if (typeof raw.daily_rate_tnd === 'string') {
    const trimmed = raw.daily_rate_tnd.trim();
    if (trimmed) {
      dailyRateMinor = parseTndToMillimes(trimmed);
    }
  }

  if (
    dailyRateMinor === null ||
    dailyRateMinor < 0 ||
    dailyRateMinor > MAX_PRICING_MINOR
  ) {
    errors.daily_rate_minor =
      'Indiquez un tarif saisonnier valide positif ou nul en TND (max 3 décimales).';
  }

  let isActive = true;
  if (raw.is_active !== undefined) {
    if (typeof raw.is_active !== 'boolean') {
      errors.is_active = 'État d’activation invalide.';
    } else {
      isActive = raw.is_active;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      label,
      start_date: startDate,
      end_date: endDate,
      daily_rate_minor: dailyRateMinor!,
      is_active: isActive,
    },
  };
}

/**
 * Detects when migration 0005 columns (weekly_rate_minor / monthly_rate_minor)
 * are not yet present in Supabase.
 */
export function isMissingPricingColumnError(
  error:
    | {
        code?: string | null;
        message?: string | null;
        details?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const mentionsPricingColumn =
    combined.includes('weekly_rate_minor') ||
    combined.includes('monthly_rate_minor');

  return (
    mentionsPricingColumn &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('does not exist') ||
      combined.includes('schema cache'))
  );
}

/**
 * Detects when migration 0005 table public.vehicle_seasonal_rates is not yet
 * present in Supabase.
 */
export function isMissingSeasonalRatesTableError(
  error:
    | {
        code?: string | null;
        message?: string | null;
        details?: string | null;
      }
    | null
    | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const mentionsTable = combined.includes('vehicle_seasonal_rates');

  return (
    (mentionsTable &&
      (code === '42P01' ||
        code === 'PGRST205' ||
        combined.includes('does not exist') ||
        combined.includes('could not find the table') ||
        combined.includes('schema cache'))) ||
    code === '42P01' && mentionsTable
  );
}

/**
 * Translates PostgreSQL / PostgREST errors from public.vehicle_seasonal_rates
 * into clear French HTTP responses (including 409 for exclusion_violation 23P01).
 */
export function mapSeasonalRateDbError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): {
  status: number;
  message: string;
  fieldErrors?: SeasonalRateFieldErrors;
  missingPricingSchema?: boolean;
} {
  if (isMissingSeasonalRatesTableError(error)) {
    return {
      status: 503,
      missingPricingSchema: true,
      message:
        'La table des tarifs saisonniers n’est pas encore installée dans Supabase. Appliquez la migration 202611210005_vehicle_advanced_pricing.sql puis réessayez.',
    };
  }

  const code = error.code ?? '';
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();

  if (
    code === '23P01' ||
    combined.includes('vehicle_seasonal_rates_no_overlap_active') ||
    combined.includes('conflicting key value violates exclusion constraint')
  ) {
    return {
      status: 409,
      message:
        'Cette période chevauche déjà un tarif saisonnier actif pour ce véhicule. Les périodes adjacentes sans jour commun sont autorisées.',
      fieldErrors: {
        start_date:
          'Chevauchement avec une autre règle saisonnière active.',
        end_date:
          'Ajustez les dates ou désactivez d’abord la règle en conflit.',
      },
    };
  }

  if (
    code === '42501' ||
    combined.includes('row-level security') ||
    combined.includes('permission denied')
  ) {
    return {
      status: 403,
      message:
        'Accès refusé : seuls les propriétaires et gestionnaires peuvent gérer les tarifs saisonniers.',
    };
  }

  if (
    code === '23503' ||
    combined.includes('vehicle_seasonal_rates_vehicle_same_agency_fk')
  ) {
    return {
      status: 404,
      message: 'Véhicule introuvable dans votre agence.',
    };
  }

  if (code === '23514' || code === '22P02' || code === '22003' || code === '22007') {
    return {
      status: 400,
      message:
        'Les dates ou le montant du tarif saisonnier ne respectent pas les contraintes de la base de données.',
    };
  }

  return {
    status: 500,
    message:
      'Impossible d’enregistrer le tarif saisonnier pour le moment. Veuillez réessayer.',
  };
}
