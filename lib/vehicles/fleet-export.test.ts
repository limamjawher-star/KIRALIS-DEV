import assert from 'node:assert/strict';
import test from 'node:test';
import { buildFleetCsv, escapeFleetCsvCell, fleetTndAmount } from './fleet-export';
import { getVehiclesCopy } from './i18n';
import type { VehicleRecord } from './types';

const vehicle: VehicleRecord = {
  id: 'vehicle-1',
  agency_id: 'agency-1',
  plate_number: '214 TU 4821',
  vin: 'PRIVATE_VIN_DO_NOT_EXPORT',
  brand: 'Renault',
  model: 'Clio',
  model_year: 2023,
  category: 'compact',
  transmission: 'manual',
  fuel_type: 'petrol',
  seats: 5,
  odometer_km: 21000,
  daily_rate_minor: 123456,
  weekly_rate_minor: null,
  monthly_rate_minor: 2600000,
  deposit_minor: 0,
  currency_code: 'TND',
  status: 'available',
  notes: 'PRIVATE_NOTES_DO_NOT_EXPORT',
  insurance_expires_on: '2027-02-15',
  technical_inspection_expires_on: null,
  vignette_expires_on: '2027-03-20',
  created_by: 'private-user',
  created_at: '2026-11-20T10:00:00Z',
  updated_at: '2026-11-21T10:00:00Z',
};

test('CSV export produces UTF-8 BOM, localized headings and CRLF for FR/EN/AR', () => {
  for (const locale of ['fr', 'en', 'ar'] as const) {
    const copy = getVehiclesCopy(locale);
    const csv = buildFleetCsv([vehicle], copy);
    assert.ok(csv.startsWith('\uFEFF'));
    assert.ok(csv.endsWith('\r\n'));
    assert.ok(csv.includes(escapeFleetCsvCell(copy.form.fieldPlate)));
    assert.ok(csv.includes(escapeFleetCsvCell(copy.statuses.available)));
    assert.ok(csv.includes(escapeFleetCsvCell(copy.categories.compact)));
    assert.equal(csv.split('\r\n').length, 3);
  }
});

test('Export only approved business fields with exact three-decimal TND values', () => {
  const csv = buildFleetCsv([vehicle], getVehiclesCopy('en'));
  assert.ok(csv.includes('"123.456"'));
  assert.ok(csv.includes('"2600.000"'));
  assert.ok(csv.includes('"0.000"'));
  assert.ok(csv.includes('"2027-02-15"'));
  assert.ok(csv.includes('"214 TU 4821"'));
  assert.ok(!csv.includes('PRIVATE_VIN_DO_NOT_EXPORT'));
  assert.ok(!csv.includes('PRIVATE_NOTES_DO_NOT_EXPORT'));
  assert.ok(!csv.includes('private-user'));
  assert.ok(!csv.includes('agency-1'));
  assert.equal(fleetTndAmount(null), '');
  assert.equal(fleetTndAmount(-1000), '');
  assert.equal(fleetTndAmount(Number.NaN), '');
});

test('Formula injection and CSV metacharacters are escaped for user-controlled fields', () => {
  for (const malicious of [
    '=HYPERLINK("https://example.invalid")',
    '+SUM(1,2)',
    '-1+2',
    '@SUM(2,3)',
    '\t=HYPERLINK("url")',
    '  =2+3',
    '\uFEFF=1+1',
  ]) {
    const csv = buildFleetCsv([{ ...vehicle, brand: malicious }], getVehiclesCopy('fr'));
    assert.ok(csv.includes(escapeFleetCsvCell(malicious)));
    assert.ok(escapeFleetCsvCell(malicious).startsWith('"\''), malicious);
  }
  assert.equal(escapeFleetCsvCell('A,"B"\nC'), '"A,""B""\nC"');
});

test('Exports the supplied selection, not other fleet rows', () => {
  const other = { ...vehicle, plate_number: 'OTHER-PLATE', model: 'Megane' };
  const csv = buildFleetCsv([vehicle], getVehiclesCopy('fr'));
  assert.ok(csv.includes(vehicle.plate_number));
  assert.ok(!csv.includes(other.plate_number));
  assert.equal(buildFleetCsv([], getVehiclesCopy('fr')).split('\r\n').length, 2);
});

test('Localized custom categories are preserved, but CSV injection still blocked', () => {
  const csv = buildFleetCsv(
    [{ ...vehicle, category: '=CMD()' }],
    getVehiclesCopy('en')
  );
  assert.ok(csv.includes('"\'=CMD()"'));
});
