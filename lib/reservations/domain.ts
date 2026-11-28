import type { AgencyRole } from '@/lib/agency/types';
import { isValidUuid } from '@/lib/agency/types';
import type { ReservationStatus } from '@/lib/supabase/database.types';
import { diffCalendarDays, isValidIsoCalendarDate } from '@/lib/vehicles/compliance';

export type { ReservationRow, ReservationStatus } from '@/lib/supabase/database.types';
export type ReservationDraftInput = {
  vehicleId: string;
  customerId: string;
  pickupAt: string;
  returnAt: string;
  pickupLocation: string | null;
  returnLocation: string | null;
  notes: string | null;
};
export type ReservationDraftValidation =
  | { valid: true; data: ReservationDraftInput }
  | { valid: false; error: string };

const OFFSET_ISO =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function agencyDateForInstant(iso: string, timeZone: string): string | null {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(ms));
    const value = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const date = `${value('year')}-${value('month')}-${value('day')}`;
    return isValidIsoCalendarDate(date) ? date : null;
  } catch {
    return null;
  }
}

/** Convert an agency-local form datetime to ISO UTC, including DST transitions. */
export function agencyLocalTimeToUtc(local: string, timeZone: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!match || !isValidIsoCalendarDate(local.slice(0, 10))) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  if (hour > 23 || minute > 59) return null;
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  if (!Number.isFinite(desired)) return null;
  let guess = desired;
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
    const observedWallMs = (utcMs: number) => {
      const parts = fmt.formatToParts(new Date(utcMs));
      const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
      return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    };
    for (let n = 0; n < 4; n += 1) {
      const delta = desired - observedWallMs(guess);
      if (delta === 0) return new Date(guess).toISOString();
      guess += delta;
    }
    // Reject local times skipped by a daylight-saving transition.
    return observedWallMs(guess) === desired ? new Date(guess).toISOString() : null;
  } catch {
    return null;
  }
}

export function validateReservationDraft(
  raw: unknown,
  timeZone: string,
): ReservationDraftValidation {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid reservation form.' };
  }
  const data = raw as Record<string, unknown>;
  const fields = ['vehicleId', 'customerId', 'pickupAt', 'returnAt', 'pickupLocation', 'returnLocation', 'notes'];
  if (Object.keys(data).some(k => !fields.includes(k))) {
    return { valid: false, error: 'Unexpected reservation field.' };
  }
  if (!isValidUuid(data.vehicleId as string) || !isValidUuid(data.customerId as string)) {
    return { valid: false, error: 'Choose a valid vehicle and customer.' };
  }
  const pickupAt = data.pickupAt;
  const returnAt = data.returnAt;
  if (
    typeof pickupAt !== 'string' || !OFFSET_ISO.test(pickupAt) ||
    typeof returnAt !== 'string' || !OFFSET_ISO.test(returnAt)
  ) return { valid: false, error: 'Date-times must include a UTC offset.' };
  const from = new Date(pickupAt).getTime(), to = new Date(returnAt).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
    return { valid: false, error: 'Return must be after pickup.' };
  }
  const firstDate = agencyDateForInstant(pickupAt, timeZone);
  const lastDate = agencyDateForInstant(returnAt, timeZone);
  if (!firstDate || !lastDate) return { valid: false, error: 'Invalid agency timezone.' };
  const chargedDays = diffCalendarDays(firstDate, lastDate);
  if (chargedDays < 1 || chargedDays > 3650) {
    return { valid: false, error: 'Choose a booking spanning 1 to 3650 agency calendar days.' };
  }
  const nullableText = (key: string, max: number): string | null | false => {
    if (data[key] == null || data[key] === '') return null;
    if (typeof data[key] !== 'string') return false;
    const value = (data[key] as string).trim();
    return value.length > max ? false : value || null;
  };
  const pickupLocation = nullableText('pickupLocation', 160);
  const returnLocation = nullableText('returnLocation', 160);
  const notes = nullableText('notes', 1200);
  if (pickupLocation === false || returnLocation === false || notes === false)
    return { valid: false, error: 'Location or notes are too long.' };
  return { valid: true, data: {
    vehicleId: String(data.vehicleId),
    customerId: String(data.customerId),
    pickupAt: new Date(from).toISOString(),
    returnAt: new Date(to).toISOString(),
    pickupLocation, returnLocation, notes,
  } };
}

export const RESERVATION_STATUSES: readonly ReservationStatus[] =
  ['draft', 'pending', 'confirmed', 'active', 'completed', 'cancelled'];

export function canTransitionReservation(
  from: ReservationStatus,
  to: ReservationStatus,
  role: AgencyRole
): boolean {
  if (from === 'draft') return to === 'pending' || to === 'cancelled';
  if (from === 'pending') return (to === 'confirmed' || to === 'cancelled') && role !== 'agent';
  if (from === 'confirmed') return to === 'active' || (to === 'cancelled' && role !== 'agent');
  if (from === 'active') return to === 'completed';
  return false;
}
