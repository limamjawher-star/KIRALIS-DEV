import { isValidUuid } from '@/lib/agency/types';
import type {
  CustomerFieldErrors,
  CustomerFormValues,
  CustomerRecord,
} from './types';
import {
  normalizeCustomerEmail,
  normalizeCustomerPhone,
  validateCustomerPatchPayload,
  validateCustomerPayload,
} from './validation';

export type FetchLike = (
  input: string,
  init?: RequestInit
) => Promise<Response>;

export type CreateCustomerSubmitResult =
  | {
      ok: true;
      status: number;
      customer: CustomerRecord;
    }
  | {
      ok: false;
      status: number;
      error: string;
      fieldErrors?: CustomerFieldErrors;
    };

export type RefreshCustomersResult =
  | {
      ok: true;
      customers: CustomerRecord[];
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type FetchCustomerDetailsResult =
  | {
      ok: true;
      status: number;
      customer: CustomerRecord;
    }
  | {
      ok: false;
      status: number;
      error: string;
      aborted?: boolean;
    };

export type UpdateCustomerSubmitResult =
  | {
      ok: true;
      status: number;
      customer: CustomerRecord;
    }
  | {
      ok: false;
      status: number;
      error: string;
      fieldErrors?: CustomerFieldErrors;
      noChanges?: boolean;
      aborted?: boolean;
    };

export interface CustomerDetailViewState {
  selectedCustomerId: string | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  customer: CustomerRecord | null;
  error: string | null;
  errorStatus: number | null;
}

export const INITIAL_CUSTOMER_DETAIL_STATE: CustomerDetailViewState = {
  selectedCustomerId: null,
  status: 'idle',
  customer: null,
  error: null,
  errorStatus: null,
};

/**
 * Maps API HTTP failure codes to clear, safe French messages when the server
 * does not supply a specific error string.
 */
function fallbackCreateErrorForStatus(status: number): string {
  if (status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter pour ajouter un client.';
  }
  if (status === 403) {
    return 'Accès refusé : vous ne disposez pas des droits nécessaires pour ajouter un client dans cette agence.';
  }
  if (status === 409) {
    return 'Un client avec cette adresse e-mail existe déjà dans votre agence.';
  }
  if (status === 400) {
    return 'Veuillez corriger les champs signalés dans le formulaire.';
  }
  return 'Impossible d’enregistrer le client. Veuillez réessayer.';
}

/**
 * Validates, normalizes, and submits only supported customer fields to
 * POST /api/customers. Never sends client-controlled agency_id or created_by.
 */
export async function submitCreateCustomer(
  values: CustomerFormValues,
  fetchFn: FetchLike = fetch
): Promise<CreateCustomerSubmitResult> {
  const candidatePayload: Record<string, unknown> = {
    customer_type: values.customer_type,
    full_name: values.full_name,
    company_name:
      values.customer_type === 'corporate' ? values.company_name : '',
    email: values.email,
    phone: values.phone,
    address: values.address,
    city: values.city,
    country_code: values.country_code,
    notes: values.notes,
  };

  const validation = validateCustomerPayload(candidatePayload);
  if (!validation.valid || !validation.data) {
    return {
      ok: false,
      status: 400,
      error: 'Veuillez corriger les champs indiqués ci-dessous.',
      fieldErrors: validation.errors,
    };
  }

  try {
    const response = await fetchFn('/api/customers', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validation.data),
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      customer?: CustomerRecord;
      error?: string;
      fieldErrors?: CustomerFieldErrors;
    } | null;

    if (!response.ok || !payload?.ok || !payload.customer) {
      const status = response.status || 500;
      const fieldErrors: CustomerFieldErrors | undefined =
        payload?.fieldErrors ??
        (status === 409
          ? { email: 'Cette adresse e-mail est déjà utilisée dans votre agence.' }
          : undefined);

      return {
        ok: false,
        status,
        error: payload?.error ?? fallbackCreateErrorForStatus(status),
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }

    return {
      ok: true,
      status: response.status,
      customer: payload.customer,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: 'Erreur réseau lors de la communication avec le serveur.',
    };
  }
}

/**
 * Fetches the active agency's real customer directory from GET /api/customers.
 */
export async function fetchAgencyCustomersDirectory(
  fetchFn: FetchLike = fetch,
  fallbackError = 'Impossible d’actualiser le répertoire clients depuis Supabase.',
  networkError = 'Erreur réseau lors du chargement des clients.'
): Promise<RefreshCustomersResult> {
  try {
    const response = await fetchFn('/api/customers', {
      method: 'GET',
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      customers?: CustomerRecord[];
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok || !Array.isArray(payload.customers)) {
      return {
        ok: false,
        status: response.status || 500,
        error: payload?.error ?? fallbackError,
      };
    }

    return {
      ok: true,
      customers: payload.customers,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      error: networkError,
    };
  }
}

/**
 * Synchronous in-flight submission guard preventing duplicate concurrent POSTs
 * caused by rapid double-clicks or repeated Enter key presses.
 */
export function createSingleFlightGuard() {
  let active = false;

  return {
    isRunning(): boolean {
      return active;
    },
    async run<T>(task: () => Promise<T>): Promise<T | null> {
      if (active) {
        return null;
      }
      active = true;
      try {
        return await task();
      } finally {
        active = false;
      }
    },
  };
}

function fallbackDetailErrorForStatus(status: number): string {
  if (status === 400) {
    return 'Identifiant de client invalide.';
  }
  if (status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter pour consulter cette fiche client.';
  }
  if (status === 403) {
    return 'Accès refusé : vous ne disposez pas des droits nécessaires pour consulter ce client.';
  }
  if (status === 404) {
    return 'Client introuvable ou inaccessible dans votre agence.';
  }
  return 'Une erreur serveur est survenue lors du chargement de la fiche client.';
}

/**
 * Fetches a single real customer record from GET /api/customers/[id] with
 * cache: 'no-store' and optional AbortSignal cancellation.
 */
export async function fetchAgencyCustomerDetails(
  customerId: string,
  fetchFn: FetchLike = fetch,
  signal?: AbortSignal
): Promise<FetchCustomerDetailsResult> {
  const trimmedId = customerId.trim();
  if (!isValidUuid(trimmedId)) {
    return {
      ok: false,
      status: 400,
      error: fallbackDetailErrorForStatus(400),
    };
  }

  try {
    const response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedId)}`,
      {
        method: 'GET',
        cache: 'no-store',
        ...(signal ? { signal } : {}),
      }
    );

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      customer?: CustomerRecord;
      error?: string;
    } | null;

    if (!response.ok || !payload?.ok || !payload.customer) {
      const status = response.status || 500;
      return {
        ok: false,
        status,
        error: payload?.error ?? fallbackDetailErrorForStatus(status),
      };
    }

    if (payload.customer.id !== trimmedId) {
      return {
        ok: false,
        status: 500,
        error: fallbackDetailErrorForStatus(500),
      };
    }

    return {
      ok: true,
      status: response.status,
      customer: payload.customer,
    };
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      return {
        ok: false,
        status: 0,
        error: '',
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error: 'Erreur réseau lors du chargement de la fiche client.',
    };
  }
}

/**
 * Stale-safe state controller for opening, switching, retrying, and closing
 * the Customer Details drawer. Immediately clears previous customer data on
 * switch, aborts superseded requests, and ignores out-of-order responses.
 */
export function createCustomerDetailController(
  fetchFn: FetchLike = fetch,
  onStateChange?: (state: CustomerDetailViewState) => void
) {
  let state: CustomerDetailViewState = { ...INITIAL_CUSTOMER_DETAIL_STATE };
  let activeRequestSeq = 0;
  let activeAbortController: AbortController | null = null;

  function emit(next: CustomerDetailViewState) {
    state = next;
    onStateChange?.(next);
  }

  function cancelInFlight() {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  }

  async function load(customerId: string): Promise<CustomerDetailViewState> {
    cancelInFlight();
    const requestSeq = ++activeRequestSeq;
    const abortController = new AbortController();
    activeAbortController = abortController;

    emit({
      selectedCustomerId: customerId,
      status: 'loading',
      customer: null,
      error: null,
      errorStatus: null,
    });

    const result = await fetchAgencyCustomerDetails(
      customerId,
      fetchFn,
      abortController.signal
    );

    if (requestSeq !== activeRequestSeq) {
      return state;
    }

    activeAbortController = null;

    if (result.ok) {
      emit({
        selectedCustomerId: customerId,
        status: 'ready',
        customer: result.customer,
        error: null,
        errorStatus: null,
      });
      return state;
    }

    if (result.aborted) {
      return state;
    }

    emit({
      selectedCustomerId: customerId,
      status: 'error',
      customer: null,
      error: result.error,
      errorStatus: result.status,
    });
    return state;
  }

  return {
    getState(): CustomerDetailViewState {
      return state;
    },
    selectCustomer(customerId: string): Promise<CustomerDetailViewState> {
      return load(customerId);
    },
    retry(): Promise<CustomerDetailViewState> | null {
      if (!state.selectedCustomerId) {
        return null;
      }
      return load(state.selectedCustomerId);
    },
    applyUpdatedCustomer(updated: CustomerRecord): CustomerDetailViewState {
      if (state.selectedCustomerId !== updated.id) {
        return state;
      }
      activeRequestSeq += 1;
      cancelInFlight();
      emit({
        selectedCustomerId: updated.id,
        status: 'ready',
        customer: updated,
        error: null,
        errorStatus: null,
      });
      return state;
    },
    close(): CustomerDetailViewState {
      activeRequestSeq += 1;
      cancelInFlight();
      emit({ ...INITIAL_CUSTOMER_DETAIL_STATE });
      return state;
    },
  };
}

function normalizeTextForDiff(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNullableTextForDiff(value: string): string | null {
  const normalized = normalizeTextForDiff(value);
  return normalized.length > 0 ? normalized : null;
}

/**
 * Computes a strict partial PATCH payload containing ONLY modified editable
 * columns of public.customers. Never includes immutable fields (id, agency_id,
 * created_by, created_at, updated_at) and omits unchanged fields.
 */
export function buildCustomerPatchDiff(
  original: CustomerRecord,
  values: CustomerFormValues
): Record<string, unknown> {
  const diff: Record<string, unknown> = {};

  if (values.customer_type !== original.customer_type) {
    diff.customer_type = values.customer_type;
  }

  const nextFullName = normalizeTextForDiff(values.full_name);
  if (nextFullName !== original.full_name) {
    diff.full_name = values.full_name;
  }

  const rawCompany =
    values.customer_type === 'corporate' ? values.company_name : '';
  const nextCompany = normalizeNullableTextForDiff(rawCompany);
  if (nextCompany !== (original.company_name ?? null)) {
    diff.company_name = nextCompany;
  }

  const nextPhone = normalizeCustomerPhone(values.phone);
  if (nextPhone !== original.phone) {
    diff.phone = values.phone;
  }

  const nextEmail = normalizeCustomerEmail(values.email);
  const originalEmail = normalizeCustomerEmail(original.email);
  if (nextEmail !== originalEmail) {
    diff.email = nextEmail;
  }

  const nextAddress = normalizeNullableTextForDiff(values.address);
  if (nextAddress !== (original.address ?? null)) {
    diff.address = nextAddress;
  }

  const nextCity = normalizeNullableTextForDiff(values.city);
  if (nextCity !== (original.city ?? null)) {
    diff.city = nextCity;
  }

  const nextCountry = values.country_code.trim().toUpperCase();
  if (nextCountry !== (original.country_code ?? '').trim().toUpperCase()) {
    diff.country_code = nextCountry;
  }

  const nextNotesTrimmed = values.notes.trim();
  const nextNotes = nextNotesTrimmed.length > 0 ? nextNotesTrimmed : null;
  if (nextNotes !== (original.notes ?? null)) {
    diff.notes = nextNotes;
  }

  return diff;
}

function fallbackUpdateErrorForStatus(status: number): string {
  if (status === 400) {
    return 'Veuillez corriger les champs signalés dans le formulaire.';
  }
  if (status === 401) {
    return 'Votre session a expiré. Veuillez vous reconnecter pour modifier ce client.';
  }
  if (status === 403) {
    return 'Accès refusé : vous ne disposez pas des droits nécessaires pour modifier ce client.';
  }
  if (status === 404) {
    return 'Client introuvable ou inaccessible dans votre agence.';
  }
  if (status === 409) {
    return 'Un autre client de votre agence utilise déjà cette adresse e-mail.';
  }
  return 'Impossible d’enregistrer les modifications du client. Veuillez réessayer.';
}

/**
 * Validates and submits only modified editable customer fields to
 * PATCH /api/customers/[id] with cache: 'no-store'. Never sends immutable
 * or client-controlled tenant fields.
 */
export async function submitUpdateCustomer(
  customerId: string,
  original: CustomerRecord,
  values: CustomerFormValues,
  fetchFn: FetchLike = fetch,
  signal?: AbortSignal
): Promise<UpdateCustomerSubmitResult> {
  const trimmedId = customerId.trim();
  if (!isValidUuid(trimmedId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant de client invalide.',
    };
  }

  const diff = buildCustomerPatchDiff(original, values);
  if (Object.keys(diff).length === 0) {
    return {
      ok: false,
      status: 400,
      noChanges: true,
      error: 'Aucune modification à enregistrer.',
    };
  }

  const validation = validateCustomerPatchPayload(diff);
  if (!validation.valid || !validation.data) {
    return {
      ok: false,
      status: 400,
      error:
        validation.error ?? 'Veuillez corriger les champs indiqués ci-dessous.',
      fieldErrors: validation.errors,
    };
  }

  try {
    const response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedId)}`,
      {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
        ...(signal ? { signal } : {}),
      }
    );

    const payload = (await response.json().catch(() => null)) as {
      ok?: boolean;
      customer?: CustomerRecord;
      error?: string;
      fieldErrors?: CustomerFieldErrors;
    } | null;

    if (!response.ok || !payload?.ok || !payload.customer) {
      const status = response.status || 500;
      const fieldErrors: CustomerFieldErrors | undefined =
        payload?.fieldErrors ??
        (status === 409
          ? { email: 'Cette adresse e-mail est déjà utilisée dans votre agence.' }
          : undefined);

      return {
        ok: false,
        status,
        error: payload?.error ?? fallbackUpdateErrorForStatus(status),
        ...(fieldErrors ? { fieldErrors } : {}),
      };
    }

    if (payload.customer.id !== trimmedId) {
      return {
        ok: false,
        status: 500,
        error: fallbackUpdateErrorForStatus(500),
      };
    }

    return {
      ok: true,
      status: response.status,
      customer: payload.customer,
    };
  } catch (err) {
    if (
      signal?.aborted ||
      (err instanceof Error && err.name === 'AbortError')
    ) {
      return {
        ok: false,
        status: 0,
        error: '',
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error: 'Erreur réseau lors de la mise à jour du client.',
    };
  }
}
