import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
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
  params: Promise<{ id: string; rateId: string }>;
}

/**
 * PATCH /api/vehicles/[id]/seasonal-rates/[rateId]
 * Updates or activates/deactivates a seasonal pricing rule scoped strictly to
 * the authenticated user's verified active agency and vehicle.
 * Restricted to active Owners and Managers (server RBAC + PostgreSQL RLS).
 * Destructive DELETE is intentionally not implemented to preserve pricing history.
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

  if (!canManageVehicles(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : seuls les propriétaires et gestionnaires peuvent modifier un tarif saisonnier.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { id, rateId } = await params;
  if (!isValidUuid(id) || !isValidUuid(rateId)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de véhicule ou de règle tarifaire invalide.' },
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
      { ok: false, error: 'Impossible de lire les données de mise à jour.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  // Verify vehicle ownership in the verified active agency
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

  let updatePayload: Record<string, unknown>;

  if (body.toggleActiveOnly === true) {
    if (typeof body.is_active !== 'boolean') {
      return NextResponse.json(
        { ok: false, error: 'État d’activation invalide.' },
        { status: 400, headers: NO_STORE_CACHE_HEADERS }
      );
    }
    updatePayload = { is_active: body.is_active };
  } else {
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

    // Only mutable columns granted by migration 0005
    updatePayload = {
      label: validation.data.label,
      start_date: validation.data.start_date,
      end_date: validation.data.end_date,
      daily_rate_minor: validation.data.daily_rate_minor,
      is_active: validation.data.is_active,
    };
  }

  const { data, error } = await ctx.supabase
    .from('vehicle_seasonal_rates')
    .update(updatePayload)
    .eq('id', rateId)
    .eq('vehicle_id', id)
    .eq('agency_id', ctx.activeAgency.id)
    .select(SEASONAL_RATE_SELECT_COLUMNS)
    .maybeSingle();

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

  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Règle tarifaire saisonnière introuvable.' },
      { status: 404, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      pricingSchemaReady: true,
      rate: data as unknown as VehicleSeasonalRateRecord,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}
