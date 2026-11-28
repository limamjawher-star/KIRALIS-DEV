import type { ReservationRow } from '@/lib/supabase/database.types';
import { agencyDateForInstant } from './domain';

export type DispatchEventKind = 'pickup' | 'return' | 'in_use';
export interface DispatchEvent {
  reservation: ReservationRow;
  kind: DispatchEventKind;
  date: string;
}
/**
 * Dispatch-oriented day events. Pickup/return are handover activities;
 * middle days are vehicle occupancy. Cancelled bookings are never shown.
 *
 * Day boundaries follow the agency's timezone, not the viewing browser.
 */
export function getDayDispatchEvents(
  reservations: readonly ReservationRow[],
  isoDate: string,
  agencyTimeZone: string
): DispatchEvent[] {
  const result: DispatchEvent[] = [];
  for (const reservation of reservations) {
    if (reservation.status === 'cancelled') continue;
    const pickupDate = agencyDateForInstant(reservation.pickup_at, agencyTimeZone);
    const returnDate = agencyDateForInstant(reservation.return_at, agencyTimeZone);
    if (!pickupDate || !returnDate || pickupDate >= returnDate) continue;
    const kind: DispatchEventKind | null =
      isoDate === pickupDate ? 'pickup' :
      isoDate === returnDate ? 'return' :
      isoDate > pickupDate && isoDate < returnDate ? 'in_use' :
      null;
    if (kind) result.push({ reservation, kind, date: isoDate });
  }
  const order: Record<DispatchEventKind, number> = { pickup: 0, return: 1, in_use: 2 };
  return result.sort((a, b) =>
    order[a.kind] - order[b.kind] ||
    a.reservation.reference_code.localeCompare(b.reservation.reference_code)
  );
}

/** Bookings whose agency-local day ranges touch a given calendar month. */
export function getMonthReservations(
  reservations: readonly ReservationRow[],
  year: number,
  monthIndex: number,
  agencyTimeZone: string
): ReservationRow[] {
  const start = `${String(year).padStart(4, '0')}-${String(monthIndex + 1).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(year, monthIndex + 1, 1)).toISOString().slice(0, 10);
  return reservations.filter(r => {
    if (r.status === 'cancelled') return false;
    const pickup = agencyDateForInstant(r.pickup_at, agencyTimeZone);
    const returnDate = agencyDateForInstant(r.return_at, agencyTimeZone);
    return Boolean(pickup && returnDate && pickup < end && returnDate >= start);
  }).sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
}
