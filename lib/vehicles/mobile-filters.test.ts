import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  applyMobileVehicleFilters,
  resetMobileVehicleFilters,
} from '@/lib/vehicles/mobile-filters';
import { DEFAULT_VEHICLE_FILTERS } from '@/lib/vehicles/types';

test('mobile filter changes remain a separate draft until Apply', () => {
  const applied = { ...DEFAULT_VEHICLE_FILTERS };
  const draft = { ...applied, compliance: 'expired' as const, category: 'suv' };

  assert.equal(applied.compliance, 'all');
  assert.equal(applied.category, 'all');
  const result = applyMobileVehicleFilters(applied, draft);
  assert.equal(result.compliance, 'expired');
  assert.equal(result.category, 'suv');
  assert.equal(applied.compliance, 'all');
});

test('Apply updates only mobile-sheet filters and preserves live search/status', () => {
  const applied = {
    ...DEFAULT_VEHICLE_FILTERS,
    search: 'Peugeot',
    status: 'rented' as const,
  };
  const staleDraft = {
    ...DEFAULT_VEHICLE_FILTERS,
    compliance: 'expiring_soon' as const,
    sortBy: 'rate_asc' as const,
  };
  const next = applyMobileVehicleFilters(applied, staleDraft);

  assert.equal(next.search, 'Peugeot');
  assert.equal(next.status, 'rented');
  assert.equal(next.compliance, 'expiring_soon');
  assert.equal(next.sortBy, 'rate_asc');
});

test('Reset clears sheet controls without erasing search or status', () => {
  const draft = {
    ...DEFAULT_VEHICLE_FILTERS,
    search: 'Clio',
    status: 'available' as const,
    compliance: 'expired' as const,
    fuelType: 'diesel' as const,
    category: 'compact',
    transmission: 'automatic' as const,
    sortBy: 'brand_asc' as const,
  };
  const reset = resetMobileVehicleFilters(draft);
  assert.equal(reset.search, 'Clio');
  assert.equal(reset.status, 'available');
  assert.equal(reset.compliance, 'all');
  assert.equal(reset.category, 'all');
  assert.equal(reset.transmission, 'all');
  assert.equal(reset.fuelType, 'all');
  assert.equal(reset.sortBy, 'newest');
  assert.equal(draft.compliance, 'expired');
});

test('Apply keeps all five secondary controls without mutating the draft', () => {
  const draft = {
    ...DEFAULT_VEHICLE_FILTERS,
    compliance: 'valid' as const,
    category: 'suv',
    transmission: 'manual' as const,
    fuelType: 'hybrid' as const,
    sortBy: 'mileage_asc' as const,
  };
  const result = applyMobileVehicleFilters(DEFAULT_VEHICLE_FILTERS, draft);
  for (const key of ['compliance', 'category', 'transmission', 'fuelType', 'sortBy'] as const) {
    assert.equal(result[key], draft[key]);
  }
  assert.equal(DEFAULT_VEHICLE_FILTERS.category, 'all');
});

test('Vehicles mobile sheet uses draft preview, reset and deliberate Apply', () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), 'components/vehicles/vehicles-workspace.tsx'),
    'utf8'
  );
  const sheet = source.split('{/* Mobile Slide-Up Filter Bottom Sheet */}')[1];
  assert.ok(sheet, 'mobile filter sheet must exist');
  assert.match(sheet, /mobileDraftFilters\.compliance/);
  assert.match(sheet, /mobileDraftFilters\.category/);
  assert.match(sheet, /mobileDraftFilters\.sortBy/);
  assert.match(sheet, /applyMobileFilters/);
  assert.match(sheet, /resetMobileVehicleFilters/);
  assert.match(sheet, /mobilePreviewCount/);
  assert.doesNotMatch(sheet, /setFilters\(\(prev\) =>/);
});
