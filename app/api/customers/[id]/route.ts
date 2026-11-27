import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  getAgencyCustomerByIdWithClient,
  updateAgencyCustomerByIdWithClient,
} from '@/lib/customers/server';
import { canManageCustomers } from '@/lib/customers/types';
import { validateCustomerPatchPayload } from '@/lib/customers/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customers/[id]
 * Reads a single customer strictly scoped to the authenticated user's verified active agency.
 * Accessible to active Owners, Managers, and Agents (matching existing PostgreSQL RLS).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!canManageCustomers(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : vous ne disposez pas des droits nécessaires pour consulter ce client.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de client invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const result = await getAgencyCustomerByIdWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    customerId: id,
  });

  if (result.error || !result.customer) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error ?? 'Client introuvable dans votre agence.',
      },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      customer: result.customer,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * PATCH /api/customers/[id]
 * Applies a validated partial update to an existing customer strictly scoped
 * to the authenticated user's verified active agency.
 * Accessible to active Owners, Managers, and Agents (matching existing PostgreSQL RLS).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isTrustedOriginRequest(request)) {
    return NextResponse.json(
      { ok: false, error: 'Requête refusée : origine non autorisée.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!canManageCustomers(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : vous ne disposez pas des droits nécessaires pour modifier ce client.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de client invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { ok: false, error: 'Le format de la requête est invalide.' },
        { status: 400, headers: NO_STORE_CACHE_HEADERS }
      );
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Impossible de lire les données du client.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const validation = validateCustomerPatchPayload(body);
  if (!validation.valid || !validation.data) {
    return NextResponse.json(
      {
        ok: false,
        error:
          validation.error ??
          'Veuillez corriger les champs signalés dans le formulaire.',
        ...(Object.keys(validation.errors).length > 0
          ? { fieldErrors: validation.errors }
          : {}),
      },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const result = await updateAgencyCustomerByIdWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    customerId: id,
    patch: validation.data,
  });

  if (result.error || !result.customer) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error ??
          'Une erreur est survenue lors de la mise à jour du client.',
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      customer: result.customer,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}
