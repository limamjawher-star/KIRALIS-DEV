import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';
import { quoteAgencyReservation } from '@/lib/reservations/server';

export const dynamic = 'force-dynamic';

/** Explicit read-only quote action; POST avoids leaking customer IDs in URLs. */
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
  let raw: unknown;
  try { raw = await request.json(); }
  catch { return NextResponse.json(
    { ok: false, error: 'Invalid request JSON.' },
    { status: 400, headers: NO_STORE_CACHE_HEADERS }
  ); }
  const result = await quoteAgencyReservation(ctx.supabase, {
    agencyId: ctx.activeAgency.id, timeZone: ctx.activeAgency.timezone,
    currencyCode: ctx.activeAgency.currency_code, raw,
  });
  return result.ok
    ? NextResponse.json({
        ok: true, quote: {
          chargedDays: result.data.preview.chargedDays,
          subtotalMinor: result.data.preview.subtotalMinor,
          depositMinor: result.data.depositMinor,
          currencyCode: result.data.currencyCode,
          standardDays: result.data.preview.standardDays,
          seasonalDays: result.data.preview.seasonalDays,
        },
      }, { headers: NO_STORE_CACHE_HEADERS })
    : NextResponse.json({ ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS });
}
