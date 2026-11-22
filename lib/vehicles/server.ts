import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  ACTIVE_AGENCY_COOKIE_NAME,
  resolveSelectedMembership,
  type AgencyMembershipWithAgency,
  type AgencyRecord,
  type AgencyRole,
  type MembershipStatus,
} from '@/lib/agency/types';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isMissingPricingColumnError } from './pricing';
import type { VehicleRecord } from './types';
import { isMissingComplianceColumnError } from './validation';

export const VEHICLE_BASE_SELECT_COLUMNS = [
  'id',
  'agency_id',
  'plate_number',
  'vin',
  'brand',
  'model',
  'model_year',
  'category',
  'transmission',
  'fuel_type',
  'seats',
  'odometer_km',
  'daily_rate_minor',
  'deposit_minor',
  'currency_code',
  'status',
  'notes',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export const VEHICLE_COMPLIANCE_SELECT_COLUMNS = [
  VEHICLE_BASE_SELECT_COLUMNS,
  'insurance_expires_on',
  'technical_inspection_expires_on',
  'vignette_expires_on',
].join(', ');

export const VEHICLE_SELECT_COLUMNS = [
  VEHICLE_COMPLIANCE_SELECT_COLUMNS,
  'weekly_rate_minor',
  'monthly_rate_minor',
].join(', ');

export const SEASONAL_RATE_SELECT_COLUMNS = [
  'id',
  'agency_id',
  'vehicle_id',
  'label',
  'start_date',
  'end_date',
  'daily_rate_minor',
  'is_active',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

function parseNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

export function hydrateVehicleComplianceDefaults(
  row: Record<string, unknown>
): VehicleRecord {
  return {
    ...(row as unknown as VehicleRecord),
    weekly_rate_minor: parseNullableNumber(row.weekly_rate_minor),
    monthly_rate_minor: parseNullableNumber(row.monthly_rate_minor),
    insurance_expires_on:
      typeof row.insurance_expires_on === 'string'
        ? row.insurance_expires_on
        : null,
    technical_inspection_expires_on:
      typeof row.technical_inspection_expires_on === 'string'
        ? row.technical_inspection_expires_on
        : null,
    vignette_expires_on:
      typeof row.vignette_expires_on === 'string'
        ? row.vignette_expires_on
        : null,
  };
}

interface RawMembershipRow {
  id: string;
  agency_id: string;
  role: AgencyRole;
  status: MembershipStatus;
  created_at: string;
  agency: AgencyRecord | AgencyRecord[] | null;
}

export type ApiAgencyResolution =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
      activeMembership: AgencyMembershipWithAgency;
      activeAgency: AgencyRecord;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

/**
 * Resolves the authenticated user and their verified active agency for API routes.
 * - Verifies identity with supabase.auth.getUser() (never trusts getSession())
 * - Queries public.agency_memberships via RLS with the user's JWT
 * - Never trusts client-provided agency_id values
 */
export async function resolveAuthenticatedAgencyForApi(): Promise<ApiAgencyResolution> {
  if (!hasSupabaseEnv(process.env)) {
    return {
      ok: false,
      status: 503,
      error: 'Configuration Supabase manquante sur le serveur.',
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      status: 401,
      error: 'Authentification requise.',
    };
  }

  const { data: rawRows, error: membershipError } = await supabase
    .from('agency_memberships')
    .select(
      `
      id,
      agency_id,
      role,
      status,
      created_at,
      agency:agencies (
        id,
        name,
        legal_name,
        slug,
        tax_id,
        email,
        phone,
        city,
        address,
        country_code,
        currency_code,
        currency_minor_unit,
        timezone,
        default_locale,
        vat_rate_bps,
        created_at,
        updated_at
      )
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  if (membershipError) {
    return {
      ok: false,
      status: 500,
      error: 'Impossible de vérifier votre appartenance à l’agence.',
    };
  }

  const memberships: AgencyMembershipWithAgency[] = [];
  for (const row of (rawRows as RawMembershipRow[] | null) ?? []) {
    if (row.status !== 'active') continue;
    const joinedAgency = Array.isArray(row.agency) ? row.agency[0] : row.agency;
    if (!joinedAgency || !joinedAgency.id) continue;
    memberships.push({
      id: row.id,
      agency_id: row.agency_id,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      agency: joinedAgency,
    });
  }

  const cookieStore = await cookies();
  const requestedAgencyId =
    cookieStore.get(ACTIVE_AGENCY_COOKIE_NAME)?.value ?? null;

  const activeMembership = resolveSelectedMembership(
    memberships,
    requestedAgencyId
  );

  if (!activeMembership || !activeMembership.agency) {
    return {
      ok: false,
      status: 403,
      error:
        'Aucune agence active associée à votre compte. Complétez la configuration de votre agence.',
    };
  }

  return {
    ok: true,
    supabase,
    user,
    activeMembership,
    activeAgency: activeMembership.agency,
  };
}

/**
 * Fetches all vehicles strictly scoped to the verified active agency via Supabase RLS.
 * Safely falls back to Phase 5B.1 (compliance) or Phase 5A (base) columns when
 * migrations 0005 or 0004 are not yet installed in the remote database.
 */
export async function listAgencyVehicles(agencyId: string): Promise<{
  vehicles: VehicleRecord[];
  error: string | null;
  complianceSchemaReady: boolean;
  pricingSchemaReady: boolean;
}> {
  if (!hasSupabaseEnv(process.env)) {
    return {
      vehicles: [],
      error: 'Configuration Supabase manquante.',
      complianceSchemaReady: false,
      pricingSchemaReady: false,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('vehicles')
      .select(VEHICLE_SELECT_COLUMNS)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error && isMissingPricingColumnError(error)) {
      const complianceFallback = await supabase
        .from('vehicles')
        .select(VEHICLE_COMPLIANCE_SELECT_COLUMNS)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (
        complianceFallback.error &&
        isMissingComplianceColumnError(complianceFallback.error)
      ) {
        const baseFallback = await supabase
          .from('vehicles')
          .select(VEHICLE_BASE_SELECT_COLUMNS)
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });

        if (baseFallback.error) {
          return {
            vehicles: [],
            error: 'Impossible de charger les véhicules de votre agence.',
            complianceSchemaReady: false,
            pricingSchemaReady: false,
          };
        }

        const hydrated = (
          (baseFallback.data as unknown as Record<string, unknown>[] | null) ??
          []
        ).map(hydrateVehicleComplianceDefaults);

        return {
          vehicles: hydrated,
          error: null,
          complianceSchemaReady: false,
          pricingSchemaReady: false,
        };
      }

      if (complianceFallback.error) {
        return {
          vehicles: [],
          error: 'Impossible de charger les véhicules de votre agence.',
          complianceSchemaReady: true,
          pricingSchemaReady: false,
        };
      }

      const hydrated = (
        (complianceFallback.data as unknown as Record<string, unknown>[] | null) ??
        []
      ).map(hydrateVehicleComplianceDefaults);

      return {
        vehicles: hydrated,
        error: null,
        complianceSchemaReady: true,
        pricingSchemaReady: false,
      };
    }

    if (error && isMissingComplianceColumnError(error)) {
      const fallback = await supabase
        .from('vehicles')
        .select(VEHICLE_BASE_SELECT_COLUMNS)
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false });

      if (fallback.error) {
        return {
          vehicles: [],
          error: 'Impossible de charger les véhicules de votre agence.',
          complianceSchemaReady: false,
          pricingSchemaReady: false,
        };
      }

      const hydrated = (
        (fallback.data as unknown as Record<string, unknown>[] | null) ?? []
      ).map(hydrateVehicleComplianceDefaults);

      return {
        vehicles: hydrated,
        error: null,
        complianceSchemaReady: false,
        pricingSchemaReady: false,
      };
    }

    if (error) {
      return {
        vehicles: [],
        error: 'Impossible de charger les véhicules de votre agence.',
        complianceSchemaReady: true,
        pricingSchemaReady: true,
      };
    }

    const hydrated = (
      (data as unknown as Record<string, unknown>[] | null) ?? []
    ).map(hydrateVehicleComplianceDefaults);

    return {
      vehicles: hydrated,
      error: null,
      complianceSchemaReady: true,
      pricingSchemaReady: true,
    };
  } catch {
    return {
      vehicles: [],
      error: 'Erreur réseau lors du chargement du parc automobile.',
      complianceSchemaReady: false,
      pricingSchemaReady: false,
    };
  }
}
