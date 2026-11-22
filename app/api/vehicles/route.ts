import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { isMissingPricingColumnError } from '@/lib/vehicles/pricing';
import {
  hydrateVehicleComplianceDefaults,
  resolveAuthenticatedAgencyForApi,
  VEHICLE_BASE_SELECT_COLUMNS,
  VEHICLE_COMPLIANCE_SELECT_COLUMNS,
  VEHICLE_SELECT_COLUMNS,
} from '@/lib/vehicles/server';
import { canManageVehicles } from '@/lib/vehicles/types';
import {
  isMissingComplianceColumnError,
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

  if (error && isMissingPricingColumnError(error)) {
    const complianceFallback = await ctx.supabase
      .from('vehicles')
      .select(VEHICLE_COMPLIANCE_SELECT_COLUMNS)
      .eq('agency_id', ctx.activeAgency.id)
      .order('created_at', { ascending: false });

    if (
      complianceFallback.error &&
      isMissingComplianceColumnError(complianceFallback.error)
    ) {
      const baseFallback = await ctx.supabase
        .from('vehicles')
        .select(VEHICLE_BASE_SELECT_COLUMNS)
        .eq('agency_id', ctx.activeAgency.id)
        .order('created_at', { ascending: false });

      if (baseFallback.error) {
        const mapped = mapVehicleDbError(baseFallback.error);
        return NextResponse.json(
          { ok: false, error: mapped.message },
          { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
        );
      }

      const hydrated = (
        (baseFallback.data as unknown as Record<string, unknown>[] | null) ?? []
      ).map(hydrateVehicleComplianceDefaults);

      return NextResponse.json(
        {
          ok: true,
          agencyId: ctx.activeAgency.id,
          role: ctx.activeMembership.role,
          complianceSchemaReady: false,
          pricingSchemaReady: false,
          vehicles: hydrated,
        },
        { status: 200, headers: NO_STORE_CACHE_HEADERS }
      );
    }

    if (complianceFallback.error) {
      const mapped = mapVehicleDbError(complianceFallback.error);
      return NextResponse.json(
        { ok: false, error: mapped.message },
        { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
      );
    }

    const hydrated = (
      (complianceFallback.data as unknown as Record<string, unknown>[] | null) ??
      []
    ).map(hydrateVehicleComplianceDefaults);

    return NextResponse.json(
      {
        ok: true,
        agencyId: ctx.activeAgency.id,
        role: ctx.activeMembership.role,
        complianceSchemaReady: true,
        pricingSchemaReady: false,
        vehicles: hydrated,
      },
      { status: 200, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (error && isMissingComplianceColumnError(error)) {
    const fallback = await ctx.supabase
      .from('vehicles')
      .select(VEHICLE_BASE_SELECT_COLUMNS)
      .eq('agency_id', ctx.activeAgency.id)
      .order('created_at', { ascending: false });

    if (fallback.error) {
      const mapped = mapVehicleDbError(fallback.error);
      return NextResponse.json(
        { ok: false, error: mapped.message },
        { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
      );
    }

    const hydrated = (
      (fallback.data as unknown as Record<string, unknown>[] | null) ?? []
    ).map(hydrateVehicleComplianceDefaults);

    return NextResponse.json(
      {
        ok: true,
        agencyId: ctx.activeAgency.id,
        role: ctx.activeMembership.role,
        complianceSchemaReady: false,
        pricingSchemaReady: false,
        vehicles: hydrated,
      },
      { status: 200, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (error) {
    const mapped = mapVehicleDbError(error);
    return NextResponse.json(
      { ok: false, error: mapped.message },
      { status: mapped.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const hydrated = (
    (data as unknown as Record<string, unknown>[] | null) ?? []
  ).map(hydrateVehicleComplianceDefaults);

  return NextResponse.json(
    {
      ok: true,
      agencyId: ctx.activeAgency.id,
      role: ctx.activeMembership.role,
      complianceSchemaReady: true,
      pricingSchemaReady: true,
      vehicles: hydrated,
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
  const baseInsertPayload = {
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

  const complianceInsertPayload = {
    ...baseInsertPayload,
    insurance_expires_on: validation.data.insurance_expires_on,
    technical_inspection_expires_on:
      validation.data.technical_inspection_expires_on,
    vignette_expires_on: validation.data.vignette_expires_on,
  };

  const fullInsertPayload = {
    ...complianceInsertPayload,
    weekly_rate_minor: validation.data.weekly_rate_minor,
    monthly_rate_minor: validation.data.monthly_rate_minor,
  };

  const hasComplianceDates =
    validation.data.insurance_expires_on !== null ||
    validation.data.technical_inspection_expires_on !== null ||
    validation.data.vignette_expires_on !== null;

  const hasPackageRates =
    validation.data.weekly_rate_minor !== null ||
    validation.data.monthly_rate_minor !== null;

  const { data, error } = await ctx.supabase
    .from('vehicles')
    .insert(fullInsertPayload)
    .select(VEHICLE_SELECT_COLUMNS)
    .single();

  if (error && isMissingPricingColumnError(error) && !hasPackageRates) {
    const complianceFallback = await ctx.supabase
      .from('vehicles')
      .insert(complianceInsertPayload)
      .select(VEHICLE_COMPLIANCE_SELECT_COLUMNS)
      .single();

    if (
      complianceFallback.error &&
      isMissingComplianceColumnError(complianceFallback.error) &&
      !hasComplianceDates
    ) {
      const baseFallback = await ctx.supabase
        .from('vehicles')
        .insert(baseInsertPayload)
        .select(VEHICLE_BASE_SELECT_COLUMNS)
        .single();

      if (baseFallback.error) {
        const mapped = mapVehicleDbError(baseFallback.error);
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
          complianceSchemaReady: false,
          pricingSchemaReady: false,
          vehicle: hydrateVehicleComplianceDefaults(
            baseFallback.data as unknown as Record<string, unknown>
          ),
        },
        { status: 201, headers: NO_STORE_CACHE_HEADERS }
      );
    }

    if (complianceFallback.error) {
      const mapped = mapVehicleDbError(complianceFallback.error);
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
        complianceSchemaReady: true,
        pricingSchemaReady: false,
        vehicle: hydrateVehicleComplianceDefaults(
          complianceFallback.data as unknown as Record<string, unknown>
        ),
      },
      { status: 201, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (error && isMissingComplianceColumnError(error) && !hasComplianceDates && !hasPackageRates) {
    const fallback = await ctx.supabase
      .from('vehicles')
      .insert(baseInsertPayload)
      .select(VEHICLE_BASE_SELECT_COLUMNS)
      .single();

    if (fallback.error) {
      const mapped = mapVehicleDbError(fallback.error);
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
        complianceSchemaReady: false,
        pricingSchemaReady: false,
        vehicle: hydrateVehicleComplianceDefaults(
          fallback.data as unknown as Record<string, unknown>
        ),
      },
      { status: 201, headers: NO_STORE_CACHE_HEADERS }
    );
  }

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
      complianceSchemaReady: true,
      pricingSchemaReady: true,
      vehicle: hydrateVehicleComplianceDefaults(
        data as unknown as Record<string, unknown>
      ),
    },
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );
}
