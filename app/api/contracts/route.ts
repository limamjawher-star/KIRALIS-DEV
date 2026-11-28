import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';
import {
  DRAFT_CONTRACT_COLUMNS, isMissingContractRegistry,
} from '@/lib/contracts/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    { ok: false, error: ctx.error },
    { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
  );
  const { data, error } = await ctx.supabase.from('rental_contracts')
    .select(DRAFT_CONTRACT_COLUMNS)
    .eq('agency_id', ctx.activeAgency.id)
    .order('created_at', { ascending: false })
    .limit(501);
  if (error && isMissingContractRegistry(error)) return NextResponse.json({
    ok: true, schemaReady: false, contracts: [], agencyId: ctx.activeAgency.id,
    limited: false,
  }, { headers: NO_STORE_CACHE_HEADERS });
  if (error) return NextResponse.json({
    ok: false, error: 'Unable to load contract drafts.',
  }, { status: 503, headers: NO_STORE_CACHE_HEADERS });
  return NextResponse.json({
    ok: true, schemaReady: true, agencyId: ctx.activeAgency.id,
    contracts: (data ?? []).slice(0,500), limited: (data ?? []).length > 500,
  }, { headers: NO_STORE_CACHE_HEADERS });
}

/** Create a private INTERNAL DRAFT only, never a signed/issued agreement. */
export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) return NextResponse.json(
    { ok: false, error: 'Untrusted request origin.' },
    { status: 403, headers: NO_STORE_CACHE_HEADERS }
  );
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    { ok: false, error: ctx.error },
    { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
  );
  if (!['owner','manager'].includes(ctx.activeMembership.role)) return NextResponse.json(
    { ok: false, error: 'Owner or Manager role required.' },
    { status: 403, headers: NO_STORE_CACHE_HEADERS }
  );
  if (Number(request.headers.get('content-length') ?? 0) > 2048)
    return NextResponse.json({ ok: false, error: 'Request too large.' },
      { status: 413, headers: NO_STORE_CACHE_HEADERS });

  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json({ ok: false, error: 'Invalid JSON.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }); }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
    Object.keys(raw).length !== 1 ||
    !('reservationId' in raw) || typeof raw.reservationId !== 'string' ||
    !isValidUuid(raw.reservationId)) return NextResponse.json(
      { ok: false, error: 'A valid reservationId is required; extra fields are forbidden.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  const reservationId = raw.reservationId;
  const { data: reservation, error: lookupError } = await ctx.supabase
    .from('reservations').select('id, status')
    .eq('agency_id', ctx.activeAgency.id)
    .eq('id', reservationId).maybeSingle();
  if (lookupError) return NextResponse.json(
    { ok: false, error: 'Unable to verify reservation eligibility.' },
    { status: 503, headers: NO_STORE_CACHE_HEADERS }
  );
  if (!reservation) return NextResponse.json(
    { ok: false, error: 'Reservation not found in your agency.' },
    { status: 404, headers: NO_STORE_CACHE_HEADERS }
  );
  if (!['confirmed','active','completed'].includes(reservation.status))
    return NextResponse.json({
      ok: false, error: 'Confirm the reservation before creating a contract draft.',
    }, { status: 409, headers: NO_STORE_CACHE_HEADERS });

  // PostgreSQL composite FK, forced RLS and BEFORE INSERT guard are authoritative.
  const { data, error } = await ctx.supabase.from('rental_contracts')
    .insert({
      agency_id: ctx.activeAgency.id,
      reservation_id: reservationId,
      created_by: ctx.user.id,
    })
    .select(DRAFT_CONTRACT_COLUMNS).single();
  if (error) {
    const status = error.code === '23505' ? 409 :
      error.code === '23514' ? 409 :
      error.code === '42501' ? 403 :
      isMissingContractRegistry(error) ? 503 : 500;
    const message = error.code === '23505'
      ? 'A draft contract already exists for this reservation.'
      : error.code === '23514'
        ? 'This reservation is no longer eligible for a draft.'
        : error.code === '42501'
          ? 'You do not have permission to create this contract.'
          : isMissingContractRegistry(error)
            ? 'Contract schema migration 0010 has not been installed.'
            : 'Unable to save contract draft.';
    return NextResponse.json({ ok: false, error: message },
      { status, headers: NO_STORE_CACHE_HEADERS });
  }
  return NextResponse.json({ ok: true, contract: data },
    { status: 201, headers: NO_STORE_CACHE_HEADERS });
}
