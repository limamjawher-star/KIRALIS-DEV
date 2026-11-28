import type { ReservationRow } from '@/lib/supabase/database.types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import { agencyDateForInstant } from '@/lib/reservations/domain';
import { diffCalendarDays } from '@/lib/vehicles/compliance';

export type ReportPeriod = 'month' | 'quarter' | 'year';
export type ReportBookingRow = Pick<ReservationRow,
  'id' | 'reference_code' | 'vehicle_id' | 'status' | 'pickup_at' | 'return_at' | 'total_minor'>;
export type BookingReportStatus = 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
const BOOKED_STATUSES = new Set(['confirmed', 'active', 'completed']);

export interface OperationalSummary {
  period: ReportPeriod;
  startDate: string;
  endDateExclusive: string;
  allBookingCount: number;
  committedBookingCount: number;
  bookedValueMinor: number;
  bookedRentalDays: number;
  averageBookedDays: number | null;
  activeFleetCount: number;
  counts: Record<BookingReportStatus, number>;
  recent: ReportBookingRow[];
}

function pad(n: number) { return String(n).padStart(2, '0'); }
export function agencyReportWindow(
  period: ReportPeriod,
  today: string
): { startDate: string; endDateExclusive: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(today);
  if (!match) throw new Error('Invalid report reference date');
  const year = Number(match[1]), month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error('Invalid report month');
  const startMonth = period === 'year' ? 1 :
    period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const delta = period === 'year' ? 12 : period === 'quarter' ? 3 : 1;
  const endMonth = startMonth + delta;
  const endYear = year + Math.floor((endMonth - 1) / 12);
  const normalizedEndMonth = (endMonth - 1) % 12 + 1;
  return {
    startDate: `${year}-${pad(startMonth)}-01`,
    endDateExclusive: `${endYear}-${pad(normalizedEndMonth)}-01`,
  };
}

/**
 * Reporting is explicitly based on bookings whose pickup occurs in this period.
 * Booked value is NOT cash received; deposits are not recognized as revenue.
 * No unverified maintenance costs or percentages are fabricated.
 */
export function summarizeAgencyBookings(
  period: ReportPeriod,
  today: string,
  timeZone: string,
  reservations: readonly ReportBookingRow[],
  vehicles: readonly VehicleRecord[]
): OperationalSummary {
  const { startDate, endDateExclusive } = agencyReportWindow(period, today);
  const selected = reservations.filter((booking) => {
    const pickup = agencyDateForInstant(booking.pickup_at, timeZone);
    return pickup !== null && pickup >= startDate && pickup < endDateExclusive;
  });
  const counts: OperationalSummary['counts'] =
    { pending: 0, confirmed: 0, active: 0, completed: 0, cancelled: 0 };
  let bookedValueMinor = 0;
  let bookedRentalDays = 0;
  let committedBookingCount = 0;
  for (const booking of selected) {
    if (booking.status === 'draft') continue;
    if (Object.prototype.hasOwnProperty.call(counts, booking.status)) {
      counts[booking.status as BookingReportStatus] += 1;
    }
    if (!BOOKED_STATUSES.has(booking.status)) continue;
    const pickup = agencyDateForInstant(booking.pickup_at, timeZone);
    const dropoff = agencyDateForInstant(booking.return_at, timeZone);
    if (!pickup || !dropoff) continue;
    const days = diffCalendarDays(pickup, dropoff);
    if (days <= 0) continue;
    if (!Number.isSafeInteger(booking.total_minor) || booking.total_minor < 0) continue;
    committedBookingCount += 1;
    bookedValueMinor += booking.total_minor;
    bookedRentalDays += days;
  }
  return {
    period, startDate, endDateExclusive,
    allBookingCount: selected.length,
    committedBookingCount,
    bookedValueMinor,
    bookedRentalDays,
    averageBookedDays: committedBookingCount ? bookedRentalDays / committedBookingCount : null,
    activeFleetCount: vehicles.filter(v => v.status !== 'retired').length,
    counts,
    recent: selected.slice().sort((a,b) => b.pickup_at.localeCompare(a.pickup_at)).slice(0, 8),
  };
}
