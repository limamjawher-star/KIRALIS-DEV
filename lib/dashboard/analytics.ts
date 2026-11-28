import type { VehicleRecord, VehicleStatus } from '@/lib/vehicles/types';
import type { ReportBookingRow } from '@/lib/reports/analytics';
import type { ReservationStatus } from '@/lib/supabase/database.types';
import { agencyDateForInstant } from '@/lib/reservations/domain';
import { diffCalendarDays } from '@/lib/vehicles/compliance';

export type DashboardRange = '7d' | '30d' | '90d' | '12m';
export type DashboardMetric = 'bookings' | 'bookedValue' | 'rentalDays';
export const DASHBOARD_RANGES: readonly { id: DashboardRange; days: number; bucket: number }[] = [
  { id: '7d', days: 7, bucket: 1 },
  { id: '30d', days: 30, bucket: 1 },
  { id: '90d', days: 90, bucket: 3 },
  { id: '12m', days: 364, bucket: 7 },
] as const;

const COMMITTED = new Set<ReservationStatus>(['confirmed', 'active', 'completed']);
export const DASHBOARD_STATUSES: readonly ReservationStatus[] =
  ['draft', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];
const MS_DAY = 86_400_000;

function isoDayOffset(date: string, delta: number): string {
  const ms = Date.parse(date + 'T00:00:00.000Z');
  return new Date(ms + delta * MS_DAY).toISOString().slice(0, 10);
}
function diffDayIndex(start: string, date: string): number {
  return Math.round((Date.parse(date + 'T00:00:00.000Z') -
    Date.parse(start + 'T00:00:00.000Z')) / MS_DAY);
}
function safePositiveMoney(n: number) {
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
function zeroMetrics(): Record<DashboardMetric, number> {
  return { bookings: 0, bookedValue: 0, rentalDays: 0 };
}

export type FleetPerformance = {
  id: string;
  vehicle: VehicleRecord;
  bookings: number;
  bookedValue: number;
  rentalDays: number;
};
export interface CommandCenterAnalytics {
  startDate: string;
  endDate: string;
  days: number;
  bucketDays: number;
  labels: string[];
  current: Record<DashboardMetric, number[]>;
  previous: Record<DashboardMetric, number[]>;
  totals: Record<DashboardMetric, number>;
  previousTotals: Record<DashboardMetric, number>;
  statusCounts: Record<ReservationStatus, number>;
  fleetStatuses: Record<VehicleStatus, number>;
  performance: FleetPerformance[];
  upcoming: ReportBookingRow[];
  recent: ReportBookingRow[];
  heatmap: { date: string; count: number }[];
}

/**
 * 100% real booking data. A booking belongs to the bucket of its agency-local
 * pickup date. Committed value is NOT collected revenue. Cancelled bookings
 * are not counted as new bookings; no paid or online activity is simulated.
 */
export function analyzeCommandCenter(params: {
  bookings: readonly ReportBookingRow[];
  vehicles: readonly VehicleRecord[];
  today: string;
  timeZone: string;
  range: DashboardRange;
  vehicleId?: string | null;
}): CommandCenterAnalytics {
  const R = DASHBOARD_RANGES.find(item => item.id === params.range)!;
  const { today, timeZone, vehicleId = null } = params;
  const startDate = isoDayOffset(today, -(R.days - 1));
  const previousStart = isoDayOffset(today, -(R.days * 2 - 1));
  const bucketCount = Math.ceil(R.days / R.bucket);
  const dailyCur = Object.fromEntries(
    (['bookings', 'bookedValue', 'rentalDays'] as DashboardMetric[])
      .map(key => [key, Array(R.days).fill(0) as number[]])
  ) as Record<DashboardMetric, number[]>;
  const dailyPrev = Object.fromEntries(
    (['bookings', 'bookedValue', 'rentalDays'] as DashboardMetric[])
      .map(key => [key, Array(R.days).fill(0) as number[]])
  ) as Record<DashboardMetric, number[]>;

  const statuses: Record<ReservationStatus, number> = {
    draft: 0, pending: 0, confirmed: 0, active: 0, completed: 0, cancelled: 0,
  };
  const fleetStatuses: Record<VehicleStatus, number> = {
    available: 0, rented: 0, maintenance: 0, retired: 0,
  };
  const rows = params.vehicles.map(vehicle => ({
    id: vehicle.id, vehicle, bookings: 0, bookedValue: 0, rentalDays: 0,
  }));
  const rowById = new Map(rows.map(row => [row.id, row]));
  for (const vehicle of params.vehicles) fleetStatuses[vehicle.status] += 1;

  const heatStart = isoDayOffset(today, -181);
  const heat: { date: string; count: number }[] = Array.from({ length: 182 }, (_, day) =>
    ({ date: isoDayOffset(heatStart, day), count: 0 }));
  const upcoming: ReportBookingRow[] = [];
  const recent: ReportBookingRow[] = [];

  for (const booking of params.bookings) {
    const pickupDate = agencyDateForInstant(booking.pickup_at, timeZone);
    const returnDate = agencyDateForInstant(booking.return_at, timeZone);
    if (!pickupDate || !returnDate || returnDate <= pickupDate) continue;
    const committed = COMMITTED.has(booking.status);
    const notCancelled = booking.status !== 'cancelled';
    const bookedDays = diffCalendarDays(pickupDate, returnDate);
    const value = committed ? safePositiveMoney(booking.total_minor) : 0;
    const days = committed && bookedDays > 0 && bookedDays <= 3650 ? bookedDays : 0;

    // Fleet comparison is always computed for all vehicles, even when focusing.
    const performance = rowById.get(booking.vehicle_id);
    const currentIdx = diffDayIndex(startDate, pickupDate);
    if (currentIdx >= 0 && currentIdx < R.days && performance) {
      if (notCancelled) performance.bookings++;
      if (committed) {
        performance.bookedValue += value;
        performance.rentalDays += days;
      }
    }
    if (vehicleId && booking.vehicle_id !== vehicleId) continue;

    if (booking.status === 'pending' || booking.status === 'confirmed') {
      if (pickupDate >= today) upcoming.push(booking);
    }

    if (currentIdx >= 0 && currentIdx < R.days) {
      statuses[booking.status]++;
      recent.push(booking);
    }

    const heatIdx = diffDayIndex(heatStart, pickupDate);
    if (notCancelled && heatIdx >= 0 && heatIdx < heat.length) heat[heatIdx].count++;

    const isCurrent = currentIdx >= 0 && currentIdx < R.days;
    const prevIdx = diffDayIndex(previousStart, pickupDate);
    const isPrevious = prevIdx >= 0 && prevIdx < R.days;
    if (!isCurrent && !isPrevious) continue;
    const dest = isCurrent ? dailyCur : dailyPrev;
    const idx = isCurrent ? currentIdx : prevIdx;
    if (notCancelled) dest.bookings[idx] += 1;
    if (committed) {
      dest.bookedValue[idx] += value;
      dest.rentalDays[idx] += days;
    }
  }

  const bucketize = (daily: number[]) => Array.from({ length: bucketCount }, (_, i) =>
    daily.slice(i * R.bucket, (i + 1) * R.bucket).reduce((n, v) => n + v, 0));
  const metrics = ['bookings', 'bookedValue', 'rentalDays'] as DashboardMetric[];
  const current = {} as Record<DashboardMetric, number[]>;
  const previous = {} as Record<DashboardMetric, number[]>;
  const totals = zeroMetrics();
  const previousTotals = zeroMetrics();
  for (const key of metrics) {
    current[key] = bucketize(dailyCur[key]);
    previous[key] = bucketize(dailyPrev[key]);
    totals[key] = current[key].reduce((n, v) => n + v, 0);
    previousTotals[key] = previous[key].reduce((n, v) => n + v, 0);
  }
  const labels = Array.from({ length: bucketCount }, (_, i) =>
    isoDayOffset(startDate, i * R.bucket));
  return {
    startDate, endDate: today, days: R.days, bucketDays: R.bucket,
    labels, current, previous, totals, previousTotals,
    statusCounts: statuses, fleetStatuses,
    performance: rows,
    upcoming: upcoming.sort((a, b) => a.pickup_at.localeCompare(b.pickup_at)).slice(0, 6),
    recent: recent.sort((a, b) => b.pickup_at.localeCompare(a.pickup_at)).slice(0, 7),
    heatmap: heat,
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
