import type { SupabaseClient } from '@supabase/supabase-js';
import { isValidUuid } from '@/lib/agency/types';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  EDITABLE_CUSTOMER_FIELDS,
  type CustomerFieldErrors,
  type CustomerRecord,
  type ValidatedCustomerPatchPayload,
  type ValidatedCustomerPayload,
} from './types';
import { mapCustomerDbError } from './validation';

/**
 * Exact columns defined on public.customers in migration 0001.
 * Sensitive identity/document columns are intentionally absent.
 */
export const CUSTOMER_SELECT_COLUMNS = [
  'id',
  'agency_id',
  'customer_type',
  'full_name',
  'company_name',
  'email',
  'phone',
  'address',
  'city',
  'country_code',
  'notes',
  'created_by',
  'created_at',
  'updated_at',
].join(', ');

export interface ListAgencyCustomersResult {
  customers: CustomerRecord[];
  error: string | null;
}

export interface GetAgencyCustomerResult {
  customer: CustomerRecord | null;
  error: string | null;
  status: number;
}

export interface CreateAgencyCustomerResult {
  customer: CustomerRecord | null;
  error: string | null;
  status: number;
  fieldErrors?: CustomerFieldErrors;
}

export interface UpdateAgencyCustomerResult {
  customer: CustomerRecord | null;
  error: string | null;
  status: number;
  fieldErrors?: CustomerFieldErrors;
}

/**
 * Executes the tenant-scoped customer list query against an injected Supabase client.
 */
export async function listAgencyCustomersWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  agencyId: string
): Promise<ListAgencyCustomersResult> {
  try {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_SELECT_COLUMNS)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false });

    if (error) {
      return {
        customers: [],
        error: 'Impossible de charger les clients de votre agence.',
      };
    }

    return {
      customers: ((data as unknown as CustomerRecord[] | null) ?? []).slice(),
      error: null,
    };
  } catch {
    return {
      customers: [],
      error: 'Erreur réseau lors du chargement des clients.',
    };
  }
}

/**
 * Fetches all customers strictly scoped to the verified active agency via Supabase RLS.
 */
export async function listAgencyCustomers(
  agencyId: string
): Promise<ListAgencyCustomersResult> {
  if (!hasSupabaseEnv(process.env)) {
    return {
      customers: [],
      error: 'Configuration Supabase manquante.',
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    return await listAgencyCustomersWithClient(supabase, agencyId);
  } catch {
    return {
      customers: [],
      error: 'Erreur réseau lors du chargement des clients.',
    };
  }
}

/**
 * Reads a single customer strictly scoped to the server-verified active agency.
 * Returns 400 on invalid UUID, 404 when missing or inaccessible across agencies,
 * and safe mapped error responses on database failures.
 */
export async function getAgencyCustomerByIdWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    customerId: string;
  }
): Promise<GetAgencyCustomerResult> {
  if (!isValidUuid(params.customerId)) {
    return {
      customer: null,
      error: 'Identifiant de client invalide.',
      status: 400,
    };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .select(CUSTOMER_SELECT_COLUMNS)
      .eq('id', params.customerId)
      .eq('agency_id', params.agencyId)
      .maybeSingle();

    if (error) {
      const mapped = mapCustomerDbError(error);
      return {
        customer: null,
        error:
          mapped.status === 403 || mapped.status === 400
            ? mapped.message
            : 'Impossible de charger ce client.',
        status: mapped.status === 403 || mapped.status === 400 ? mapped.status : 500,
      };
    }

    if (!data) {
      return {
        customer: null,
        error: 'Client introuvable dans votre agence.',
        status: 404,
      };
    }

    return {
      customer: data as unknown as CustomerRecord,
      error: null,
      status: 200,
    };
  } catch {
    return {
      customer: null,
      error: 'Erreur réseau lors du chargement du client.',
      status: 500,
    };
  }
}

/**
 * Inserts a new customer strictly bound to the server-verified active agency
 * and authenticated user ID via PostgreSQL RLS (never trusts client tenant/user IDs).
 */
export async function createAgencyCustomerWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    createdByUserId: string;
    payload: ValidatedCustomerPayload;
  }
): Promise<CreateAgencyCustomerResult> {
  const insertPayload = {
    agency_id: params.agencyId,
    created_by: params.createdByUserId,
    customer_type: params.payload.customer_type,
    full_name: params.payload.full_name,
    company_name: params.payload.company_name,
    email: params.payload.email,
    phone: params.payload.phone,
    address: params.payload.address,
    city: params.payload.city,
    country_code: params.payload.country_code,
    notes: params.payload.notes,
  };

  try {
    const { data, error } = await supabase
      .from('customers')
      .insert(insertPayload)
      .select(CUSTOMER_SELECT_COLUMNS)
      .single();

    if (error) {
      const mapped = mapCustomerDbError(error);
      return {
        customer: null,
        error: mapped.message,
        status: mapped.status,
        fieldErrors: mapped.fieldErrors,
      };
    }

    if (!data) {
      return {
        customer: null,
        error: 'Une erreur est survenue lors de l’enregistrement du client.',
        status: 500,
      };
    }

    return {
      customer: data as unknown as CustomerRecord,
      error: null,
      status: 201,
    };
  } catch {
    return {
      customer: null,
      error: 'Erreur réseau lors de l’enregistrement du client.',
      status: 500,
    };
  }
}

/**
 * Updates only explicitly allowlisted, supplied customer fields for a customer
 * belonging to the server-verified active agency. Immutable attribution columns
 * (id, agency_id, created_by, created_at) are never written.
 */
export async function updateAgencyCustomerByIdWithClient(
  supabase: Pick<SupabaseClient, 'from'>,
  params: {
    agencyId: string;
    customerId: string;
    patch: ValidatedCustomerPatchPayload;
  }
): Promise<UpdateAgencyCustomerResult> {
  if (!isValidUuid(params.customerId)) {
    return {
      customer: null,
      error: 'Identifiant de client invalide.',
      status: 400,
    };
  }

  const updatePayload: Record<string, unknown> = {};
  for (const field of EDITABLE_CUSTOMER_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(params.patch, field) &&
      params.patch[field] !== undefined
    ) {
      updatePayload[field] = params.patch[field];
    }
  }

  if (Object.keys(updatePayload).length === 0) {
    return {
      customer: null,
      error: 'Aucun champ modifiable fourni.',
      status: 400,
    };
  }

  try {
    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', params.customerId)
      .eq('agency_id', params.agencyId)
      .select(CUSTOMER_SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      const mapped = mapCustomerDbError(error);
      return {
        customer: null,
        error: mapped.message,
        status: mapped.status,
        fieldErrors: mapped.fieldErrors,
      };
    }

    if (!data) {
      return {
        customer: null,
        error: 'Client introuvable dans votre agence.',
        status: 404,
      };
    }

    return {
      customer: data as unknown as CustomerRecord,
      error: null,
      status: 200,
    };
  } catch {
    return {
      customer: null,
      error: 'Erreur réseau lors de la mise à jour du client.',
      status: 500,
    };
  }
}
