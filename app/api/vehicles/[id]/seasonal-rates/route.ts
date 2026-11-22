import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  isMissingSeasonalRatesTableError,
  mapSeasonalRateDbError,
  validateSeasonalRatePayload,
  type VehicleSeasonalRateRecord,
} from '@/lib/vehicles/pricing';
import {
  resolveAuthenticatedAgencyForApi,
  SEASONAL_RATE_SELECT_COLUMNS,
} from '@/lib/vehicles/server';
import { canManageVehicles } from '@/lib/vehicles/types';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vehicles/[id]/seasonal-rates
 * Lists seasonal pricing rules for a single vehicle strictly scoped to the
 * authenticated user's verified active agency. Accessible to Owner, Manager, Agent.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de véhicule invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  // Verify the vehicle belongs strictly to the active agency before reading child rules
  const { data: vehicleRow, error: vehicleError } = await ctx.supabase
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('agency_id', ctx.activeAgency.id)
    .maybeSingle();

  if (vehicleError) {
    return NextResponse.json(
      { ok: false, error: 'Impossible de vérifier le véhicule demandé.' },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!vehicleRow) {
    return NextResponse.json(
      { ok: false, error: 'Véhicule introuvable dans votre agence.' },
      { status: 404, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { data, error } = await ctx.supabase
    .from('vehicle_seasonal_rates')
    .select(SEASONAL_RATE_SELECT_COLUMNS)
    .eq('agency_id', ctx.activeAgency.id)
    .eq('vehicle_id', id)
    .order('is_active', { ascending: false })
    .order('start_date', { ascending: true });

  if (error && isMissingSeasonalRatesTableError(error)) {
    return NextResponse.json(
      {
        ok: true,
        pricingSchemaReady: false,
        rates: [] as VehicleSeasonalRateRecord[],
      },
      { status: 200, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (error) {
    const mapped = mapSeasonalRateDbError(error);
    return NextResponse.json(
      { ok: false, error: mapped.message },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      pricingSchemaReady: true,
      rates: (data as unknown as VehicleSeasonalRateRecord[] | null) ?? [],
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * POST /api/vehicles/[id]/seasonal-rates
 * Creates a new seasonal rate rule for a vehicle belonging to the active agency.
 * Restricted to active Owners and Managers (server RBAC + PostgreSQL RLS).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  if (!canManageVehicles(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : seuls les propriétaires et gestionnaires peuvent créer un tarif saisonnier.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { id } = await params;
  if (!isValidUuid(id)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de véhicule invalide.' },
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
      { ok: false, error: 'Impossible de lire les données du tarif saisonnier.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const validation = validateSeasonalRatePayload(body);
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

  // Verify vehicle belongs strictly to the authenticated active agency
  const { data: vehicleRow, error: vehicleError } = await ctx.supabase
    .from('vehicles')
    .select('id')
    .eq('id', id)
    .eq('agency_id', ctx.activeAgency.id)
    .maybeSingle();

  if (vehicleError) {
    return NextResponse.json(
      { ok: false, error: 'Impossible de vérifier le véhicule demandé.' },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!vehicleRow) {
    return NextResponse.json(
      { ok: false, error: 'Véhicule introuvable dans votre agence.' },
      { status: 404, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  // Strictly derive agency_id and created_by from verified server context
  const insertPayload = {
    agency_id: ctx.activeAgency.id,
    vehicle_id: id,
    created_by: ctx.user.id,
    label: validation.data.label,
    start_date: validation.data.start_date,
    end_date: validation.data.end_date,
    daily_rate_minor: validation.data.daily_rate_minor,
    is_active: validation.data.is_active,
  };

  const { data, error } = await ctx.supabase
    .from('vehicle_seasonal_rates')
    .insert(insertPayload)
    .select(SEASONAL_RATE_SELECT_COLUMNS)
    .single();

  if (error) {
    const mapped = mapSeasonalRateDbError(error);
    return NextResponse.json(
      {
        ok: false,
        error: mapped.message,
        fieldErrors: mapped.fieldErrors,
        missingPricingSchema: mapped.missingPricingSchema,
      },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      pricingSchemaReady: true,
      rate: data as unknown as VehicleSeasonalRateRecord,
    },
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );
}
