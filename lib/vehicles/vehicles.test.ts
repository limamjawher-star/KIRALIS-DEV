import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  canManageVehicles,
  DEFAULT_VEHICLE_FILTERS,
  formatMinorToEditableTnd,
  vehicleRecordToFormValues,
  type VehicleRecord,
} from './types';
import {
  computeFleetSummary,
  filterAndSortVehicles,
  mapVehicleDbError,
  normalizePlateNumber,
  validateStatusOnlyPatch,
  validateVehiclePayload,
} from './validation';

const SAMPLE_VEHICLES: VehicleRecord[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    agency_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    plate_number: '214 TU 4821',
    vin: 'VF3UBHMZ6JS123456',
    brand: 'Peugeot',
    model: '208',
    model_year: 2024,
    category: 'compact',
    transmission: 'manual',
    fuel_type: 'petrol',
    seats: 5,
    odometer_km: 18500,
    daily_rate_minor: 110000,
    weekly_rate_minor: null,
    monthly_rate_minor: null,
    deposit_minor: 1500000,
    currency_code: 'TND',
    status: 'available',
    notes: 'Climatisation auto',
    insurance_expires_on: null,
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-18T10:00:00.000Z',
    updated_at: '2026-11-18T10:00:00.000Z',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    agency_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    plate_number: '225 TU 1099',
    vin: null,
    brand: 'Hyundai',
    model: 'Tucson',
    model_year: 2025,
    category: 'suv',
    transmission: 'automatic',
    fuel_type: 'hybrid',
    seats: 5,
    odometer_km: 6200,
    daily_rate_minor: 245500,
    weekly_rate_minor: null,
    monthly_rate_minor: null,
    deposit_minor: 3000000,
    currency_code: 'TND',
    status: 'rented',
    notes: null,
    insurance_expires_on: null,
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-20T12:00:00.000Z',
    updated_at: '2026-11-20T12:00:00.000Z',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    agency_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    plate_number: '198 TU 7712',
    vin: null,
    brand: 'Dacia',
    model: 'Duster',
    model_year: 2021,
    category: 'suv',
    transmission: 'manual',
    fuel_type: 'diesel',
    seats: 5,
    odometer_km: 94200,
    daily_rate_minor: 140000,
    weekly_rate_minor: null,
    monthly_rate_minor: null,
    deposit_minor: 2000000,
    currency_code: 'TND',
    status: 'retired',
    notes: 'Sorti de flotte',
    insurance_expires_on: null,
    technical_inspection_expires_on: null,
    vignette_expires_on: null,
    created_by: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    created_at: '2026-11-10T08:00:00.000Z',
    updated_at: '2026-11-19T14:00:00.000Z',
  },
];

test('normalizePlateNumber trims, collapses spaces, and uppercases Tunisian plates', () => {
  assert.equal(normalizePlateNumber('  214   tu  4821 '), '214 TU 4821');
  assert.equal(normalizePlateNumber('rs 123456'), 'RS 123456');
});

test('validateVehiclePayload accepts valid Tunisian vehicle with exact integer TND millimes', () => {
  const result = validateVehiclePayload({
    plate_number: ' 214 tu 4821 ',
    brand: 'Peugeot',
    model: '208',
    model_year: '2024',
    category: 'compact',
    transmission: 'manual',
    fuel_type: 'petrol',
    seats: '5',
    odometer_km: '18500',
    daily_rate_tnd: '115,750',
    deposit_tnd: '1500,000',
    status: 'available',
    vin: ' vf3ubhmz6js123456 ',
    notes: ' Véhicule neuf ',
  });

  assert.equal(result.valid, true);
  assert.ok(result.data);
  assert.equal(result.data.plate_number, '214 TU 4821');
  assert.equal(result.data.daily_rate_minor, 115750);
  assert.equal(result.data.deposit_minor, 1500000);
  assert.equal(result.data.odometer_km, 18500);
  assert.equal(result.data.seats, 5);
  assert.equal(result.data.model_year, 2024);
  assert.equal(result.data.vin, 'VF3UBHMZ6JS123456');
  assert.equal(result.data.notes, 'Véhicule neuf');
});

test('validateVehiclePayload rejects negative prices, negative mileage, excessive decimals, and invalid enums', () => {
  const result = validateVehiclePayload({
    plate_number: 'A',
    brand: '',
    model: '',
    model_year: '1970',
    category: 'x',
    transmission: 'cvt',
    fuel_type: 'nuclear',
    seats: '0',
    odometer_km: '-10',
    daily_rate_tnd: '-50,000',
    deposit_tnd: '10,1234',
    status: 'deleted',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.plate_number);
  assert.ok(result.errors.brand);
  assert.ok(result.errors.model);
  assert.ok(result.errors.model_year);
  assert.ok(result.errors.category);
  assert.ok(result.errors.transmission);
  assert.ok(result.errors.fuel_type);
  assert.ok(result.errors.seats);
  assert.ok(result.errors.odometer_km);
  assert.ok(result.errors.daily_rate_minor);
  assert.ok(result.errors.deposit_minor);
  assert.ok(result.errors.status);
});

test('validateVehiclePayload accepts integer minor units directly on API payloads', () => {
  const result = validateVehiclePayload({
    plate_number: '230 TU 9001',
    brand: 'Kia',
    model: 'Picanto',
    model_year: null,
    category: 'economy',
    transmission: 'automatic',
    fuel_type: 'petrol',
    seats: 4,
    odometer_km: 0,
    daily_rate_minor: 95000,
    deposit_minor: 1000000,
    status: 'available',
  });

  assert.equal(result.valid, true);
  assert.equal(result.data?.daily_rate_minor, 95000);
  assert.equal(result.data?.deposit_minor, 1000000);
  assert.equal(result.data?.model_year, null);
});

test('validateStatusOnlyPatch allows valid lifecycle transitions including retired and rejects invalid status', () => {
  assert.deepEqual(validateStatusOnlyPatch({ status: 'retired' }), {
    valid: true,
    status: 'retired',
  });
  assert.deepEqual(validateStatusOnlyPatch({ status: 'available' }), {
    valid: true,
    status: 'available',
  });
  assert.equal(validateStatusOnlyPatch({ status: 'deleted' }).valid, false);
});

test('canManageVehicles grants write access to owner and manager, and read-only to agent', () => {
  assert.equal(canManageVehicles('owner'), true);
  assert.equal(canManageVehicles('manager'), true);
  assert.equal(canManageVehicles('agent'), false);
  assert.equal(canManageVehicles(null), false);
});

test('mapVehicleDbError maps duplicate agency plate (23505) to 409 with field error and RLS (42501) to 403', () => {
  const dup = mapVehicleDbError({
    code: '23505',
    message: 'duplicate key value violates unique constraint "idx_vehicles_agency_plate_unique"',
  });
  assert.equal(dup.status, 409);
  assert.ok(dup.fieldErrors?.plate_number);

  const rls = mapVehicleDbError({
    code: '42501',
    message: 'new row violates row-level security policy for table "vehicles"',
  });
  assert.equal(rls.status, 403);

  const check = mapVehicleDbError({
    code: '23514',
    message: 'new row violates check constraint "vehicles_daily_rate_minor_check"',
  });
  assert.equal(check.status, 400);
});

test('filterAndSortVehicles filters by search, status, transmission, and sorts deterministically', () => {
  const bySearch = filterAndSortVehicles(SAMPLE_VEHICLES, {
    ...DEFAULT_VEHICLE_FILTERS,
    search: 'tucson',
  });
  assert.equal(bySearch.length, 1);
  assert.equal(bySearch[0]?.plate_number, '225 TU 1099');

  const byRetired = filterAndSortVehicles(SAMPLE_VEHICLES, {
    ...DEFAULT_VEHICLE_FILTERS,
    status: 'retired',
  });
  assert.equal(byRetired.length, 1);
  assert.equal(byRetired[0]?.brand, 'Dacia');

  const byRateAsc = filterAndSortVehicles(SAMPLE_VEHICLES, {
    ...DEFAULT_VEHICLE_FILTERS,
    sortBy: 'rate_asc',
  });
  assert.deepEqual(
    byRateAsc.map((v) => v.daily_rate_minor),
    [110000, 140000, 245500]
  );

  const byMileageDesc = filterAndSortVehicles(SAMPLE_VEHICLES, {
    ...DEFAULT_VEHICLE_FILTERS,
    sortBy: 'mileage_desc',
  });
  assert.deepEqual(
    byMileageDesc.map((v) => v.odometer_km),
    [94200, 18500, 6200]
  );
});

test('computeFleetSummary returns exact counts and honest zeros for empty inventory', () => {
  assert.deepEqual(computeFleetSummary([]), {
    totalCount: 0,
    availableCount: 0,
    rentedCount: 0,
    maintenanceCount: 0,
    retiredCount: 0,
  });

  assert.deepEqual(computeFleetSummary(SAMPLE_VEHICLES), {
    totalCount: 3,
    availableCount: 1,
    rentedCount: 1,
    maintenanceCount: 0,
    retiredCount: 1,
  });
});

test('formatMinorToEditableTnd and vehicleRecordToFormValues preserve exact 3-decimal precision', () => {
  assert.equal(formatMinorToEditableTnd(0), '0,000');
  assert.equal(formatMinorToEditableTnd(245500), '245,500');
  assert.equal(formatMinorToEditableTnd(1005), '1,005');

  const form = vehicleRecordToFormValues(SAMPLE_VEHICLES[1]!);
  assert.equal(form.daily_rate_tnd, '245,500');
  assert.equal(form.deposit_tnd, '3000,000');
  assert.equal(form.odometer_km, '6200');
});

test('Vehicle API routes enforce server auth, RBAC, tenant scoping, no-store, and prohibit destructive DELETE', () => {
  const collectionRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/route.ts'),
    'utf8'
  );
  const itemRoute = fs.readFileSync(
    path.join(process.cwd(), 'app/api/vehicles/[id]/route.ts'),
    'utf8'
  );
  const serverModule = fs.readFileSync(
    path.join(process.cwd(), 'lib/vehicles/server.ts'),
    'utf8'
  );
  const vehiclesPage = fs.readFileSync(
    path.join(process.cwd(), 'app/vehicles/page.tsx'),
    'utf8'
  );

  // Dynamic rendering & no-store headers
  assert.match(collectionRoute, /export const dynamic = 'force-dynamic'/);
  assert.match(itemRoute, /export const dynamic = 'force-dynamic'/);
  assert.match(vehiclesPage, /export const dynamic = 'force-dynamic'/);
  assert.match(collectionRoute, /NO_STORE_CACHE_HEADERS/);
  assert.match(itemRoute, /NO_STORE_CACHE_HEADERS/);

  // Auth & RBAC enforcement
  assert.match(serverModule, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(serverModule, /\.auth\.getSession\(/);
  assert.doesNotMatch(serverModule, /service_role/i);
  assert.match(collectionRoute, /isTrustedOriginRequest/);
  assert.match(itemRoute, /isTrustedOriginRequest/);
  assert.match(collectionRoute, /canManageVehicles/);
  assert.match(itemRoute, /canManageVehicles/);

  // Tenant & attribution binding strictly from verified server context
  assert.match(collectionRoute, /agency_id:\s*ctx\.activeAgency\.id/);
  assert.match(collectionRoute, /created_by:\s*ctx\.user\.id/);
  assert.match(itemRoute, /\.eq\('agency_id',\s*ctx\.activeAgency\.id\)/);

  // Destructive DELETE must NOT be exposed in Phase 5A
  assert.doesNotMatch(collectionRoute, /export\s+async\s+function\s+DELETE/);
  assert.doesNotMatch(itemRoute, /export\s+async\s+function\s+DELETE/);
});
