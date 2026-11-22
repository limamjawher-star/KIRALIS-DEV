import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  resolveAuthenticatedAgencyForApi,
  VEHICLE_SELECT_COLUMNS,
} from '@/lib/vehicles/server';
import { canManageVehicles, type VehicleRecord } from '@/lib/vehicles/types';
import {
  mapVehicleDbError,
  validateStatusOnlyPatch,
  validateVehiclePayload,
} from '@/lib/vehicles/validation';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/vehicles/[id]
 * Reads a single vehicle strictly scoped to the verified active agency.
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

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .select(VEHICLE_SELECT_COLUMNS)
    .eq('id', id)
    .eq('agency_id', ctx.activeAgency.id)
    .maybeSingle();

  if (error) {
    const mapped = mapVehicleDbError(error);
    return NextResponse.json(
      { ok: false, error: mapped.message },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Véhicule introuvable dans votre agence.' },
      { status: 404, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    { ok: true, vehicle: data as unknown as VehicleRecord },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * PATCH /api/vehicles/[id]
 * Updates vehicle details or transitions lifecycle status (e.g., archive/retire -> 'retired').
 * Restricted to active Owners and Managers (server RBAC + PostgreSQL RLS).
 * Destructive DELETE is intentionally not implemented in Phase 5A.
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
          'Accès refusé : seuls les propriétaires et gestionnaires peuvent modifier un véhicule.',
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
      { ok: false, error: 'Impossible de lire les données de mise à jour.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  let updatePayload: Record<string, unknown>;

  if (body.statusOnly === true) {
    const statusCheck = validateStatusOnlyPatch(body);
    if (!statusCheck.valid || !statusCheck.status) {
      return NextResponse.json(
        { ok: false, error: statusCheck.error ?? 'Statut invalide.' },
        { status: 400, headers: NO_STORE_CACHE_HEADERS }
      );
    }
    updatePayload = {
      status: statusCheck.status,
    };
  } else {
    const validation = validateVehiclePayload(body);
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

    // Only mutable columns granted by migration 0002 (never id, agency_id, created_by, created_at)
    updatePayload = {
      plate_number: validation.data.plate_number,
      vin: validation.data.vin,
      brand: validation.data.brand,
      model: validation.data.model,
      model_year: validation.data.model_year,
      category: validation.data.category,
      transmission: validation.data.transmission,
      fuel_type: validation.data.fuel_type,
      seats: validation.data.seats,
      odometer_km: validation.data.odometer_km,
      daily_rate_minor: validation.data.daily_rate_minor,
      deposit_minor: validation.data.deposit_minor,
      status: validation.data.status,
      notes: validation.data.notes,
    };
  }

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .update(updatePayload)
    .eq('id', id)
    .eq('agency_id', ctx.activeAgency.id)
    .select(VEHICLE_SELECT_COLUMNS)
    .maybeSingle();

  if (error) {
    const mapped = mapVehicleDbError(error);
    return NextResponse.json(
      {
        ok: false,
        error: mapped.message,
        fieldErrors: mapped.fieldErrors,
      },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!data) {
    return NextResponse.json(
      { ok: false, error: 'Véhicule introuvable dans votre agence.' },
      { status: 404, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    { ok: true, vehicle: data as unknown as VehicleRecord },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}
