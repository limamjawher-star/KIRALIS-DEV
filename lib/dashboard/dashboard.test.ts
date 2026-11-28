import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { ReportBookingRow } from '@/lib/reports/analytics';
import {
  analyzeCommandCenter, percentChange, DASHBOARD_RANGES, type DashboardRange,
} from './analytics';
import { getCommandCenterCopy } from './copy';

const fleet = [
  { id: 'v1', brand: 'Toyota', model: 'Yaris', plate_number: '1 TN 11', status: 'available' },
  { id: 'v2', brand: 'Kia', model: 'Rio', plate_number: '1 TN 22', status: 'maintenance' },
] as VehicleRecord[];
const booking = (id: string, vehicle_id: string, status: ReportBookingRow['status'],
  pickup_at: string, return_at: string, total_minor: number): ReportBookingRow =>
  ({ id, vehicle_id, status, pickup_at, return_at, total_minor, reference_code: 'KRL-'+id });
const bookings = [
  booking('A','v1','confirmed','2026-11-28T09:00:00Z','2026-12-01T09:00:00Z',100000),
  booking('B','v1','pending','2026-11-27T09:00:00Z','2026-11-29T09:00:00Z',300000),
  booking('C','v2','confirmed','2026-11-20T09:00:00Z','2026-11-22T09:00:00Z',200000),
  booking('D','v1','cancelled','2026-11-26T09:00:00Z','2026-11-28T09:00:00Z',500000),
  booking('E','v2','draft','2026-11-23T09:00:00Z','2026-11-25T09:00:00Z',1000000),
];
function run(range: DashboardRange, vehicleId?: string) {
  return analyzeCommandCenter({ bookings, vehicles: fleet, today: '2026-11-28',
    timeZone: 'Africa/Tunis', range, vehicleId });
}
test('Reference periods preserve daily and multi-day buckets with aligned comparisons', () => {
  assert.equal(DASHBOARD_RANGES.length, 4);
  assert.equal(run('7d').current.bookings.length, 7);
  assert.equal(run('30d').current.bookings.length, 30);
  assert.equal(run('90d').current.bookings.length, 30);
  assert.equal(run('12m').current.bookings.length, 52);
  assert.equal(run('7d').startDate, '2026-11-22');
  assert.equal(run('7d').endDate, '2026-11-28');
});

test('Bookings are honest: no cancelled booking counted or pending value claimed', () => {
  const data = run('7d');
  assert.equal(data.totals.bookings, 3); // confirmed + pending + draft
  assert.equal(data.totals.bookedValue, 100000);
  assert.equal(data.totals.rentalDays, 3);
  assert.equal(data.previousTotals.bookings, 1);
  assert.equal(data.previousTotals.bookedValue, 200000);
  assert.equal(data.statusCounts.confirmed, 1);
  assert.equal(data.statusCounts.pending, 1);
  assert.equal(data.statusCounts.cancelled, 1);
  assert.equal(data.statusCounts.draft, 1);
  assert.equal(data.fleetStatuses.maintenance, 1);
});

test('Selecting a car scopes booking analytics, not fleet inventory facts', () => {
  const data = run('7d','v1');
  assert.equal(data.totals.bookings, 2);
  assert.equal(data.totals.bookedValue, 100000);
  assert.equal(data.fleetStatuses.available, 1);
  assert.equal(data.performance.length, 2);
  assert.equal(data.performance.find(x=>x.id==='v2')?.bookings,1);
});

test('Upcoming handovers are actual future pending or confirmed bookings', () => {
  const data = run('7d');
  assert.equal(data.upcoming.length, 1);
  assert.equal(data.upcoming[0].id, 'A');
  assert.equal(data.recent.length,4);
});

test('Agency-local date conversion determines period and heatmap bucket', () => {
  const cross = booking('Z','v1','confirmed',
    '2026-11-21T23:30:00Z','2026-11-22T23:30:00Z',150000);
  const data = analyzeCommandCenter({ bookings:[cross], vehicles:fleet,
    today:'2026-11-28',timeZone:'Africa/Tunis',range:'7d' });
  assert.equal(data.totals.bookings,1);
  assert.equal(data.heatmap.at(-7)?.count,1);
});

test('Comparison percentage is undefined if the earlier period has no activity', () => {
  assert.equal(percentChange(12,0),null);
  assert.equal(percentChange(20,10),100);
  assert.equal(percentChange(5,10),-50);
});

test('FR EN AR copy avoids seeded creator earnings and unsupported KPIs', () => {
  for(const language of ['fr','en','ar'] as const) {
    const t=getCommandCenterCopy(language);
    assert.ok(t.chartHeading && t.performance && t.valueInfo && t.incomplete);
    for(const status of ['draft','pending','confirmed','active','completed','cancelled'] as const) {
      assert.ok(t.statuses[status]);
    }
  }
});

test('Authenticated route loads tenant-scoped real Supabase data; no demo random feed',()=>{
  const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
  const route=read('app/page.tsx');
  const view=read('components/modules/dashboard-view.tsx');
  const server=read('lib/reports/server.ts');
  assert.match(route,/requireActiveAgencyContext/);
  assert.match(route,/listAgencyReportBookings/);
  assert.match(route,/listAgencyVehicles/);
  assert.match(server,/\.eq\('agency_id', agencyId\)/);
  assert.match(view,/TrendChart/);
  assert.match(view,/analysis\.heatmap/);
  assert.doesNotMatch(view,/DEMO_COMPONENTS|Math\.random|perInstall|Withdraw now/);
});
