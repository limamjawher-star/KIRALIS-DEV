import assert from 'node:assert/strict';
import test from 'node:test';
import type { ReservationRow } from '@/lib/supabase/database.types';
import { buildDispatchEventIndex, getDayDispatchEvents, getMonthReservations } from './calendar';

const base: ReservationRow = {
  id: 'reservation-1', agency_id: 'agency-1',
  reference_code: 'KRL-01', vehicle_id: 'v1', customer_id: 'c1',
  status: 'confirmed', pickup_at: '2026-12-01T09:00:00Z',
  return_at: '2026-12-04T09:00:00Z',
  pickup_location: null, return_location: null,
  currency_code: 'TND', daily_rate_minor: 50000, subtotal_minor: 150000,
  tax_minor: 0, discount_minor: 0, total_minor: 150000,
  deposit_minor: 200000, notes: null, created_by: null, updated_by: null,
  created_at: '2026-11-28T09:00:00Z', updated_at: '2026-11-28T09:00:00Z',
};

test('agency date shows pickup, in-use and return as separate activities', () => {
  assert.deepEqual(getDayDispatchEvents([base], '2026-12-01', 'Africa/Tunis').map(x => x.kind), ['pickup']);
  assert.deepEqual(getDayDispatchEvents([base], '2026-12-02', 'Africa/Tunis').map(x => x.kind), ['in_use']);
  assert.deepEqual(getDayDispatchEvents([base], '2026-12-03', 'Africa/Tunis').map(x => x.kind), ['in_use']);
  assert.deepEqual(getDayDispatchEvents([base], '2026-12-04', 'Africa/Tunis').map(x => x.kind), ['return']);
  assert.equal(getDayDispatchEvents([base], '2026-12-05', 'Africa/Tunis').length, 0);
});

test('Cancelled reservations do not occupy dispatch calendar days', () => {
  const cancelled = { ...base, status: 'cancelled' as const };
  assert.equal(getDayDispatchEvents([cancelled], '2026-12-01', 'Africa/Tunis').length, 0);
  assert.equal(getMonthReservations([cancelled], 2026, 11, 'Africa/Tunis').length, 0);
});

test('Month includes ongoing bookings beginning before month and ending later', () => {
  const spanning = { ...base, pickup_at: '2026-11-28T09:00:00Z', return_at: '2027-01-03T09:00:00Z' };
  assert.equal(getMonthReservations([spanning], 2026, 11, 'Africa/Tunis').length, 1);
  assert.equal(getMonthReservations([spanning], 2027, 0, 'Africa/Tunis').length, 1);
  assert.equal(getMonthReservations([base], 2026, 10, 'Africa/Tunis').length, 0);
});

test('Events respect agency timezone on UTC day rollover', () => {
  const midnight = {
    ...base, pickup_at: '2026-12-01T23:30:00Z', return_at: '2026-12-02T23:30:00Z',
  };
  assert.deepEqual(getDayDispatchEvents([midnight], '2026-12-02', 'Africa/Tunis').map(x => x.kind), ['pickup']);
  assert.deepEqual(getDayDispatchEvents([midnight], '2026-12-03', 'Africa/Tunis').map(x => x.kind), ['return']);
});

test('Return and pickup entries are sorted ahead of occupancy', () => {
  const all = [
    { ...base, reference_code: 'KRL-B', pickup_at: '2026-11-29T09:00:00Z', return_at: '2026-12-04T09:00:00Z' },
    { ...base, reference_code: 'KRL-A', pickup_at: '2026-12-02T09:00:00Z', return_at: '2026-12-04T09:00:00Z' },
    { ...base, reference_code: 'KRL-C', pickup_at: '2026-11-29T09:00:00Z', return_at: '2026-12-02T09:00:00Z' },
  ];
  assert.deepEqual(getDayDispatchEvents(all, '2026-12-02', 'Africa/Tunis').map(x => x.kind), ['pickup', 'return', 'in_use']);
});


test('Unconfirmed reservations are tentative rather than occupied or picked up', () => {
  for (const status of ['draft', 'pending'] as const) {
    const tentative = { ...base, status };
    assert.deepEqual(getDayDispatchEvents([tentative], '2026-12-01', 'Africa/Tunis').map(x => x.kind), ['tentative']);
    assert.deepEqual(getDayDispatchEvents([tentative], '2026-12-02', 'Africa/Tunis').map(x => x.kind), ['tentative']);
    assert.equal(getDayDispatchEvents([tentative], '2026-12-04', 'Africa/Tunis').length, 0);
  }
});

test('Optimized dispatch index matches single-day events', () => {
  const cases = [
    base,
    { ...base, id: 'reservation-pending', status: 'pending' as const, reference_code: 'KRL-02' },
    { ...base, id: 'reservation-cancelled', status: 'cancelled' as const, reference_code: 'KRL-03' },
  ];
  const days = ['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04'];
  const index = buildDispatchEventIndex(cases, days, 'Africa/Tunis');
  for (const day of days) {
    assert.deepEqual(index.get(day), getDayDispatchEvents(cases, day, 'Africa/Tunis'));
  }
});
