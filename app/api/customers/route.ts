import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  createAgencyCustomerWithClient,
  listAgencyCustomersWithClient,
} from '@/lib/customers/server';
import { canManageCustomers } from '@/lib/customers/types';
import { validateCustomerPayload } from '@/lib/customers/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/customers
 * Lists customers strictly scoped to the authenticated user's verified active agency.
 * Accessible to active Owners, Managers, and Agents (enforced by server session + PostgreSQL RLS).
 */
export async function GET() {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const result = await listAgencyCustomersWithClient(
    ctx.supabase,
    ctx.activeAgency.id
  );

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      agencyId: ctx.activeAgency.id,
      role: ctx.activeMembership.role,
      customers: result.customers,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * POST /api/customers
 * Creates a customer in public.customers strictly scoped to the verified active agency.
 * Accessible to active Owners, Managers, and Agents (matching existing PostgreSQL RLS).
 */
export async function POST(request: NextRequest) {
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
          'Accès refusé : vous ne disposez pas des droits nécessaires pour ajouter un client.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
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

  const validation = validateCustomerPayload(body);
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

  const result = await createAgencyCustomerWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    createdByUserId: ctx.user.id,
    payload: validation.data,
  });

  if (result.error || !result.customer) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error ??
          'Une erreur est survenue lors de l’enregistrement du client.',
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
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );
}
