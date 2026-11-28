import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { canTransitionReservation, RESERVATION_STATUSES } from '@/lib/reservations/domain';
import { RESERVATION_SELECT_COLUMNS } from '@/lib/reservations/server';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';
import type { ReservationStatus } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isTrustedOriginRequest(request)) return NextResponse.json(
    { ok: false, error: 'Untrusted request origin.' },
    { status: 403, headers: NO_STORE_CACHE_HEADERS }
  );
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    { ok: false, error: ctx.error },
    { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
  );
  const { id } = await params;
  if (!isValidUuid(id)) return NextResponse.json(
    { ok: false, error: 'Invalid reservation ID.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }
  );
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return NextResponse.json(
    { ok: false, error: 'Invalid transition payload.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }
  );
  const body = raw as Record<string, unknown>;
  if (Object.keys(body).length !== 1 ||
      typeof body.status !== 'string' ||
      !RESERVATION_STATUSES.includes(body.status as ReservationStatus))
    return NextResponse.json({ ok: false, error: 'Unsupported status.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS });
  const { data: current, error: readError } = await ctx.supabase
    .from('reservations').select('id, status')
    .eq('agency_id', ctx.activeAgency.id).eq('id', id).maybeSingle();
  if (readError) return NextResponse.json({ ok: false, error: 'Unable to read reservation.' },
    { status: 500, headers: NO_STORE_CACHE_HEADERS });
  if (!current) return NextResponse.json({ ok: false, error: 'Reservation not found.' },
    { status: 404, headers: NO_STORE_CACHE_HEADERS });
  const next = body.status as ReservationStatus;
  if (!canTransitionReservation(current.status as ReservationStatus, next, ctx.activeMembership.role))
    return NextResponse.json({ ok: false, error: 'This status change is not permitted.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS });
  const { data, error } = await ctx.supabase.rpc('transition_reservation_status', {
    p_reservation_id: id, p_next_status: next,
  });
  if (error) {
    const isConflict = error.code === '23P01';
    return NextResponse.json({
      ok: false,
      error: isConflict
        ? 'This vehicle has a conflicting confirmed or active reservation.'
        : error.code === '42501'
          ? 'You do not have permission to perform this change.'
          : 'Unable to change reservation status.',
    }, { status: isConflict ? 409 : error.code === '42501' ? 403 : 400,
      headers: NO_STORE_CACHE_HEADERS });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'Reservation change failed.' },
    { status: 500, headers: NO_STORE_CACHE_HEADERS });
  // Re-read tenant-scoped projection instead of returning unfiltered RPC row.
  const updated = await ctx.supabase.from('reservations')
    .select(RESERVATION_SELECT_COLUMNS).eq('agency_id', ctx.activeAgency.id)
    .eq('id', id).maybeSingle();
  if (updated.error || !updated.data) return NextResponse.json({
    ok: false, error: 'Status changed, but the latest reservation could not be loaded. Refresh.',
  }, { status: 503, headers: NO_STORE_CACHE_HEADERS });
  return NextResponse.json({ ok: true, reservation: updated.data },
    { headers: NO_STORE_CACHE_HEADERS });
}
