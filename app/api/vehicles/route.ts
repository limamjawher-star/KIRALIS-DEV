import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import {
  resolveAuthenticatedAgencyForApi,
  VEHICLE_SELECT_COLUMNS,
} from '@/lib/vehicles/server';
import { canManageVehicles, type VehicleRecord } from '@/lib/vehicles/types';
import {
  mapVehicleDbError,
  validateVehiclePayload,
} from '@/lib/vehicles/validation';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vehicles
 * Lists vehicles strictly scoped to the authenticated user's verified active agency.
 * Accessible to active Owners, Managers, and Agents (enforced by server + RLS).
 */
export async function GET() {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .select(VEHICLE_SELECT_COLUMNS)
    .eq('agency_id', ctx.activeAgency.id)
    .order('created_at', { ascending: false });

  if (error) {
    const mapped = mapVehicleDbError(error);
    return NextResponse.json(
      { ok: false, error: mapped.message },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      agencyId: ctx.activeAgency.id,
      role: ctx.activeMembership.role,
      vehicles: (data as unknown as VehicleRecord[] | null) ?? [],
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * POST /api/vehicles
 * Creates a vehicle in public.vehicles scoped strictly to the active agency.
 * Restricted to active Owners and Managers (server RBAC + PostgreSQL RLS).
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

  if (!canManageVehicles(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : seuls les propriétaires et gestionnaires peuvent ajouter un véhicule.',
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
      { ok: false, error: 'Impossible de lire les données du véhicule.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

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

  // Strictly bind tenant and attribution from verified server session (never from client body)
  const insertPayload = {
    agency_id: ctx.activeAgency.id,
    created_by: ctx.user.id,
    currency_code: ctx.activeAgency.currency_code || 'TND',
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

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .insert(insertPayload)
    .select(VEHICLE_SELECT_COLUMNS)
    .single();

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

  return NextResponse.json(
    {
      ok: true,
      vehicle: data as unknown as VehicleRecord,
    },
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );
}
