import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReservationRow } from '@/lib/supabase/database.types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { calculateRentalPricePreview, MAX_PRICING_MINOR } from '@/lib/vehicles/pricing';
import type { PricingPreviewSuccess, SeasonalRateRuleInput } from '@/lib/vehicles/pricing';
import type { VehicleRecord } from '@/lib/vehicles/types';
import {
  agencyDateForInstant,
  validateReservationDraft,
  type ReservationDraftInput,
} from './domain';

export const RESERVATION_SELECT_COLUMNS = [
  'id', 'agency_id', 'reference_code', 'vehicle_id', 'customer_id',
  'status', 'pickup_at', 'return_at', 'pickup_location', 'return_location',
  'currency_code', 'daily_rate_minor', 'subtotal_minor', 'tax_minor',
  'discount_minor', 'total_minor', 'deposit_minor', 'notes',
  'created_at', 'updated_at',
].join(', ');

export type ReservationResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string };

export async function listAgencyReservations(
  agencyId: string
): Promise<{ reservations: ReservationRow[]; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('reservations')
      .select(RESERVATION_SELECT_COLUMNS)
      .eq('agency_id', agencyId)
      .order('pickup_at', { ascending: false })
      .limit(500);
    if (error) return { reservations: [], error: 'Unable to load reservations.' };
    return { reservations: (data ?? []) as unknown as ReservationRow[], error: null };
  } catch {
    return { reservations: [], error: 'Unable to load reservations.' };
  }
}

export interface ReservationQuote {
  draft: ReservationDraftInput;
  preview: PricingPreviewSuccess;
  depositMinor: number;
  dailyRateMinor: number;
  currencyCode: 'TND';
}

/** Authoritative availability and pricing. Never trust browser-supplied prices. */
export async function quoteAgencyReservation(
  supabase: Pick<SupabaseClient, 'from'>,
  params: { agencyId: string; timeZone: string; raw: unknown; currencyCode: string }
): Promise<ReservationResult<ReservationQuote>> {
  const checked = validateReservationDraft(params.raw, params.timeZone);
  if (!checked.valid) return { ok: false, status: 400, error: checked.error };
  if (params.currencyCode !== 'TND')
    return { ok: false, status: 400, error: 'This booking flow currently supports TND agencies only.' };
  const draft = checked.data;

  const [vehicleResult, customerResult] = await Promise.all([
    supabase.from('vehicles')
      .select('id, agency_id, status, currency_code, daily_rate_minor, weekly_rate_minor, monthly_rate_minor, deposit_minor')
      .eq('agency_id', params.agencyId).eq('id', draft.vehicleId).maybeSingle(),
    supabase.from('customers').select('id')
      .eq('agency_id', params.agencyId).eq('id', draft.customerId).maybeSingle(),
  ]);
  if (vehicleResult.error || customerResult.error)
    return { ok: false, status: 503, error: 'Fleet or customer data is unavailable.' };
  if (!vehicleResult.data || !customerResult.data)
    return { ok: false, status: 404, error: 'Vehicle or customer not found in the active agency.' };
  const vehicle = vehicleResult.data as Pick<VehicleRecord,
    'id' | 'agency_id' | 'status' | 'currency_code' | 'daily_rate_minor' |
    'weekly_rate_minor' | 'monthly_rate_minor' | 'deposit_minor'>;
  if (vehicle.status === 'retired' || vehicle.status === 'maintenance')
    return { ok: false, status: 409, error: 'This vehicle is currently unavailable for new reservations.' };
  if (vehicle.currency_code !== 'TND')
    return { ok: false, status: 400, error: 'Only TND vehicle pricing is supported.' };

  // Advisory conflict check. The PostgreSQL GiST constraint remains the
  // authoritative protection when a pending reservation is confirmed.
  const existing = await supabase.from('reservations')
    .select('id').eq('agency_id', params.agencyId)
    .eq('vehicle_id', draft.vehicleId)
    .in('status', ['confirmed', 'active'])
    .lt('pickup_at', draft.returnAt)
    .gt('return_at', draft.pickupAt)
    .limit(1);
  if (existing.error) return { ok: false, status: 503, error: 'Unable to verify availability.' };
  if (existing.data?.length)
    return { ok: false, status: 409, error: 'The vehicle is already reserved during these dates.' };

  // Fail closed if pricing migration is missing. No silent undercharging.
  const seasonal = await supabase.from('vehicle_seasonal_rates')
    .select('id, label, start_date, end_date, daily_rate_minor, is_active')
    .eq('agency_id', params.agencyId)
    .eq('vehicle_id', draft.vehicleId)
    .eq('is_active', true);
  if (seasonal.error)
    return { ok: false, status: 503, error: 'Seasonal pricing is unavailable. Verify migration 0005.' };

  const pickupDate = agencyDateForInstant(draft.pickupAt, params.timeZone);
  const returnDate = agencyDateForInstant(draft.returnAt, params.timeZone);
  if (!pickupDate || !returnDate)
    return { ok: false, status: 400, error: 'Invalid reservation dates.' };
  const preview = calculateRentalPricePreview({
    vehicle,
    seasonalRules: (seasonal.data ?? []) as SeasonalRateRuleInput[],
    pickupDate, returnDate, agencyTimeZone: params.timeZone,
  });
  if (!preview.ok)
    return { ok: false, status: 400, error: preview.error };
  if (!Number.isSafeInteger(preview.subtotalMinor) ||
      preview.subtotalMinor < 0 || preview.subtotalMinor > MAX_PRICING_MINOR)
    return { ok: false, status: 400, error: 'Calculated amount is outside supported limits.' };
  return { ok: true, data: {
    draft, preview, depositMinor: vehicle.deposit_minor,
    dailyRateMinor: vehicle.daily_rate_minor, currencyCode: 'TND',
  } };
}

/**
 * A new reservation is intentionally PENDING. Confirming it later invokes
 * the existing database RPC, which enforces tenant permissions and overlap.
 */
export async function createAgencyReservation(
  supabase: Pick<SupabaseClient, 'from' | 'rpc'>,
  params: {
    agencyId: string; userId: string; timeZone: string;
    currencyCode: string; raw: unknown;
  }
): Promise<ReservationResult<ReservationRow>> {
  // The browser may display a quote just before fleet rates change.
  // Expected amounts are only a consistency check; never authoritative prices.
  const input = params.raw as Record<string, unknown> | null;
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      !Number.isSafeInteger(input.expectedSubtotalMinor) ||
      !Number.isSafeInteger(input.expectedDepositMinor)) {
    return { ok: false, status: 400, error: 'A current reservation quote is required.' };
  }
  const { expectedSubtotalMinor, expectedDepositMinor, ...draftInput } = input;
  const quote = await quoteAgencyReservation(supabase, { ...params, raw: draftInput });
  if (!quote.ok) return quote;
  const { draft, preview, depositMinor } = quote.data;
  if (preview.subtotalMinor !== expectedSubtotalMinor ||
      depositMinor !== expectedDepositMinor) {
    return { ok: false, status: 409, error: 'Rates changed. Please recalculate the quote before booking.' };
  }
  // The database RPC re-computes the entire agency-local seasonal/package
  // price and derives tenant, actor, currency and reference itself.
  // Authenticated clients have NO direct INSERT privilege on reservations.
  const { data, error } = await supabase.rpc('create_agency_reservation_secure', {
    p_vehicle_id: draft.vehicleId,
    p_customer_id: draft.customerId,
    p_pickup_at: draft.pickupAt,
    p_return_at: draft.returnAt,
    p_pickup_location: draft.pickupLocation,
    p_return_location: draft.returnLocation,
    p_notes: draft.notes,
    p_expected_subtotal_minor: preview.subtotalMinor,
    p_expected_deposit_minor: depositMinor,
  });
  if (error) {
    if (error.code === '23P01') {
      return { ok: false, status: 409, error: 'The vehicle is already booked for those dates.' };
    }
    if (error.code === '23514') {
      return { ok: false, status: 409, error: 'Rates or availability changed; recalculate the quote.' };
    }
    if (error.code === '42501') {
      return { ok: false, status: 403, error: 'Reservation creation is not permitted.' };
    }
    if (error.code === 'PGRST202' || error.code === '42883') {
      return { ok: false, status: 503, error: 'Booking database upgrade is not installed yet.' };
    }
    if (error.code === '23505') {
      return { ok: false, status: 409, error: 'Reservation reference collision; retry.' };
    }
    return { ok: false, status: 500, error: 'Unable to create the reservation.' };
  }
  if (!data) return { ok: false, status: 500, error: 'Reservation could not be saved.' };
  return { ok: true, data: data as unknown as ReservationRow };
}
