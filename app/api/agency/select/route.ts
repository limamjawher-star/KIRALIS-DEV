import { NextResponse, type NextRequest } from 'next/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  getActiveAgencyCookieOptions,
  isTrustedOriginRequest,
} from '@/lib/agency/server';
import { ACTIVE_AGENCY_COOKIE_NAME, isValidUuid } from '@/lib/agency/types';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Switches the user's active agency selection ONLY after verifying an active
 * membership in public.agency_memberships via Supabase RLS and getUser().
 */
export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Requête refusée : origine non autorisée.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!hasSupabaseEnv(process.env)) {
    return NextResponse.json(
      { ok: false, error: 'Configuration Supabase manquante.' },
      { status: 503, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { ok: false, error: 'Authentification requise.' },
      { status: 401, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  let agencyId: string | null = null;
  try {
    const parsed: unknown = await request.json();
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      typeof (parsed as { agencyId?: unknown }).agencyId === 'string'
    ) {
      agencyId = (parsed as { agencyId: string }).agencyId.trim();
    }
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Corps de requête JSON invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!isValidUuid(agencyId)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant d’agence invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { data: membership, error: membershipError } = await supabase
    .from('agency_memberships')
    .select('id, agency_id, role, status')
    .eq('user_id', user.id)
    .eq('agency_id', agencyId)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : vous n’êtes pas membre actif de cette agence.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      agencyId: membership.agency_id,
      role: membership.role,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );

  response.cookies.set(
    ACTIVE_AGENCY_COOKIE_NAME,
    membership.agency_id,
    getActiveAgencyCookieOptions(request)
  );

  return response;
}
