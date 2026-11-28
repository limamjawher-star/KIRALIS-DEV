import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { VehicleRecord } from '@/lib/vehicles/types';
import { agencyReportWindow, summarizeAgencyBookings, type ReportBookingRow } from './analytics';
import { getOperationalReportCopy } from './copy';

const booking: ReportBookingRow = {
  id: 'r1', reference_code: 'KRL-0001', vehicle_id: 'vehicle-1',
  status: 'confirmed', pickup_at: '2026-11-27T09:00:00.000Z',
  return_at: '2026-11-30T09:00:00.000Z', total_minor: 150000,
};
const fleet = [
  { id: 'vehicle-1', status: 'available' },
  { id: 'vehicle-2', status: 'retired' },
] as VehicleRecord[];

test('Period windows are deterministic, including quarter/year rollover', () => {
  assert.deepEqual(agencyReportWindow('month', '2026-11-28'),
    { startDate: '2026-11-01', endDateExclusive: '2026-12-01' });
  assert.deepEqual(agencyReportWindow('quarter', '2026-11-28'),
    { startDate: '2026-10-01', endDateExclusive: '2027-01-01' });
  assert.deepEqual(agencyReportWindow('year', '2026-11-28'),
    { startDate: '2026-01-01', endDateExclusive: '2027-01-01' });
  assert.throws(() => agencyReportWindow('quarter', 'bad'));
});

test('Book value excludes pending, draft, cancelled and deposits', () => {
  const bookings: ReportBookingRow[] = [
    booking,
    { ...booking, id: 'r2', status: 'completed', total_minor: 100000, pickup_at: '2026-11-20T09:00:00Z', return_at: '2026-11-22T09:00:00Z' },
    { ...booking, id: 'r3', status: 'pending', total_minor: 900000 },
    { ...booking, id: 'r4', status: 'draft', total_minor: 500000 },
    { ...booking, id: 'r5', status: 'cancelled', total_minor: 120000 },
  ];
  const sum = summarizeAgencyBookings('month', '2026-11-28', 'Africa/Tunis', bookings, fleet);
  assert.equal(sum.allBookingCount, 5);
  assert.equal(sum.committedBookingCount, 2);
  assert.equal(sum.bookedValueMinor, 250000);
  assert.equal(sum.bookedRentalDays, 5);
  assert.equal(sum.averageBookedDays, 2.5);
  assert.equal(sum.activeFleetCount, 1);
  assert.deepEqual(sum.counts,
    { draft: 1, pending: 1, confirmed: 1, active: 0, completed: 1, cancelled: 1 });
});

test('Selection follows agency-local pickup date, not UTC month', () => {
  const crossover = {
    ...booking, pickup_at: '2026-10-31T23:30:00Z',
    return_at: '2026-11-02T23:30:00Z',
  };
  assert.equal(summarizeAgencyBookings('month', '2026-11-15', 'Africa/Tunis',
    [crossover], fleet).allBookingCount, 1);
  assert.equal(summarizeAgencyBookings('month', '2026-10-15', 'Africa/Tunis',
    [crossover], fleet).allBookingCount, 0);
});

test('Unexpected or unsafe monetary values cannot become booked revenue figures', () => {
  const invalid = { ...booking, total_minor: Number.NaN };
  const sum = summarizeAgencyBookings('month', '2026-11-28', 'Africa/Tunis', [invalid], fleet);
  assert.equal(sum.bookedValueMinor, 0);
  assert.equal(sum.committedBookingCount, 0);
});

test('Reports localized for French, English and Arabic with honest payment disclaimer', () => {
  for (const locale of ['fr', 'en', 'ar'] as const) {
    const copy = getOperationalReportCopy(locale);
    assert.ok(copy.bookedValue && copy.bookedValueInfo);
    assert.equal(Object.keys(copy.status).length, 6);
    assert.ok(copy.partialWarning);
  }
});

test('Read-only reports never query cross-agency booking data or suggest cash was received', () => {
  const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');
  const server = read('lib/reports/server.ts');
  const page = read('app/reports/page.tsx');
  assert.match(server, /\.eq\('agency_id', agencyId\)/);
  assert.match(server, /\.limit\(5001\)/);
  assert.match(server, /total_minor/);
  assert.doesNotMatch(server, /\bservice_role\b/);
  assert.match(page, /requireActiveAgencyContext/);
  assert.match(page, /key=\{activeAgency\.id\}/);
});
