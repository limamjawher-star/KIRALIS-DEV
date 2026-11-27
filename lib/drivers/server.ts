import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { getAgencyCustomerByIdWithClient } from '@/lib/customers/server';
import type { AgencyRole } from '@/lib/supabase/database.types';
import {
  resolveAuthenticatedAgencyForApi,
  type ApiAgencyResolution,
} from '@/lib/vehicles/server';
import {
  createDriverEligibilityRuleSet,
  DEFAULT_TUNISIA_DRIVER_RULE_SET,
  evaluateDriverEligibility,
  summarizeCustomerDriversEligibility,
} from './eligibility';
import {
  canManageCustomerDrivers,
  canReadCustomerDrivers,
  EDITABLE_CUSTOMER_DRIVER_FIELDS,
  type CustomerDriverRecord,
  type CustomerDriversEligibilitySummary,
  type DriverEligibilityAssessment,
} from './types';
import {
  mapDriverWriteDbError,
  validateCreateCustomerDriverPayload,
  validatePatchCustomerDriverPayload,
  type DriverFieldErrors,
  type ValidatedCreateCustomerDriverPayload,
  type ValidatedPatchCustomerDriverPayload,
} from './validation';

/**
 * Operational columns readable by active Owners and Managers on public.customer_drivers.
 * Matches migration 0007 schema (no licence numbers, IDs, or document scans exist).
 */
export const CUSTOMER_DRIVER_MANAGER_SELECT_COLUMNS = [
  'id',
  'agency_id',
  'customer_id',
  'full_name',
  'licence_issuing_country',
  'licence_category',
  'licence_expires_on',
  'verification_status',
  'verification_notes',
  'is_active',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

/**
 * Least-privilege column projection omitting internal/personal verification_notes.
 * Used for read-only Agent GET queries and POST creation responses.
 */
export const CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS = [
  'id',
  'agency_id',
  'customer_id',
  'full_name',
  'licence_issuing_country',
  'licence_category',
  'licence_expires_on',
  'verification_status',
  'is_active',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export type CustomerDriverApiRecord = Omit<
  CustomerDriverRecord,
  'verification_notes'
> & {
  verification_notes?: string | null;
  eligibility: DriverEligibilityAssessment;
};

export interface ListCustomerDriversResult {
  drivers: CustomerDriverApiRecord[];
  summary: CustomerDriversEligibilitySummary | null;
  error: string | null;
  status: number;
}

export interface CreateCustomerDriverResult {
  driver: CustomerDriverApiRecord | null;
  error: string | null;
  status: number;
  fieldErrors?: DriverFieldErrors;
}

export interface UpdateCustomerDriverResult {
  driver: CustomerDriverApiRecord | null;
  error: string | null;
  status: number;
  fieldErrors?: DriverFieldErrors;
}

interface PostgresLikeError {
  code?: string | null;
  message?: string | null;
}

export function mapDriverReadDbError(error: PostgresLikeError): {
  status: number;
  message: string;
} {
  if (error.code === '42501') {
    return {
      status: 403,
      message:
        'Accès refusé : vous ne disposez pas des droits nécessaires pour consulter les conducteurs autorisés.',
    };
  }

  if (error.code === '22P02') {
    return {
      status: 400,
      message: 'Identifiant de client invalide.',
    };
  }

  return {
    status: 500,
    message:
      'Impossible de charger les conducteurs autorisés pour ce client.',
  };
}

/**
 * Selects only the columns permitted for the caller's role and strips
 * verification_notes defensively for read-only Agents.
 */
export function getDriverSelectColumnsForRole(role: AgencyRole): string {
  return canManageCustomerDrivers(role)
    ? CUSTOMER_DRIVER_MANAGER_SELECT_COLUMNS
    : CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS;
}

function shapeDriverForResponse(
  row: Omit<CustomerDriverRecord, 'verification_notes'> & {
    verification_notes?: string | null;
  },
  includeVerificationNotes: boolean,
  eligibility: DriverEligibilityAssessment
): CustomerDriverApiRecord {
  const base: CustomerDriverApiRecord = {
    id: row.id,
    agency_id: row.agency_id,
    customer_id: row.customer_id,
    full_name: row.full_name,
    licence_issuing_country: row.licence_issuing_country,
    licence_category: row.licence_category,
    licence_expires_on: row.licence_expires_on,
    verification_status: row.verification_status,
    is_active: row.is_active,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
    eligibility,
  };

  if (includeVerificationNotes) {
    base.verification_notes = row.verification_notes ?? null;
  }

  return base;
}

function resolveAgencyEligibilityRuleSet(agencyCountryCode?: string | null) {
  const countryCode = agencyCountryCode?.trim().toUpperCase();
  return !countryCode || countryCode === 'TN'
    ? DEFAULT_TUNISIA_DRIVER_RULE_SET
    : createDriverEligibilityRuleSet({ jurisdictionCode: countryCode });
}

/**
 * Lists authorized drivers for a verified customer strictly scoped to the
 * authenticated user's active agency, relying on PostgreSQL RLS and explicit
 * tenant + customer filters. Never logs driver personal data.
 */
export async function listCustomerDriversWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    customerId: string;
    role: AgencyRole;
    agencyTimeZone?: string | null;
    agencyCountryCode?: string | null;
    now?: Date;
  }
): Promise<ListCustomerDriversResult> {
  if (!canReadCustomerDrivers(params.role)) {
    return {
      drivers: [],
      summary: null,
      error:
        'Accès refusé : vous ne disposez pas des droits nécessaires pour consulter les conducteurs autorisés.',
      status: 403,
    };
  }

  if (!isValidUuid(params.customerId)) {
    return {
      drivers: [],
      summary: null,
      error: 'Identifiant de client invalide.',
      status: 400,
    };
  }

  // Verify the customer exists and belongs to the authenticated active agency
  const customerCheck = await getAgencyCustomerByIdWithClient(supabase, {
    agencyId: params.agencyId,
    customerId: params.customerId,
  });

  if (customerCheck.error || !customerCheck.customer) {
    return {
      drivers: [],
      summary: null,
      error: customerCheck.error ?? 'Client introuvable dans votre agence.',
      status: customerCheck.status,
    };
  }

  const selectColumns = getDriverSelectColumnsForRole(params.role);

  try {
    const { data, error } = await supabase
      .from('customer_drivers')
      .select(selectColumns)
      .eq('agency_id', params.agencyId)
      .eq('customer_id', params.customerId)
      .order('is_active', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      const mapped = mapDriverReadDbError(error);
      return {
        drivers: [],
        summary: null,
        error: mapped.message,
        status: mapped.status,
      };
    }

    const rawRows = (
      (data as unknown as CustomerDriverRecord[] | null) ?? []
    ).filter(
      (row) =>
        row.agency_id === params.agencyId &&
        row.customer_id === params.customerId
    );

    const eligibilityOptions = {
      timeZone: params.agencyTimeZone,
      ruleSet: resolveAgencyEligibilityRuleSet(params.agencyCountryCode),
      now: params.now,
    };

    const includeNotes = canManageCustomerDrivers(params.role);
    const drivers = rawRows.map((row) => {
      const eligibility = evaluateDriverEligibility(row, eligibilityOptions);
      return shapeDriverForResponse(row, includeNotes, eligibility);
    });

    const summary = summarizeCustomerDriversEligibility(
      rawRows,
      eligibilityOptions
    );

    return {
      drivers,
      summary,
      error: null,
      status: 200,
    };
  } catch {
    return {
      drivers: [],
      summary: null,
      error: 'Erreur réseau lors du chargement des conducteurs autorisés.',
      status: 500,
    };
  }
}

/**
 * Inserts a new authorized driver strictly bound to the server-verified active
 * agency, verified customer, and authenticated user ID via PostgreSQL RLS.
 * Always initializes verification_status = 'unverified' and is_active = true,
 * relies on migration 0007's transactional DB audit trigger (no manual audit
 * insert), and omits verification_notes from the returned payload.
 */
export async function createCustomerDriverWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    customerId: string;
    createdByUserId: string;
    role: AgencyRole;
    payload: ValidatedCreateCustomerDriverPayload;
    agencyTimeZone?: string | null;
    agencyCountryCode?: string | null;
    now?: Date;
  }
): Promise<CreateCustomerDriverResult> {
  if (!canManageCustomerDrivers(params.role)) {
    return {
      driver: null,
      error:
        'Accès refusé : seuls le propriétaire et le gérant peuvent ajouter un conducteur autorisé.',
      status: 403,
    };
  }

  if (!isValidUuid(params.customerId)) {
    return {
      driver: null,
      error: 'Identifiant de client invalide.',
      status: 400,
    };
  }

  // Confirm the customer exists and belongs to the verified active agency
  const customerCheck = await getAgencyCustomerByIdWithClient(supabase, {
    agencyId: params.agencyId,
    customerId: params.customerId,
  });

  if (customerCheck.error || !customerCheck.customer) {
    return {
      driver: null,
      error: customerCheck.error ?? 'Client introuvable dans votre agence.',
      status: customerCheck.status,
    };
  }

  const insertPayload = {
    agency_id: params.agencyId,
    customer_id: params.customerId,
    created_by: params.createdByUserId,
    full_name: params.payload.full_name,
    licence_issuing_country: params.payload.licence_issuing_country,
    licence_category: params.payload.licence_category,
    licence_expires_on: params.payload.licence_expires_on,
    verification_status: 'unverified' as const,
    is_active: true,
  };

  try {
    const { data, error } = await supabase
      .from('customer_drivers')
      .insert(insertPayload)
      .select(CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS)
      .single();

    if (error) {
      const mapped = mapDriverWriteDbError(error);
      return {
        driver: null,
        error: mapped.message,
        status: mapped.status,
        fieldErrors: mapped.fieldErrors,
      };
    }

    if (!data) {
      return {
        driver: null,
        error: 'Impossible d’enregistrer le conducteur autorisé.',
        status: 500,
      };
    }

    const createdRow = data as unknown as CustomerDriverRecord;
    const eligibility = evaluateDriverEligibility(createdRow, {
      timeZone: params.agencyTimeZone,
      ruleSet: resolveAgencyEligibilityRuleSet(params.agencyCountryCode),
      now: params.now,
    });

    return {
      driver: shapeDriverForResponse(createdRow, false, eligibility),
      error: null,
      status: 201,
    };
  } catch {
    return {
      driver: null,
      error: 'Erreur réseau lors de l’enregistrement du conducteur autorisé.',
      status: 500,
    };
  }
}

/**
 * Executes GET /api/customers/[id]/drivers with injectable auth resolution for
 * deterministic unit testing while defaulting to live Supabase Auth SSR.
 */
export async function handleGetCustomerDrivers(
  customerId: string,
  deps: {
    resolveAuth?: () => Promise<ApiAgencyResolution>;
    now?: Date;
  } = {}
): Promise<NextResponse> {
  const resolveAuth = deps.resolveAuth ?? resolveAuthenticatedAgencyForApi;
  const ctx = await resolveAuth();

  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!canReadCustomerDrivers(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : vous ne disposez pas des droits nécessaires pour consulter les conducteurs autorisés.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!isValidUuid(customerId)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de client invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const result = await listCustomerDriversWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    customerId,
    role: ctx.activeMembership.role,
    agencyTimeZone: ctx.activeAgency.timezone,
    agencyCountryCode: ctx.activeAgency.country_code,
    now: deps.now,
  });

  if (result.error) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      customer_id: customerId,
      drivers: result.drivers,
      summary: result.summary,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * Executes POST /api/customers/[id]/drivers with CSRF/trusted-origin check,
 * Supabase Auth SSR verification, Owner/Manager RBAC, strict payload validation,
 * tenant customer ownership verification, and RLS-enforced persistence.
 */
export async function handlePostCustomerDriver(
  request: NextRequest,
  customerId: string,
  deps: {
    resolveAuth?: () => Promise<ApiAgencyResolution>;
    isTrustedOrigin?: (req: NextRequest) => boolean;
    now?: Date;
  } = {}
): Promise<NextResponse> {
  const checkOrigin = deps.isTrustedOrigin ?? isTrustedOriginRequest;
  if (!checkOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: 'Requête refusée : origine non autorisée.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const resolveAuth = deps.resolveAuth ?? resolveAuthenticatedAgencyForApi;
  const ctx = await resolveAuth();

  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!canManageCustomerDrivers(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : seuls le propriétaire et le gérant peuvent ajouter un conducteur autorisé.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!isValidUuid(customerId)) {
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
      { ok: false, error: 'Impossible de lire les données du conducteur.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const validation = validateCreateCustomerDriverPayload(body);
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

  const result = await createCustomerDriverWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    customerId,
    createdByUserId: ctx.user.id,
    role: ctx.activeMembership.role,
    payload: validation.data,
    agencyTimeZone: ctx.activeAgency.timezone,
    agencyCountryCode: ctx.activeAgency.country_code,
    now: deps.now,
  });

  if (result.error || !result.driver) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error ??
          'Impossible d’enregistrer le conducteur autorisé.',
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      driver: result.driver,
    },
    { status: 201, headers: NO_STORE_CACHE_HEADERS }
  );
}

/**
 * Applies a validated partial update to an existing authorized driver strictly
 * scoped to the verified customer AND verified active agency via PostgreSQL RLS.
 * Only Owner and Manager are permitted. Immutable columns and updated_at are
 * never written by application code; PostgreSQL triggers maintain updated_at and
 * write transactional audit logs.
 */
export async function updateCustomerDriverWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    customerId: string;
    driverId: string;
    role: AgencyRole;
    patch: ValidatedPatchCustomerDriverPayload;
    agencyTimeZone?: string | null;
    agencyCountryCode?: string | null;
    now?: Date;
  }
): Promise<UpdateCustomerDriverResult> {
  if (!canManageCustomerDrivers(params.role)) {
    return {
      driver: null,
      error:
        'Accès refusé : seuls le propriétaire et le gérant peuvent modifier un conducteur autorisé.',
      status: 403,
    };
  }

  if (!isValidUuid(params.customerId)) {
    return {
      driver: null,
      error: 'Identifiant de client invalide.',
      status: 400,
    };
  }

  if (!isValidUuid(params.driverId)) {
    return {
      driver: null,
      error: 'Identifiant de conducteur invalide.',
      status: 400,
    };
  }

  const updatePayload: Record<string, unknown> = {};
  for (const field of EDITABLE_CUSTOMER_DRIVER_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(params.patch, field) &&
      params.patch[field] !== undefined
    ) {
      updatePayload[field] = params.patch[field];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      driver: null,
      error: 'Aucun champ modifiable fourni.',
      status: 400,
    };
  }

  // 1. Confirm the customer belongs to the authenticated active agency
  const customerCheck = await getAgencyCustomerByIdWithClient(supabase, {
    agencyId: params.agencyId,
    customerId: params.customerId,
  });

  if (customerCheck.error || !customerCheck.customer) {
    return {
      driver: null,
      error: customerCheck.error ?? 'Client introuvable dans votre agence.',
      status: customerCheck.status,
    };
  }

  // 2. Update strictly scoped by driver ID, verified customer ID, and verified agency ID
  try {
    const { data, error } = await supabase
      .from('customer_drivers')
      .update(updatePayload)
      .eq('id', params.driverId)
      .eq('customer_id', params.customerId)
      .eq('agency_id', params.agencyId)
      .select(CUSTOMER_DRIVER_MANAGER_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      const mapped = mapDriverWriteDbError(error);
      return {
        driver: null,
        error: mapped.message,
        status: mapped.status,
        fieldErrors: mapped.fieldErrors,
      };
    }

    if (!data) {
      return {
        driver: null,
        error: 'Conducteur autorisé introuvable pour ce client dans votre agence.',
        status: 404,
      };
    }

    const updatedRow = data as unknown as CustomerDriverRecord;
    const eligibility = evaluateDriverEligibility(updatedRow, {
      timeZone: params.agencyTimeZone,
      ruleSet: resolveAgencyEligibilityRuleSet(params.agencyCountryCode),
      now: params.now,
    });

    return {
      driver: shapeDriverForResponse(updatedRow, true, eligibility),
      error: null,
      status: 200,
    };
  } catch {
    return {
      driver: null,
      error: 'Erreur réseau lors de la mise à jour du conducteur autorisé.',
      status: 500,
    };
  }
}

/**
 * Executes PATCH /api/customers/[id]/drivers/[driverId] with CSRF/trusted-origin
 * protection, Supabase Auth SSR verification, Owner/Manager RBAC, UUID and strict
 * partial-update validation, customer + driver tenant scoping, and RLS persistence.
 */
export async function handlePatchCustomerDriver(
  request: NextRequest,
  customerId: string,
  driverId: string,
  deps: {
    resolveAuth?: () => Promise<ApiAgencyResolution>;
    isTrustedOrigin?: (req: NextRequest) => boolean;
    now?: Date;
  } = {}
): Promise<NextResponse> {
  const checkOrigin = deps.isTrustedOrigin ?? isTrustedOriginRequest;
  if (!checkOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: 'Requête refusée : origine non autorisée.' },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const resolveAuth = deps.resolveAuth ?? resolveAuthenticatedAgencyForApi;
  const ctx = await resolveAuth();

  if (!ctx.ok) {
    return NextResponse.json(
      { ok: false, error: ctx.error },
      { status: ctx.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!canManageCustomerDrivers(ctx.activeMembership.role)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'Accès refusé : seuls le propriétaire et le gérant peuvent modifier un conducteur autorisé.',
      },
      { status: 403, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!isValidUuid(customerId)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de client invalide.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  if (!isValidUuid(driverId)) {
    return NextResponse.json(
      { ok: false, error: 'Identifiant de conducteur invalide.' },
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
      { ok: false, error: 'Impossible de lire les données du conducteur.' },
      { status: 400, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const validation = validatePatchCustomerDriverPayload(body);
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

  const result = await updateCustomerDriverWithClient(ctx.supabase, {
    agencyId: ctx.activeAgency.id,
    customerId,
    driverId,
    role: ctx.activeMembership.role,
    patch: validation.data,
    agencyTimeZone: ctx.activeAgency.timezone,
    agencyCountryCode: ctx.activeAgency.country_code,
    now: deps.now,
  });

  if (result.error || !result.driver) {
    return NextResponse.json(
      {
        ok: false,
        error:
          result.error ??
          'Impossible d’enregistrer les modifications du conducteur autorisé.',
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      },
      { status: result.status, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      driver: result.driver,
    },
    { status: 200, headers: NO_STORE_CACHE_HEADERS }
  );
}

