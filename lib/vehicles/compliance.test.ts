import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  computeFleetComplianceSummary,
  DEFAULT_COMPLIANCE_WARNING_DAYS,
  evaluateExpiryDate,
  evaluateVehicleCompliance,
  formatComplianceRelativeDays,
  formatIsoDateFr,
  getTodayIsoDateInTimeZone,
  isValidIsoCalendarDate,
} from './compliance';
import {
  canManageVehicles,
  DEFAULT_VEHICLE_FILTERS,
  type VehicleRecord,
} from './types';
import {
  filterAndSortVehicles,
  isMissingComplianceColumnError,
  mapVehicleDbError,
  validateVehiclePayload,
} from './validation';

function makeVehicle(overrides: Partial<VehicleRecord> = {}): VehicleRecord {
  return {
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
    daily_rate_minor: 110000,
    weekly_rate_minor: null,
    monthly_rate_minor: null,
    deposit_minor: 1500000,
    currency_code: 'TND',
    status: 'available',
    notes: null,
    insurance_expires_on: null,
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-20T10:00:00.000Z',
    updated_at: '2026-11-20T10:00:00.000Z',
    ...overrides,
  };
}

test('1. Valid expiry dates evaluate as valid when strictly beyond warning threshold', () => {
  const now = new Date('2026-11-21T12:00:00.000Z');
  const vehicle = makeVehicle({
    insurance_expires_on: '2027-03-15',
    technical_inspection_expires_on: '2027-06-01',
    vignette_expires_on: '2027-04-05',
  });

  const evaluation = evaluateVehicleCompliance(vehicle, {
    timeZone: 'Africa/Tunis',
    warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
    now,
  });

  assert.equal(evaluation.overallStatus, 'valid');
  assert.equal(evaluation.validCount, 3);
  assert.equal(evaluation.expiredCount, 0);
  assert.equal(evaluation.expiringSoonCount, 0);
  assert.equal(evaluation.notProvidedCount, 0);
  // Operational status is never altered automatically by compliance evaluation
  assert.equal(vehicle.status, 'available');
});

test('2. Expired dates evaluate as expired and surface the most overdue item', () => {
  const now = new Date('2026-11-21T12:00:00.000Z');
  const vehicle = makeVehicle({
    status: 'available',
    insurance_expires_on: '2026-11-10', // -11 days
    technical_inspection_expires_on: '2026-12-05', // +14 days (expiring_soon)
    vignette_expires_on: '2027-03-31', // valid
  });

  const evaluation = evaluateVehicleCompliance(vehicle, {
    timeZone: 'Africa/Tunis',
    warningThresholdDays: 30,
    now,
  });

  assert.equal(evaluation.overallStatus, 'expired');
  assert.equal(evaluation.expiredCount, 1);
  assert.equal(evaluation.expiringSoonCount, 1);
  assert.equal(evaluation.validCount, 1);
  assert.equal(evaluation.mostUrgentItem?.key, 'insurance');
  assert.equal(evaluation.mostUrgentItem?.daysRemaining, -11);
  assert.equal(vehicle.status, 'available');
});

test('3. Warning threshold boundaries (-1, 0, 30, 31 days and custom threshold) are exact', () => {
  const ref = '2026-11-21';

  // Yesterday -> expired
  assert.deepEqual(evaluateExpiryDate('2026-11-20', ref, 30), {
    status: 'expired',
    daysRemaining: -1,
  });

  // Today (0 days) -> expiring_soon
  assert.deepEqual(evaluateExpiryDate('2026-11-21', ref, 30), {
    status: 'expiring_soon',
    daysRemaining: 0,
  });

  // Exactly 30 days ahead -> expiring_soon
  assert.deepEqual(evaluateExpiryDate('2026-12-21', ref, 30), {
    status: 'expiring_soon',
    daysRemaining: 30,
  });

  // 31 days ahead -> valid
  assert.deepEqual(evaluateExpiryDate('2026-12-22', ref, 30), {
    status: 'valid',
    daysRemaining: 31,
  });

  // Custom configurable threshold (15 days)
  assert.equal(evaluateExpiryDate('2026-12-06', ref, 15).status, 'expiring_soon');
  assert.equal(evaluateExpiryDate('2026-12-07', ref, 15).status, 'valid');
});

test('4. Missing dates evaluate as not_provided without triggering false warnings', () => {
  const now = new Date('2026-11-21T12:00:00.000Z');
  const emptyVehicle = makeVehicle();

  const evalAllMissing = evaluateVehicleCompliance(emptyVehicle, {
    timeZone: 'Africa/Tunis',
    now,
  });
  assert.equal(evalAllMissing.overallStatus, 'not_provided');
  assert.equal(evalAllMissing.notProvidedCount, 3);
  assert.equal(evalAllMissing.mostUrgentItem, null);

  // Partial: 1 valid + 2 missing => overall valid (missing does not fail valid)
  const partialVehicle = makeVehicle({
    insurance_expires_on: '2027-05-01',
  });
  const evalPartial = evaluateVehicleCompliance(partialVehicle, {
    timeZone: 'Africa/Tunis',
    now,
  });
  assert.equal(evalPartial.overallStatus, 'valid');
  assert.equal(evalPartial.validCount, 1);
  assert.equal(evalPartial.notProvidedCount, 2);
});

test('5. Agency timezone governs calendar date rollover around midnight UTC', () => {
  // 2026-11-21 23:30 UTC is:
  // - 2026-11-22 00:30 in Africa/Tunis (UTC+1)
  // - 2026-11-21 18:30 in America/New_York (UTC-5)
  const nearMidnightUtc = new Date('2026-11-21T23:30:00.000Z');

  assert.equal(
    getTodayIsoDateInTimeZone('Africa/Tunis', nearMidnightUtc),
    '2026-11-22'
  );
  assert.equal(
    getTodayIsoDateInTimeZone('America/New_York', nearMidnightUtc),
    '2026-11-21'
  );

  const vehicle = makeVehicle({ insurance_expires_on: '2026-11-21' });

  // In Tunis it is already Nov 22 -> Nov 21 is expired (-1 day)
  const tunisEval = evaluateVehicleCompliance(vehicle, {
    timeZone: 'Africa/Tunis',
    now: nearMidnightUtc,
  });
  assert.equal(tunisEval.overallStatus, 'expired');
  assert.equal(tunisEval.mostUrgentItem?.daysRemaining, -1);

  // In New York it is still Nov 21 -> Nov 21 expires today (0 days, expiring_soon)
  const nyEval = evaluateVehicleCompliance(vehicle, {
    timeZone: 'America/New_York',
    now: nearMidnightUtc,
  });
  assert.equal(nyEval.overallStatus, 'expiring_soon');
  assert.equal(nyEval.mostUrgentItem?.daysRemaining, 0);

  // Invalid timezone falls back safely to Africa/Tunis
  assert.equal(
    getTodayIsoDateInTimeZone('Invalid/Timezone', nearMidnightUtc),
    '2026-11-22'
  );
});

test('6. Server-side date validation accepts optional ISO dates and rejects invalid calendar dates', () => {
  assert.equal(isValidIsoCalendarDate('2026-02-28'), true);
  assert.equal(isValidIsoCalendarDate('2028-02-29'), true); // leap year
  assert.equal(isValidIsoCalendarDate('2026-02-29'), false); // non-leap year
  assert.equal(isValidIsoCalendarDate('2026-04-31'), false);
  assert.equal(isValidIsoCalendarDate('21/11/2026'), false);

  const valid = validateVehiclePayload({
    plate_number: '214 TU 4821',
    brand: 'Peugeot',
    model: '208',
    daily_rate_tnd: '110,000',
    insurance_expires_on: '2027-01-15',
    technical_inspection_expires_on: '',
    vignette_expires_on: null,
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.data?.insurance_expires_on, '2027-01-15');
  assert.equal(valid.data?.technical_inspection_expires_on, null);
  assert.equal(valid.data?.vignette_expires_on, null);

  const invalid = validateVehiclePayload({
    plate_number: '214 TU 4821',
    brand: 'Peugeot',
    model: '208',
    daily_rate_tnd: '110,000',
    insurance_expires_on: '2026-02-30',
    technical_inspection_expires_on: 'not-a-date',
    vignette_expires_on: '1970-01-01',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.insurance_expires_on);
  assert.ok(invalid.errors.technical_inspection_expires_on);
  assert.ok(invalid.errors.vignette_expires_on);
});

test('7. Fleet compliance summary and filters match expired, expiring_soon, valid, and missing vehicles accurately', () => {
  const now = new Date('2026-11-21T12:00:00.000Z');
  const opts = { timeZone: 'Africa/Tunis', warningThresholdDays: 30, now };

  const vehicles = [
    makeVehicle({
      id: 'v-expired',
      plate_number: '201 TU 1001',
      insurance_expires_on: '2026-11-01',
      vignette_expires_on: '2026-11-15',
    }),
    makeVehicle({
      id: 'v-soon',
      plate_number: '202 TU 2002',
      technical_inspection_expires_on: '2026-12-01',
    }),
    makeVehicle({
      id: 'v-both',
      plate_number: '203 TU 3003',
      insurance_expires_on: '2026-10-01', // expired
      technical_inspection_expires_on: '2026-12-10', // expiring_soon
    }),
    makeVehicle({
      id: 'v-valid',
      plate_number: '204 TU 4004',
      insurance_expires_on: '2027-06-01',
    }),
    makeVehicle({
      id: 'v-missing',
      plate_number: '205 TU 5005',
    }),
  ];

  const summary = computeFleetComplianceSummary(vehicles, opts);
  assert.equal(summary.vehiclesWithExpiredCount, 2);
  assert.equal(summary.expiredDocumentsCount, 3);
  assert.equal(summary.vehiclesWithExpiringSoonCount, 2);
  assert.equal(summary.expiringSoonDocumentsCount, 2);
  assert.equal(summary.vehiclesValidCount, 1);
  assert.equal(summary.vehiclesNotProvidedCount, 1);

  const expiredFiltered = filterAndSortVehicles(
    vehicles,
    { ...DEFAULT_VEHICLE_FILTERS, compliance: 'expired' },
    opts
  );
  assert.deepEqual(
    expiredFiltered.map((v) => v.id),
    ['v-expired', 'v-both']
  );

  const soonFiltered = filterAndSortVehicles(
    vehicles,
    { ...DEFAULT_VEHICLE_FILTERS, compliance: 'expiring_soon' },
    opts
  );
  assert.deepEqual(
    soonFiltered.map((v) => v.id),
    ['v-soon', 'v-both']
  );

  const validFiltered = filterAndSortVehicles(
    vehicles,
    { ...DEFAULT_VEHICLE_FILTERS, compliance: 'valid' },
    opts
  );
  assert.deepEqual(
    validFiltered.map((v) => v.id),
    ['v-valid']
  );

  const missingFiltered = filterAndSortVehicles(
    vehicles,
    { ...DEFAULT_VEHICLE_FILTERS, compliance: 'not_provided' },
    opts
  );
  assert.deepEqual(
    missingFiltered.map((v) => v.id),
    ['v-missing']
  );
});

test('8. Missing migration 0004 columns are detected cleanly and formatted dates render in French', () => {
  assert.equal(
    isMissingComplianceColumnError({
      code: '42703',
      message: 'column vehicles.insurance_expires_on does not exist',
    }),
    true
  );
  assert.equal(
    isMissingComplianceColumnError({
      code: 'PGRST204',
      message:
        "Could not find the 'vignette_expires_on' column of 'vehicles' in the schema cache",
    }),
    true
  );
  assert.equal(
    isMissingComplianceColumnError({
      code: '23505',
      message: 'duplicate key value violates unique constraint',
    }),
    false
  );

  const mapped = mapVehicleDbError({
    code: '42703',
    message: 'column vehicles.technical_inspection_expires_on does not exist',
  });
  assert.equal(mapped.status, 503);
  assert.equal(mapped.missingComplianceColumns, true);

  assert.equal(formatIsoDateFr('2026-12-05'), '05/12/2026');
  assert.equal(formatIsoDateFr(null), 'Non renseignée');
  assert.equal(formatComplianceRelativeDays(0), 'Expire aujourd’hui');
  assert.equal(formatComplianceRelativeDays(-1), 'Expiré depuis 1 jour');
  assert.equal(formatComplianceRelativeDays(12), 'Dans 12 jours');
});

test('9. Permissions and tenant isolation remain enforced for compliance fields across API routes', () => {
  assert.equal(canManageVehicles('owner'), true);
  assert.equal(canManageVehicles('manager'), true);
  assert.equal(canManageVehicles('agent'), false);

  const collectionRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/route.ts'),
    'utf8'
  );
  const itemRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/[id]/route.ts'),
    'utf8'
  );

  assert.match(collectionRoute, /insurance_expires_on:\s*validation\.data\.insurance_expires_on/);
  assert.match(collectionRoute, /technical_inspection_expires_on:/);
  assert.match(collectionRoute, /vignette_expires_on:\s*validation\.data\.vignette_expires_on/);
  assert.match(collectionRoute, /\.eq\('agency_id',\s*ctx\.activeAgency\.id\)/);

  assert.match(itemRoute, /insurance_expires_on:\s*validation\.data\.insurance_expires_on/);
  assert.match(itemRoute, /technical_inspection_expires_on:/);
  assert.match(itemRoute, /vignette_expires_on:\s*validation\.data\.vignette_expires_on/);
  assert.match(itemRoute, /\.eq\('agency_id',\s*ctx\.activeAgency\.id\)/);
  assert.doesNotMatch(itemRoute, /export\s+async\s+function\s+DELETE/);
});
