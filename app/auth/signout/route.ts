import { NextResponse, type NextRequest } from 'next/server';
import {
  getActiveAgencyCookieOptions,
  isTrustedOriginRequest,
} from '@/lib/agency/server';
import { ACTIVE_AGENCY_COOKIE_NAME } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function clearActiveAgencyCookie(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  response.cookies.set(ACTIVE_AGENCY_COOKIE_NAME, '', {
    ...getActiveAgencyCookieOptions(request),
    maxAge: 0,
  });
  return response;
}

/**
 * Server-side logout handler ensuring Supabase Auth session cookies and
 * active agency selection cookie are invalidated with matching attributes
 * (including HTTPS Partitioned cookies) and never cached.
 */
export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Requête refusée : origine non autorisée.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!hasSupabaseEnv(process.env)) {
    const response = NextResponse.json(
      { ok: false, error: 'Supabase environment variables are not configured.' },
      { status: 503, headers: NO_STORE_CACHE_HEADERS }
    );
    return clearActiveAgencyCookie(response, request);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    const response = NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
    return clearActiveAgencyCookie(response, request);
  }

  const response = NextResponse.json(
    { ok: true },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
  return clearActiveAgencyCookie(response, request);
}
