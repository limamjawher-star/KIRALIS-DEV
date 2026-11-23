import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { formatTndFromMillimes, parseTndToMillimes } from '@/lib/currency';
import { evaluateVehicleCompliance } from './compliance';
import {
  calculateRentalPricePreview,
  doInclusiveDateRangesOverlap,
  isMissingPricingColumnError,
  isMissingSeasonalRatesTableError,
  mapSeasonalRateDbError,
  PRICING_SIMULATOR_DISCLAIMER,
  validateSeasonalRatePayload,
  type SeasonalRateRuleInput,
  type VehiclePricingInput,
} from './pricing';
import { reduceSeasonalToggleUiState } from '@/components/vehicles/vehicle-pricing-section';
import {
  listAgencyVehiclesWithClient,
  VEHICLE_BASE_SELECT_COLUMNS,
  VEHICLE_COMPLIANCE_SELECT_COLUMNS,
  VEHICLE_SELECT_COLUMNS,
} from './server';
import {
  canManageVehicles,
  vehicleRecordToFormValues,
  type VehicleRecord,
} from './types';
import { mapVehicleDbError, validateVehiclePayload } from './validation';

const BASE_VEHICLE_PRICING: VehiclePricingInput = {
  daily_rate_minor: 100_000, // 100,000 TND
  weekly_rate_minor: 630_000, // 630,000 TND (90 TND/j effective)
  monthly_rate_minor: 2_400_000, // 2 400,000 TND (80 TND/j effective)
  currency_code: 'TND',
};

function makeRule(
  overrides: Partial<SeasonalRateRuleInput> = {}
): SeasonalRateRuleInput {
  return {
    id: 'rule-summer',
    label: 'Haute saison été',
    start_date: '2026-07-10',
    end_date: '2026-07-15',
    daily_rate_minor: 150_000,
    is_active: true,
    ...overrides,
  };
}

test('1. One-day rental charges exactly 1 daily rate with return date excluded', () => {
  const result = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-05-10',
    returnDate: '2026-05-11',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.chargedDays, 1);
  assert.equal(result.lastChargedDateInclusive, '2026-05-10');
  assert.equal(result.subtotalMinor, 100_000);
  assert.equal(result.appliedPackages.standardDailyCount, 1);
  assert.equal(result.appliedPackages.weeklyCount, 0);
  assert.equal(result.appliedPackages.monthlyCount, 0);
  assert.equal(result.disclaimer, PRICING_SIMULATOR_DISCLAIMER);
});

test('2. Exactly 7 days picks the cheaper option (7-day package vs 7 × daily)', () => {
  const withDiscountWeekly = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-08',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(withDiscountWeekly.ok, true);
  if (!withDiscountWeekly.ok) return;
  assert.equal(withDiscountWeekly.chargedDays, 7);
  assert.equal(withDiscountWeekly.subtotalMinor, 630_000);
  assert.equal(withDiscountWeekly.appliedPackages.weeklyCount, 1);
  assert.equal(withDiscountWeekly.appliedPackages.standardDailyCount, 0);
  assert.equal(withDiscountWeekly.differenceVsStandardDailyMinor, -70_000);

  // If weekly package is more expensive than 7 × daily, least-cost combination picks 7 × daily
  const expensiveWeekly = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 100_000,
      weekly_rate_minor: 750_000,
      monthly_rate_minor: null,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-08',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(expensiveWeekly.ok, true);
  if (!expensiveWeekly.ok) return;
  assert.equal(expensiveWeekly.subtotalMinor, 700_000);
  assert.equal(expensiveWeekly.appliedPackages.weeklyCount, 0);
  assert.equal(expensiveWeekly.appliedPackages.standardDailyCount, 7);
});

test('3. Exactly 30 days picks least-cost combination (monthly vs 4×weekly + 2×daily)', () => {
  const standardMonthly = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-06-01',
    returnDate: '2026-07-01',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(standardMonthly.ok, true);
  if (!standardMonthly.ok) return;
  assert.equal(standardMonthly.chargedDays, 30);
  assert.equal(standardMonthly.subtotalMinor, 2_400_000);
  assert.equal(standardMonthly.appliedPackages.monthlyCount, 1);
  assert.equal(standardMonthly.appliedPackages.weeklyCount, 0);
  assert.equal(standardMonthly.appliedPackages.standardDailyCount, 0);

  // Edge case where 4×weekly (4*500k = 2000k) + 2×daily (200k) = 2200k beats monthly (2400k)
  const cheaperViaWeekly = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 100_000,
      weekly_rate_minor: 500_000,
      monthly_rate_minor: 2_400_000,
    },
    seasonalRules: [],
    pickupDate: '2026-06-01',
    returnDate: '2026-07-01',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(cheaperViaWeekly.ok, true);
  if (!cheaperViaWeekly.ok) return;
  assert.equal(cheaperViaWeekly.subtotalMinor, 2_200_000);
  assert.equal(cheaperViaWeekly.appliedPackages.monthlyCount, 0);
  assert.equal(cheaperViaWeekly.appliedPackages.weeklyCount, 4);
  assert.equal(cheaperViaWeekly.appliedPackages.standardDailyCount, 2);
});

test('4. Mixed 30-day, 7-day, and daily packages combine optimally', () => {
  // 38 days = 1×30 (2,400,000) + 1×7 (630,000) + 1×1 (100,000) = 3,130,000
  const result38 = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-04-01',
    returnDate: '2026-05-09',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(result38.ok, true);
  if (!result38.ok) return;
  assert.equal(result38.chargedDays, 38);
  assert.equal(result38.appliedPackages.monthlyCount, 1);
  assert.equal(result38.appliedPackages.weeklyCount, 1);
  assert.equal(result38.appliedPackages.standardDailyCount, 1);
  assert.equal(result38.subtotalMinor, 3_130_000);
  assert.equal(result38.lineItems.length, 3);
});

test('5. Missing optional package rates fall back cleanly to available rates', () => {
  // Neither weekly nor monthly configured -> pure daily
  const dailyOnly = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 125_500,
      weekly_rate_minor: null,
      monthly_rate_minor: null,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-11', // 10 days
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(dailyOnly.ok, true);
  if (!dailyOnly.ok) return;
  assert.equal(dailyOnly.subtotalMinor, 1_255_000);
  assert.equal(dailyOnly.appliedPackages.standardDailyCount, 10);

  // Monthly only (no weekly) for 35 days -> 1×30 + 5×1
  const monthlyOnly = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 100_000,
      weekly_rate_minor: null,
      monthly_rate_minor: 2_500_000,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-06-05', // 35 days
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(monthlyOnly.ok, true);
  if (!monthlyOnly.ok) return;
  assert.equal(monthlyOnly.appliedPackages.monthlyCount, 1);
  assert.equal(monthlyOnly.appliedPackages.weeklyCount, 0);
  assert.equal(monthlyOnly.appliedPackages.standardDailyCount, 5);
  assert.equal(monthlyOnly.subtotalMinor, 3_000_000);
});

test('6. Non-negative prices and zero-rate behavior are validated and handled deterministically', () => {
  // Zero daily rate (courtesy vehicle) -> 0 millimes
  const freeRental = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 0,
      weekly_rate_minor: 0,
      monthly_rate_minor: null,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-08',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(freeRental.ok, true);
  if (!freeRental.ok) return;
  assert.equal(freeRental.subtotalMinor, 0);
  assert.equal(freeRental.appliedPackages.weeklyCount, 1);

  // Negative package rate rejected by calculator
  const negativeRate = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 100_000,
      weekly_rate_minor: -1000,
      monthly_rate_minor: null,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-05',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(negativeRate.ok, false);
  if (!negativeRate.ok) {
    assert.equal(negativeRate.code, 'invalid_vehicle_rates');
  }

  // Negative seasonal rate & negative package rates rejected by validators
  const invalidSeasonal = validateSeasonalRatePayload({
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    daily_rate_tnd: '-10,000',
  });
  assert.equal(invalidSeasonal.valid, false);
  assert.ok(invalidSeasonal.errors.daily_rate_minor);

  const invalidVehiclePackages = validateVehiclePayload({
    plate_number: '214 TU 4821',
    brand: 'Peugeot',
    model: '208',
    daily_rate_tnd: '100,000',
    weekly_rate_tnd: '-50,000',
    monthly_rate_tnd: '10,1234',
  });
  assert.equal(invalidVehiclePackages.valid, false);
  assert.ok(invalidVehiclePackages.errors.weekly_rate_minor);
  assert.ok(invalidVehiclePackages.errors.monthly_rate_minor);
});

test('7. Seasonal date boundaries are inclusive on [start_date, end_date] and respect half-open [pickup, return)', () => {
  // Single-day seasonal rule on 2026-07-10
  const singleDayRule = makeRule({
    id: 'rule-single',
    start_date: '2026-07-10',
    end_date: '2026-07-10',
    daily_rate_minor: 180_000,
  });

  // Rental [2026-07-09, 2026-07-10) -> charges only Jul 9 (standard), Jul 10 excluded
  const before = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [singleDayRule],
    pickupDate: '2026-07-09',
    returnDate: '2026-07-10',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(before.ok, true);
  if (!before.ok) return;
  assert.equal(before.seasonalDays, 0);
  assert.equal(before.standardDays, 1);
  assert.equal(before.subtotalMinor, 100_000);

  // Rental [2026-07-10, 2026-07-11) -> charges Jul 10 (seasonal)
  const onDay = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [singleDayRule],
    pickupDate: '2026-07-10',
    returnDate: '2026-07-11',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(onDay.ok, true);
  if (!onDay.ok) return;
  assert.equal(onDay.seasonalDays, 1);
  assert.equal(onDay.standardDays, 0);
  assert.equal(onDay.subtotalMinor, 180_000);

  // Rental [2026-07-09, 2026-07-12) -> Jul 9 std (100k) + Jul 10 seasonal (180k) + Jul 11 std (100k)
  const around = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [singleDayRule],
    pickupDate: '2026-07-09',
    returnDate: '2026-07-12',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(around.ok, true);
  if (!around.ok) return;
  assert.equal(around.chargedDays, 3);
  assert.equal(around.seasonalDays, 1);
  assert.equal(around.standardDays, 2);
  assert.equal(around.subtotalMinor, 380_000);
});

test('8. Adjacent seasonal periods do not overlap and are priced independently', () => {
  const julyEarly = makeRule({
    id: 'rule-july-1',
    label: 'Juillet',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    daily_rate_minor: 140_000,
  });
  const julyLate = makeRule({
    id: 'rule-july-2',
    label: 'Pic été',
    start_date: '2026-07-11',
    end_date: '2026-07-20',
    daily_rate_minor: 170_000,
  });

  assert.equal(
    doInclusiveDateRangesOverlap(
      julyEarly.start_date,
      julyEarly.end_date,
      julyLate.start_date,
      julyLate.end_date
    ),
    false
  );

  // [2026-07-09, 2026-07-13) -> Jul 9, 10 @ 140k + Jul 11, 12 @ 170k = 620k
  const result = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [julyEarly, julyLate],
    pickupDate: '2026-07-09',
    returnDate: '2026-07-13',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.chargedDays, 4);
  assert.equal(result.seasonalDays, 4);
  assert.equal(result.standardDays, 0);
  assert.equal(result.subtotalMinor, 620_000);
  assert.equal(result.segments.length, 2);
  assert.equal(result.lineItems.length, 2);
});

test('9. Overlapping active seasonal rules are rejected in calculator and DB error mapper (HTTP 409)', () => {
  const ruleA = makeRule({
    id: 'rule-a',
    start_date: '2026-07-01',
    end_date: '2026-07-10',
    daily_rate_minor: 140_000,
  });
  const ruleB = makeRule({
    id: 'rule-b',
    start_date: '2026-07-10', // Shares July 10 -> overlap!
    end_date: '2026-07-20',
    daily_rate_minor: 160_000,
  });

  assert.equal(
    doInclusiveDateRangesOverlap(
      ruleA.start_date,
      ruleA.end_date,
      ruleB.start_date,
      ruleB.end_date
    ),
    true
  );

  const rejected = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [ruleA, ruleB],
    pickupDate: '2026-07-05',
    returnDate: '2026-07-12',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(rejected.ok, false);
  if (!rejected.ok) {
    assert.equal(rejected.code, 'overlapping_seasonal_rules');
  }

  // Inactive overlapping rule is ignored and does NOT block calculation
  const withInactive = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [ruleA, { ...ruleB, is_active: false }],
    pickupDate: '2026-07-09',
    returnDate: '2026-07-12',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(withInactive.ok, true);

  // PostgreSQL exclusion_violation (23P01) maps to French HTTP 409
  const mapped409 = mapSeasonalRateDbError({
    code: '23P01',
    message:
      'conflicting key value violates exclusion constraint "vehicle_seasonal_rates_no_overlap_active"',
  });
  assert.equal(mapped409.status, 409);
  assert.match(mapped409.message, /chevauche/i);
  assert.ok(mapped409.fieldErrors?.start_date);
});

test('10. Rental spanning standard and seasonal days never lets package blocks cross seasonal dates', () => {
  // Seasonal rule on Jul 5..6 (2 days @ 160,000)
  const midSeasonal = makeRule({
    id: 'rule-mid',
    start_date: '2026-07-05',
    end_date: '2026-07-06',
    daily_rate_minor: 160_000,
  });

  // Rental [2026-07-01, 2026-07-11) = 10 days:
  //   Segment 1: Jul 1..4 (4 standard days) -> cannot use 7-day package -> 4 × 100k = 400k
  //   Segment 2: Jul 5..6 (2 seasonal days) -> 2 × 160k = 320k
  //   Segment 3: Jul 7..10 (4 standard days) -> cannot merge with Segment 1 -> 4 × 100k = 400k
  // Total = 1,120,000 (even though total standard days = 8 >= 7!)
  const splitNonCrossing = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [midSeasonal],
    pickupDate: '2026-07-01',
    returnDate: '2026-07-11',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(splitNonCrossing.ok, true);
  if (!splitNonCrossing.ok) return;
  assert.equal(splitNonCrossing.chargedDays, 10);
  assert.equal(splitNonCrossing.standardDays, 8);
  assert.equal(splitNonCrossing.seasonalDays, 2);
  assert.equal(splitNonCrossing.appliedPackages.weeklyCount, 0);
  assert.equal(splitNonCrossing.appliedPackages.standardDailyCount, 8);
  assert.equal(splitNonCrossing.appliedPackages.seasonalDailyCount, 2);
  assert.equal(splitNonCrossing.subtotalMinor, 1_120_000);
  assert.equal(splitNonCrossing.segments.length, 3);

  // Rental [2026-06-28, 2026-07-14) = 16 days:
  //   Segment 1: Jun 28..Jul 4 (7 contiguous standard days) -> 1 × 7-day package = 630k
  //   Segment 2: Jul 5..6 (2 seasonal days) -> 2 × 160k = 320k
  //   Segment 3: Jul 7..13 (7 contiguous standard days) -> 1 × 7-day package = 630k
  // Total = 1,580,000
  const twoWeeklySegments = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [midSeasonal],
    pickupDate: '2026-06-28',
    returnDate: '2026-07-14',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(twoWeeklySegments.ok, true);
  if (!twoWeeklySegments.ok) return;
  assert.equal(twoWeeklySegments.appliedPackages.weeklyCount, 2);
  assert.equal(twoWeeklySegments.appliedPackages.standardDailyCount, 0);
  assert.equal(twoWeeklySegments.appliedPackages.seasonalDailyCount, 2);
  assert.equal(twoWeeklySegments.subtotalMinor, 1_580_000);
});

test('11. Millimes integer arithmetic and 3-decimal TND formatting avoid floating-point drift', () => {
  // 115.335 TND × 3 days = 346.005 TND exact (346005 millimes)
  assert.equal(parseTndToMillimes('115,335'), 115_335);
  assert.equal(parseTndToMillimes('115.3355'), null); // 4 decimals rejected

  const result = calculateRentalPricePreview({
    vehicle: {
      daily_rate_minor: 115_335,
      weekly_rate_minor: null,
      monthly_rate_minor: null,
    },
    seasonalRules: [],
    pickupDate: '2026-05-01',
    returnDate: '2026-05-04',
    agencyTimeZone: 'Africa/Tunis',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.subtotalMinor, 346_005);
  assert.equal(result.totalFormattedTnd, formatTndFromMillimes(346_005, 'fr'));
  assert.match(result.totalFormattedTnd, /346[.,]005\s+TND/);
});

test('12. Invalid date ranges (same day, reversed, invalid calendar, overly long) are rejected', () => {
  const sameDay = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-05-10',
    returnDate: '2026-05-10',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(sameDay.ok, false);
  if (!sameDay.ok) assert.equal(sameDay.code, 'invalid_date_range');

  const reversed = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-05-12',
    returnDate: '2026-05-10',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(reversed.ok, false);
  if (!reversed.ok) assert.equal(reversed.code, 'invalid_date_range');

  const invalidLeap = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-02-29',
    returnDate: '2026-03-02',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(invalidLeap.ok, false);
  if (!invalidLeap.ok) assert.equal(invalidLeap.code, 'invalid_pickup_date');

  const tooLong = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-01-01',
    returnDate: '2040-01-01',
    agencyTimeZone: 'Africa/Tunis',
  });
  assert.equal(tooLong.ok, false);
  if (!tooLong.ok) assert.equal(tooLong.code, 'range_too_long');

  const reversedSeasonal = validateSeasonalRatePayload({
    start_date: '2026-07-20',
    end_date: '2026-07-10',
    daily_rate_tnd: '150,000',
  });
  assert.equal(reversedSeasonal.valid, false);
  assert.ok(reversedSeasonal.errors.end_date);
});

test('13. Agency timezone boundary governs agencyTodayDate around midnight UTC', () => {
  const nearMidnightUtc = new Date('2026-07-09T23:30:00.000Z');

  const tunis = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-07-10',
    returnDate: '2026-07-11',
    agencyTimeZone: 'Africa/Tunis',
    now: nearMidnightUtc,
  });
  assert.equal(tunis.ok, true);
  if (!tunis.ok) return;
  assert.equal(tunis.agencyTimeZone, 'Africa/Tunis');
  assert.equal(tunis.agencyTodayDate, '2026-07-10');

  const newYork = calculateRentalPricePreview({
    vehicle: BASE_VEHICLE_PRICING,
    seasonalRules: [],
    pickupDate: '2026-07-10',
    returnDate: '2026-07-11',
    agencyTimeZone: 'America/New_York',
    now: nearMidnightUtc,
  });
  assert.equal(newYork.ok, true);
  if (!newYork.ok) return;
  assert.equal(newYork.agencyTimeZone, 'America/New_York');
  assert.equal(newYork.agencyTodayDate, '2026-07-09');
});

test('14. Owner/Manager/Agent permissions are enforced on pricing & seasonal-rate endpoints', () => {
  assert.equal(canManageVehicles('owner'), true);
  assert.equal(canManageVehicles('manager'), true);
  assert.equal(canManageVehicles('agent'), false);

  const seasonalListRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/[id]/seasonal-rates/route.ts'),
    'utf8'
  );
  const seasonalItemRoute = fs.readFileSync(
    path.join(
      process.cwd(),
      'app/api/vehicles/[id]/seasonal-rates/[rateId]/route.ts'
    ),
    'utf8'
  );

  assert.match(seasonalListRoute, /canManageVehicles\(ctx\.activeMembership\.role\)/);
  assert.match(seasonalItemRoute, /canManageVehicles\(ctx\.activeMembership\.role\)/);
  assert.match(seasonalListRoute, /isTrustedOriginRequest/);
  assert.match(seasonalItemRoute, /isTrustedOriginRequest/);
  assert.match(seasonalListRoute, /NO_STORE_CACHE_HEADERS/);
  assert.match(seasonalItemRoute, /NO_STORE_CACHE_HEADERS/);
  assert.doesNotMatch(seasonalListRoute, /export\s+async\s+function\s+DELETE/);
  assert.doesNotMatch(seasonalItemRoute, /export\s+async\s+function\s+DELETE/);
});

test('15. Cross-agency isolation and migration 0005 safety detection are enforced server-side', () => {
  const seasonalListRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/[id]/seasonal-rates/route.ts'),
    'utf8'
  );
  const seasonalItemRoute = fs.readFileSync(
    path.join(
      process.cwd(),
      'app/api/vehicles/[id]/seasonal-rates/[rateId]/route.ts'
    ),
    'utf8'
  );

  // Both routes verify vehicle belongs to ctx.activeAgency.id and derive agency_id from verified server context
  assert.match(seasonalListRoute, /\.eq\('agency_id',\s*ctx\.activeAgency\.id\)/);
  assert.match(seasonalListRoute, /agency_id:\s*ctx\.activeAgency\.id/);
  assert.match(seasonalListRoute, /created_by:\s*ctx\.user\.id/);
  assert.match(seasonalItemRoute, /\.eq\('agency_id',\s*ctx\.activeAgency\.id\)/);
  assert.match(seasonalItemRoute, /\.eq\('vehicle_id',\s*id\)/);
  assert.doesNotMatch(seasonalListRoute, /service_role/i);
  assert.doesNotMatch(seasonalItemRoute, /service_role/i);

  // Migration 0005 missing columns & missing table detection
  assert.equal(
    isMissingPricingColumnError({
      code: '42703',
      message: 'column vehicles.weekly_rate_minor does not exist',
    }),
    true
  );
  assert.equal(
    isMissingPricingColumnError({
      code: 'PGRST204',
      message:
        "Could not find the 'monthly_rate_minor' column of 'vehicles' in the schema cache",
    }),
    true
  );
  assert.equal(
    isMissingSeasonalRatesTableError({
      code: '42P01',
      message: 'relation "public.vehicle_seasonal_rates" does not exist',
    }),
    true
  );
  assert.equal(
    isMissingSeasonalRatesTableError({
      code: 'PGRST205',
      message:
        "Could not find the table 'public.vehicle_seasonal_rates' in the schema cache",
    }),
    true
  );

  const mappedVehicle503 = mapVehicleDbError({
    code: '42703',
    message: 'column vehicles.weekly_rate_minor does not exist',
  });
  assert.equal(mappedVehicle503.status, 503);
  assert.equal(mappedVehicle503.missingPricingColumns, true);

  const mappedSeasonal503 = mapSeasonalRateDbError({
    code: '42P01',
    message: 'relation "public.vehicle_seasonal_rates" does not exist',
  });
  assert.equal(mappedSeasonal503.status, 503);
  assert.equal(mappedSeasonal503.missingPricingSchema, true);
});

test('16. Regression: existing vehicle CRUD validation, form conversion, and compliance remain intact with package rates', () => {
  const valid = validateVehiclePayload({
    plate_number: '214 TU 4821',
    brand: 'Peugeot',
    model: '208',
    daily_rate_tnd: '110,000',
    weekly_rate_tnd: '680,500',
    monthly_rate_tnd: '2500,000',
    deposit_tnd: '1500,000',
    insurance_expires_on: '2027-06-01',
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.daily_rate_minor, 110_000);
  assert.equal(valid.data?.weekly_rate_minor, 680_500);
  assert.equal(valid.data?.monthly_rate_minor, 2_500_000);
  assert.equal(valid.data?.insurance_expires_on, '2027-06-01');

  const sampleRecord: VehicleRecord = {
    id: '11111111-1111-4111-8111-111111111111',
    agency_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    plate_number: '214 TU 4821',
    vin: null,
    brand: 'Peugeot',
    model: '208',
    model_year: 2024,
    category: 'compact',
    transmission: 'manual',
    fuel_type: 'petrol',
    seats: 5,
    odometer_km: 12000,
    daily_rate_minor: 110_000,
    weekly_rate_minor: 680_500,
    monthly_rate_minor: null,
    deposit_minor: 1_500_000,
    currency_code: 'TND',
    status: 'available',
    notes: null,
    insurance_expires_on: '2027-06-01',
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
  };

  const formValues = vehicleRecordToFormValues(sampleRecord);
  assert.equal(formValues.daily_rate_tnd, '110,000');
  assert.equal(formValues.weekly_rate_tnd, '680,500');
  assert.equal(formValues.monthly_rate_tnd, '');

  const compliance = evaluateVehicleCompliance(sampleRecord, {
    timeZone: 'Africa/Tunis',
    now: new Date('2026-11-22T12:00:00.000Z'),
  });
  assert.equal(compliance.overallStatus, 'valid');
  assert.equal(compliance.validCount, 1);
});

test('17. Regression (Issue 1): seasonal toggle clears stale loadError on retry and success while preserving HTTP 409 error display', () => {
  const overlapError = mapSeasonalRateDbError({
    code: '23P01',
    message:
      'conflicting key value violates exclusion constraint "vehicle_seasonal_rates_no_overlap_active"',
  });
  assert.equal(overlapError.status, 409);

  let state = {
    togglingId: null as string | null,
    loadError: null as string | null,
    formError: null as string | null,
    feedback: null as string | null,
  };

  // 1. Start reactivation attempt
  state = reduceSeasonalToggleUiState(state, {
    type: 'start',
    rateId: 'rate-1',
  });
  assert.equal(state.togglingId, 'rate-1');
  assert.equal(state.loadError, null);
  assert.equal(state.feedback, null);

  // 2. Reactivation fails with HTTP 409 overlap message
  state = reduceSeasonalToggleUiState(state, {
    type: 'failure',
    error: overlapError.message,
  });
  assert.equal(state.togglingId, null);
  assert.equal(state.loadError, overlapError.message);
  assert.equal(state.feedback, null);

  // 3. Next toggle attempt immediately clears stale loadError
  state = reduceSeasonalToggleUiState(state, {
    type: 'start',
    rateId: 'rate-2',
  });
  assert.equal(state.togglingId, 'rate-2');
  assert.equal(state.loadError, null);

  // 4. Subsequent success keeps loadError cleared and shows French feedback
  state = reduceSeasonalToggleUiState(state, {
    type: 'success',
    isActive: false,
  });
  assert.equal(state.togglingId, null);
  assert.equal(state.loadError, null);
  assert.equal(state.feedback, 'Tarif saisonnier désactivé.');

  // 5. Direct success even from an errored state also clears stale loadError
  const recovered = reduceSeasonalToggleUiState(
    {
      togglingId: 'rate-1',
      loadError: overlapError.message,
      formError: null,
      feedback: null,
    },
    { type: 'success', isActive: true }
  );
  assert.equal(recovered.loadError, null);
  assert.equal(recovered.togglingId, null);
  assert.equal(recovered.feedback, 'Tarif saisonnier réactivé.');

  // Verify VehiclePricingSection uses applyToggleUiAction / reduceSeasonalToggleUiState
  const componentSrc = fs.readFileSync(
    path.join(process.cwd(), 'components/vehicles/vehicle-pricing-section.tsx'),
    'utf8'
  );
  assert.match(componentSrc, /applyToggleUiAction\(\{\s*type:\s*'start'/);
  assert.match(componentSrc, /applyToggleUiAction\(\{\s*type:\s*'failure'/);
  assert.match(componentSrc, /applyToggleUiAction\(\{\s*type:\s*'success'/);
});

test('18. Regression (Issue 2): listAgencyVehiclesWithClient distinguishes confirmed schema, missing schema, and unexpected DB errors', async () => {
  type QueryResult = {
    data: Record<string, unknown>[] | null;
    error: { code?: string; message?: string } | null;
  };

  function makeStubClient(
    responder: (selectColumns: string) => QueryResult
  ): Parameters<typeof listAgencyVehiclesWithClient>[0] {
    return {
      from() {
        return {
          select(columns: string) {
            return {
              eq() {
                return {
                  order: async () => responder(columns),
                };
              },
            };
          },
        };
      },
    } as unknown as Parameters<typeof listAgencyVehiclesWithClient>[0];
  }

  const sampleRow: Record<string, unknown> = {
    id: '11111111-1111-4111-8111-111111111111',
    agency_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    plate_number: '214 TU 4821',
    vin: null,
    brand: 'Peugeot',
    model: '208',
    model_year: 2024,
    category: 'compact',
    transmission: 'manual',
    fuel_type: 'petrol',
    seats: 5,
    odometer_km: 12000,
    daily_rate_minor: 110_000,
    weekly_rate_minor: 680_000,
    monthly_rate_minor: 2_500_000,
    deposit_minor: 1_500_000,
    currency_code: 'TND',
    status: 'available',
    notes: null,
    insurance_expires_on: '2027-06-01',
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
  };

  // Case A: Confirmed migration 0005 schema -> pricingSchemaReady = true
  const readyRes = await listAgencyVehiclesWithClient(
    makeStubClient((cols) => {
      assert.equal(cols, VEHICLE_SELECT_COLUMNS);
      return { data: [sampleRow], error: null };
    }),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  assert.equal(readyRes.error, null);
  assert.equal(readyRes.pricingSchemaReady, true);
  assert.equal(readyRes.pricingSchemaStatus, 'ready');
  assert.equal(readyRes.complianceSchemaReady, true);
  assert.equal(readyRes.complianceSchemaStatus, 'ready');
  assert.equal(readyRes.vehicles.length, 1);

  // Case B: Unrelated database error -> MUST NOT report pricingSchemaReady = true and MUST preserve error
  const genericErrRes = await listAgencyVehiclesWithClient(
    makeStubClient(() => ({
      data: null,
      error: { code: '57014', message: 'canceling statement due to statement timeout' },
    })),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  assert.ok(genericErrRes.error);
  assert.equal(genericErrRes.pricingSchemaReady, false);
  assert.equal(genericErrRes.pricingSchemaStatus, 'unverified');
  assert.equal(genericErrRes.complianceSchemaReady, false);
  assert.equal(genericErrRes.complianceSchemaStatus, 'unverified');
  assert.deepEqual(genericErrRes.vehicles, []);

  // Case C: Missing migration 0005 columns -> falls back cleanly to compliance columns with status = 'missing'
  const missing0005Res = await listAgencyVehiclesWithClient(
    makeStubClient((cols) => {
      if (cols === VEHICLE_SELECT_COLUMNS) {
        return {
          data: null,
          error: {
            code: '42703',
            message: 'column vehicles.weekly_rate_minor does not exist',
          },
        };
      }
      assert.equal(cols, VEHICLE_COMPLIANCE_SELECT_COLUMNS);
      const { weekly_rate_minor: _w, monthly_rate_minor: _m, ...complianceRow } = sampleRow;
      void _w;
      void _m;
      return { data: [complianceRow], error: null };
    }),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  assert.equal(missing0005Res.error, null);
  assert.equal(missing0005Res.pricingSchemaReady, false);
  assert.equal(missing0005Res.pricingSchemaStatus, 'missing');
  assert.equal(missing0005Res.complianceSchemaReady, true);
  assert.equal(missing0005Res.complianceSchemaStatus, 'ready');
  assert.equal(missing0005Res.vehicles.length, 1);
  assert.equal(missing0005Res.vehicles[0].weekly_rate_minor, null);

  // Case D: Missing migration 0005 followed by unexpected DB error on compliance fallback
  const fallbackErrRes = await listAgencyVehiclesWithClient(
    makeStubClient((cols) => {
      if (cols === VEHICLE_SELECT_COLUMNS) {
        return {
          data: null,
          error: {
            code: '42703',
            message: 'column vehicles.weekly_rate_minor does not exist',
          },
        };
      }
      return {
        data: null,
        error: { code: '42501', message: 'permission denied for table vehicles' },
      };
    }),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  assert.ok(fallbackErrRes.error);
  assert.equal(fallbackErrRes.pricingSchemaReady, false);
  assert.equal(fallbackErrRes.pricingSchemaStatus, 'missing');
  assert.equal(fallbackErrRes.complianceSchemaReady, false);
  assert.equal(fallbackErrRes.complianceSchemaStatus, 'unverified');

  // Case E: Missing both 0005 and 0004 -> falls back cleanly to base columns
  const missingBothRes = await listAgencyVehiclesWithClient(
    makeStubClient((cols) => {
      if (cols === VEHICLE_SELECT_COLUMNS) {
        return {
          data: null,
          error: {
            code: '42703',
            message: 'column vehicles.weekly_rate_minor does not exist',
          },
        };
      }
      if (cols === VEHICLE_COMPLIANCE_SELECT_COLUMNS) {
        return {
          data: null,
          error: {
            code: '42703',
            message: 'column vehicles.insurance_expires_on does not exist',
          },
        };
      }
      assert.equal(cols, VEHICLE_BASE_SELECT_COLUMNS);
      return { data: [sampleRow], error: null };
    }),
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  );
  assert.equal(missingBothRes.error, null);
  assert.equal(missingBothRes.pricingSchemaReady, false);
  assert.equal(missingBothRes.pricingSchemaStatus, 'missing');
  assert.equal(missingBothRes.complianceSchemaReady, false);
  assert.equal(missingBothRes.complianceSchemaStatus, 'missing');
  assert.equal(missingBothRes.vehicles.length, 1);
});

