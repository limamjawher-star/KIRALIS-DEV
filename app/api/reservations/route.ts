import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';
import {
  createAgencyReservation,
  RESERVATION_SELECT_COLUMNS,
} from '@/lib/reservations/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    { ok: false, error: ctx.error },
    { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
  );
  const { data, error } = await ctx.supabase.from('reservations')
    .select(RESERVATION_SELECT_COLUMNS)
    .eq('agency_id', ctx.activeAgency.id)
    .order('pickup_at', { ascending: false })
    .limit(500);
  if (error) return NextResponse.json(
    { ok: false, error: 'Unable to load reservations.' },
    { status: 500, headers: NO_STORE_CACHE_HEADERS }
  );
  return NextResponse.json(
    { ok: true, agencyId: ctx.activeAgency.id, reservations: data ?? [] },
    { headers: NO_STORE_CACHE_HEADERS }
  );
}

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
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return NextResponse.json({ ok: false, error: 'Request too large.' },
      { status: 413, headers: NO_STORE_CACHE_HEADERS });

  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json(
    { ok: false, error: 'Invalid request JSON.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }
  ); }
  const result = await createAgencyReservation(ctx.supabase, {
    agencyId: ctx.activeAgency.id, userId: ctx.user.id,
    timeZone: ctx.activeAgency.timezone, currencyCode: ctx.activeAgency.currency_code,
    raw: body,
  });
  return result.ok
    ? NextResponse.json({ ok: true, reservation: result.data },
      { status: 201, headers: NO_STORE_CACHE_HEADERS })
    : NextResponse.json({ ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS });
}
