import { NextResponse, type NextRequest } from 'next/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  getActiveAgencyCookieOptions,
  isTrustedOriginRequest,
} from '@/lib/agency/server';
import {
  ACTIVE_AGENCY_COOKIE_NAME,
  type AgencyRecord,
} from '@/lib/agency/types';
import {
  buildCreateAgencyRpcParams,
  mapCreateAgencyRpcError,
  validateOnboardingAgencyInput,
} from '@/lib/agency/validation';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Real server-validated agency creation endpoint.
 * - Verifies authenticated identity via supabase.auth.getUser()
 * - Validates all agency fields server-side
 * - Calls public.create_agency() atomically with the authenticated user's JWT
 *   (creates agency + assigns active Owner membership + logs agency.created)
 * - Never manually inserts into public.agency_memberships
 * - Never uses service-role credentials
 */
export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Requête refusée : origine non autorisée.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!hasSupabaseEnv(process.env)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Configuration Supabase manquante sur le serveur (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY requises).',
      },
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
      {
        ok: false,
        error:
          'Authentification requise pour créer une agence. Veuillez vous connecter.',
      },
      { status: 401, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Le format de la requête est invalide.',
        },
        { status: 400, headers: NO_STORE_CACHE_HEADERS }
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: 'Impossible de lire les données du formulaire.',
      },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const validation = validateOnboardingAgencyInput(body);
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Veuillez corriger les champs signalés dans le formulaire.',
        fieldErrors: validation.errors,
      },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const rpcParams = buildCreateAgencyRpcParams(validation.data);

  const { data: createdAgency, error: rpcError } = await supabase.rpc(
    'create_agency',
    rpcParams
  );

  if (rpcError) {
    const mapped = mapCreateAgencyRpcError(rpcError);
    return NextResponse.json(
      {
        ok: false,
        error: mapped.message,
        fieldErrors: mapped.fieldErrors,
      },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const agency = (
    Array.isArray(createdAgency) ? createdAgency[0] : createdAgency
  ) as AgencyRecord | null;

  if (!agency || !agency.id) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'La création de l’agence n’a pas renvoyé de fiche valide. Veuillez réessayer.',
      },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      agency,
      role: 'owner' as const,
      redirectTo: '/',
    },
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );

  response.cookies.set(
    ACTIVE_AGENCY_COOKIE_NAME,
    agency.id,
    getActiveAgencyCookieOptions(request)
  );

  return response;
}
