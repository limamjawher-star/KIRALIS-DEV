import { isValidUuid } from '@/lib/agency/types';
import type { SupportedLocale } from '@/lib/currency';
import {
  canManageCustomerDrivers,
  type CustomerDriverRecord,
  type CustomerDriversEligibilitySummary,
  type DriverEligibilityAssessment,
  type DriverVerificationStatus,
} from '@/lib/drivers/types';
import {
  ALLOWED_CREATE_DRIVER_FIELDS,
  validateCreateCustomerDriverPayload,
  validatePatchCustomerDriverPayload,
  type CreateCustomerDriverFieldErrors,
  type CreateCustomerDriverFieldName,
  type ValidatedCreateCustomerDriverPayload,
  type ValidatedPatchCustomerDriverPayload,
} from '@/lib/drivers/validation';
import type { AgencyRole } from '@/lib/supabase/database.types';

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

export type CustomerDriverClientItem = Omit<
  CustomerDriverRecord,
  'verification_notes'
> & {
  /**
   * Present ONLY for active Owners and Managers.
   * Stripped at the API layer AND defensively stripped on the client for Agents.
   */
  verification_notes?: string | null;
  eligibility: DriverEligibilityAssessment;
};

export interface FetchCustomerDriversSuccess {
  ok: true;
  customerId: string;
  drivers: CustomerDriverClientItem[];
  summary: CustomerDriversEligibilitySummary | null;
}

export interface FetchCustomerDriversError {
  ok: false;
  status: number;
  error: string;
  aborted?: boolean;
}

export type FetchCustomerDriversResult =
  | FetchCustomerDriversSuccess
  | FetchCustomerDriversError;

export type CustomerDriversViewStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CustomerDriversViewState {
  status: CustomerDriversViewStatus;
  customerId: string | null;
  drivers: CustomerDriverClientItem[];
  summary: CustomerDriversEligibilitySummary | null;
  error: string | null;
  errorStatus: number | null;
}

export const INITIAL_CUSTOMER_DRIVERS_STATE: CustomerDriversViewState = {
  status: 'idle',
  customerId: null,
  drivers: [],
  summary: null,
  error: null,
  errorStatus: null,
};

interface DriversListApiPayload {
  ok?: boolean;
  customer_id?: string;
  drivers?: CustomerDriverClientItem[];
  summary?: CustomerDriversEligibilitySummary | null;
  error?: string;
}

const INTL_LOCALE_BY_SUPPORTED: Record<SupportedLocale, string> = {
  fr: 'fr-TN',
  en: 'en-GB',
  ar: 'ar-TN',
};

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'DOMException')
  );
}

function defaultDriversErrorForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Identifiant client invalide.';
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé aux conducteurs autorisés de cette agence.';
    case 404:
      return 'Client introuvable dans votre agence.';
    default:
      return 'Impossible de charger les conducteurs autorisés depuis Supabase.';
  }
}

/**
 * Defense-in-depth privacy guard on the client:
 * strips internal `verification_notes` whenever the active role is not Owner or Manager.
 */
export function sanitizeDriverForRole(
  driver: CustomerDriverClientItem,
  role: AgencyRole
): CustomerDriverClientItem {
  if (canManageCustomerDrivers(role)) {
    return driver;
  }

  const sanitized: CustomerDriverClientItem = {
    id: driver.id,
    agency_id: driver.agency_id,
    customer_id: driver.customer_id,
    full_name: driver.full_name,
    licence_issuing_country: driver.licence_issuing_country,
    licence_category: driver.licence_category,
    licence_expires_on: driver.licence_expires_on,
    verification_status: driver.verification_status,
    is_active: driver.is_active,
    created_by: driver.created_by,
    created_at: driver.created_at,
    updated_at: driver.updated_at,
    eligibility: driver.eligibility,
  };

  return sanitized;
}

export function sanitizeDriversForRole(
  drivers: readonly CustomerDriverClientItem[],
  role: AgencyRole
): CustomerDriverClientItem[] {
  return drivers.map((driver) => sanitizeDriverForRole(driver, role));
}

/**
 * Formats an ISO date-only string (`YYYY-MM-DD`) in UTC so calendar dates never
 * drift by +/- 1 day across browser timezones.
 */
export function formatDriverExpiryDate(
  isoDate: string | null,
  locale: SupportedLocale
): string | null {
  if (!isoDate) {
    return null;
  }

  const trimmed = isoDate.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    return trimmed;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(utcDate.getTime()) ||
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    return trimmed;
  }

  try {
    return new Intl.DateTimeFormat(INTL_LOCALE_BY_SUPPORTED[locale], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(utcDate);
  } catch {
    return trimmed;
  }
}

export async function fetchCustomerDrivers(
  customerId: string,
  options?: {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
    role?: AgencyRole;
  }
): Promise<FetchCustomerDriversResult> {
  const trimmedId = customerId.trim();
  if (!isValidUuid(trimmedId)) {
    return {
      ok: false,
      status: 400,
      error: defaultDriversErrorForStatus(400),
    };
  }

  const fetchFn: FetchLike = options?.fetchFn ?? fetch;
  const role: AgencyRole = options?.role ?? 'agent';

  let response: Response;
  try {
    response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedId)}/drivers`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: options?.signal,
      }
    );
  } catch (error) {
    if (options?.signal?.aborted || isAbortError(error)) {
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
      error: 'Erreur réseau lors du chargement des conducteurs autorisés.',
    };
  }

  let payload: DriversListApiPayload | null = null;
  try {
    payload = (await response.json()) as DriversListApiPayload;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const serverError =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : defaultDriversErrorForStatus(response.status);

    return {
      ok: false,
      status: response.status,
      error: serverError,
    };
  }

  if (
    !payload ||
    payload.ok !== true ||
    !Array.isArray(payload.drivers) ||
    (typeof payload.customer_id === 'string' && payload.customer_id !== trimmedId)
  ) {
    return {
      ok: false,
      status: 500,
      error: 'Réponse invalide lors du chargement des conducteurs autorisés.',
    };
  }

  return {
    ok: true,
    customerId: trimmedId,
    drivers: sanitizeDriversForRole(payload.drivers, role),
    summary: payload.summary ?? null,
  };
}

/**
 * Stale-safe state controller for the Authorized Drivers section inside the
 * Customer Details drawer. Aborts in-flight requests and discards late responses
 * when switching customers or closing the drawer.
 */
export function createCustomerDriversController(
  fetchFn: FetchLike,
  onStateChange: (state: CustomerDriversViewState) => void
) {
  let state: CustomerDriversViewState = INITIAL_CUSTOMER_DRIVERS_STATE;
  let activeCustomerId: string | null = null;
  let activeRole: AgencyRole = 'agent';
  let requestSequence = 0;
  let activeAbortController: AbortController | null = null;

  const setState = (next: CustomerDriversViewState) => {
    state = next;
    onStateChange(next);
  };

  const abortActive = () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  };

  const loadForCustomer = async (
    customerId: string,
    role: AgencyRole = 'agent'
  ): Promise<void> => {
    const trimmedId = customerId.trim();
    abortActive();
    requestSequence += 1;
    const sequence = requestSequence;
    activeCustomerId = trimmedId;
    activeRole = role;

    const abortController = new AbortController();
    activeAbortController = abortController;

    setState({
      status: 'loading',
      customerId: trimmedId,
      drivers: [],
      summary: null,
      error: null,
      errorStatus: null,
    });

    const result = await fetchCustomerDrivers(trimmedId, {
      fetchFn,
      signal: abortController.signal,
      role,
    });

    if (
      sequence !== requestSequence ||
      activeCustomerId !== trimmedId ||
      abortController.signal.aborted
    ) {
      return;
    }

    activeAbortController = null;

    if (!result.ok) {
      if (result.aborted) {
        return;
      }

      setState({
        status: 'error',
        customerId: trimmedId,
        drivers: [],
        summary: null,
        error: result.error,
        errorStatus: result.status,
      });
      return;
    }

    setState({
      status: 'ready',
      customerId: result.customerId,
      drivers: result.drivers,
      summary: result.summary,
      error: null,
      errorStatus: null,
    });
  };

  const retry = async (): Promise<void> => {
    if (!activeCustomerId) {
      return;
    }
    await loadForCustomer(activeCustomerId, activeRole);
  };

  const close = () => {
    requestSequence += 1;
    activeCustomerId = null;
    abortActive();
    setState(INITIAL_CUSTOMER_DRIVERS_STATE);
  };

  return {
    getState: () => state,
    loadForCustomer,
    retry,
    close,
  };
}

export interface CreateCustomerDriverFormValues {
  full_name: string;
  licence_issuing_country: string;
  licence_category: string;
  licence_expires_on: string;
}

export function createEmptyDriverFormValues(): CreateCustomerDriverFormValues {
  return {
    full_name: '',
    licence_issuing_country: '',
    licence_category: '',
    licence_expires_on: '',
  };
}

export interface SubmitCreateDriverSuccess {
  ok: true;
  status: 201;
  driver: CustomerDriverClientItem;
}

export interface SubmitCreateDriverError {
  ok: false;
  status: number;
  error: string;
  fieldErrors: CreateCustomerDriverFieldErrors;
  aborted?: boolean;
}

export type SubmitCreateDriverResult =
  | SubmitCreateDriverSuccess
  | SubmitCreateDriverError;

interface CreateDriverApiPayload {
  ok?: boolean;
  driver?: CustomerDriverClientItem;
  error?: string;
  fieldErrors?: Record<string, unknown>;
}

const ALLOWED_CREATE_FIELD_SET: ReadonlySet<string> = new Set(
  ALLOWED_CREATE_DRIVER_FIELDS
);

function extractSafeCreateFieldErrors(
  raw: Record<string, unknown> | undefined
): CreateCustomerDriverFieldErrors {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: CreateCustomerDriverFieldErrors = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      ALLOWED_CREATE_FIELD_SET.has(key) &&
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      next[key as CreateCustomerDriverFieldName] = value.trim();
    }
  }
  return next;
}

function defaultCreateDriverErrorForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Veuillez vérifier les informations saisies pour ce conducteur.';
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé : seuls le propriétaire et le gérant peuvent ajouter un conducteur autorisé.';
    case 404:
      return 'Client introuvable dans votre agence.';
    default:
      return 'Impossible d’enregistrer le conducteur autorisé dans Supabase.';
  }
}

/**
 * Prevents duplicate concurrent POST submissions caused by rapid double-clicks
 * or repeated Enter key presses.
 */
export function createDriverSingleFlightGuard() {
  let locked = false;

  return {
    isLocked: () => locked,
    tryAcquire: (): boolean => {
      if (locked) {
        return false;
      }
      locked = true;
      return true;
    },
    release: () => {
      locked = false;
    },
  };
}

/**
 * Builds the exact 4-field request body accepted by POST /api/customers/[id]/drivers.
 * Never includes agency_id, created_by, verification_status, verification_notes,
 * or is_active.
 */
export function buildCreateDriverRequestBody(
  values: CreateCustomerDriverFormValues
): ValidatedCreateCustomerDriverPayload | null {
  const strictRaw = {
    full_name: values.full_name,
    licence_issuing_country: values.licence_issuing_country,
    licence_category: values.licence_category,
    licence_expires_on: values.licence_expires_on,
  };

  const validation = validateCreateCustomerDriverPayload(strictRaw);
  return validation.valid ? validation.data : null;
}

export async function submitCreateCustomerDriver(
  customerId: string,
  values: CreateCustomerDriverFormValues,
  options?: {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
  }
): Promise<SubmitCreateDriverResult> {
  const trimmedId = customerId.trim();
  if (!isValidUuid(trimmedId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant client invalide.',
      fieldErrors: {},
    };
  }

  // Strictly pick ONLY the 4 supported fields before validation & submission
  const strictRaw = {
    full_name: values.full_name,
    licence_issuing_country: values.licence_issuing_country,
    licence_category: values.licence_category,
    licence_expires_on: values.licence_expires_on,
  };

  const validation = validateCreateCustomerDriverPayload(strictRaw);
  if (!validation.valid || !validation.data) {
    return {
      ok: false,
      status: 400,
      error:
        validation.error ??
        'Veuillez corriger les champs signalés dans le formulaire.',
      fieldErrors: validation.errors,
    };
  }

  const payloadToSend: ValidatedCreateCustomerDriverPayload = {
    full_name: validation.data.full_name,
    licence_issuing_country: validation.data.licence_issuing_country,
    licence_category: validation.data.licence_category,
    licence_expires_on: validation.data.licence_expires_on,
  };

  const fetchFn: FetchLike = options?.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedId)}/drivers`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: options?.signal,
        body: JSON.stringify(payloadToSend),
      }
    );
  } catch (error) {
    if (options?.signal?.aborted || isAbortError(error)) {
      return {
        ok: false,
        status: 0,
        error: '',
        fieldErrors: {},
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error: 'Erreur réseau lors de l’enregistrement du conducteur autorisé.',
      fieldErrors: {},
    };
  }

  let payload: CreateDriverApiPayload | null = null;
  try {
    payload = (await response.json()) as CreateDriverApiPayload;
  } catch {
    payload = null;
  }

  if (response.status !== 201) {
    const serverError =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : defaultCreateDriverErrorForStatus(response.status);

    return {
      ok: false,
      status: response.status,
      error: serverError,
      fieldErrors: extractSafeCreateFieldErrors(payload?.fieldErrors),
    };
  }

  if (
    !payload ||
    payload.ok !== true ||
    !payload.driver ||
    payload.driver.customer_id !== trimmedId
  ) {
    return {
      ok: false,
      status: 500,
      error: 'Réponse invalide lors de l’enregistrement du conducteur autorisé.',
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    status: 201,
    driver: payload.driver,
  };
}

export type EditDriverDetailsFormValues = CreateCustomerDriverFormValues;

export type EditDriverDetailsFieldErrors = CreateCustomerDriverFieldErrors;

export interface DriverDetailsPatchBuildResult {
  valid: boolean;
  hasChanges: boolean;
  licenceMetadataChanged: boolean;
  patch: Pick<
    ValidatedPatchCustomerDriverPayload,
    | 'full_name'
    | 'licence_issuing_country'
    | 'licence_category'
    | 'licence_expires_on'
  >;
  error?: string;
  fieldErrors: EditDriverDetailsFieldErrors;
}

export interface SubmitUpdateDriverDetailsSuccess {
  ok: true;
  status: 200;
  driver: CustomerDriverClientItem;
  licenceMetadataChanged: boolean;
}

export interface SubmitUpdateDriverDetailsError {
  ok: false;
  status: number;
  error: string;
  fieldErrors: EditDriverDetailsFieldErrors;
  noChanges?: boolean;
  aborted?: boolean;
}

export type SubmitUpdateDriverDetailsResult =
  | SubmitUpdateDriverDetailsSuccess
  | SubmitUpdateDriverDetailsError;

interface UpdateDriverApiPayload {
  ok?: boolean;
  driver?: CustomerDriverClientItem;
  error?: string;
  fieldErrors?: Record<string, unknown>;
}

/**
 * Prefills the Edit Driver Details form strictly from the selected driver's
 * 4 editable detail fields (name + driving licence metadata).
 */
export function driverRecordToDetailsFormValues(
  driver: Pick<
    CustomerDriverClientItem,
    | 'full_name'
    | 'licence_issuing_country'
    | 'licence_category'
    | 'licence_expires_on'
  >
): EditDriverDetailsFormValues {
  return {
    full_name: driver.full_name,
    licence_issuing_country: driver.licence_issuing_country ?? '',
    licence_category: driver.licence_category ?? '',
    licence_expires_on: driver.licence_expires_on ?? '',
  };
}

function normalizeOptionalCompareValue(
  value: string | null | undefined,
  mode: 'country' | 'category' | 'date'
): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (mode === 'country') {
    return trimmed.toUpperCase();
  }
  if (mode === 'category') {
    return trimmed.toUpperCase().replace(/\s+/g, '');
  }
  return trimmed;
}

/**
 * Detects whether any driving licence metadata field differs from the persisted
 * driver record (used to warn when modifying a currently verified driver).
 */
export function hasDriverLicenceMetadataChanged(
  original: Pick<
    CustomerDriverClientItem,
    'licence_issuing_country' | 'licence_category' | 'licence_expires_on'
  >,
  values: EditDriverDetailsFormValues
): boolean {
  const origCountry = normalizeOptionalCompareValue(
    original.licence_issuing_country,
    'country'
  );
  const nextCountry = normalizeOptionalCompareValue(
    values.licence_issuing_country,
    'country'
  );

  const origCategory = normalizeOptionalCompareValue(
    original.licence_category,
    'category'
  );
  const nextCategory = normalizeOptionalCompareValue(
    values.licence_category,
    'category'
  );

  const origExpiry = normalizeOptionalCompareValue(
    original.licence_expires_on,
    'date'
  );
  const nextExpiry = normalizeOptionalCompareValue(
    values.licence_expires_on,
    'date'
  );

  return (
    origCountry !== nextCountry ||
    origCategory !== nextCategory ||
    origExpiry !== nextExpiry
  );
}

/**
 * Detects whether any material identity or driving-licence metadata field
 * (full_name, licence_issuing_country, licence_category, licence_expires_on)
 * differs from the persisted driver record. Matches migration 0008's
 * verification invalidation trigger scope.
 */
export function hasDriverVerificationSensitiveDetailsChanged(
  original: Pick<
    CustomerDriverClientItem,
    | 'full_name'
    | 'licence_issuing_country'
    | 'licence_category'
    | 'licence_expires_on'
  >,
  values: EditDriverDetailsFormValues
): boolean {
  const normalizedOriginalName = original.full_name.trim().replace(/\s+/g, ' ');
  const normalizedNextName = values.full_name.trim().replace(/\s+/g, ' ');

  return (
    normalizedOriginalName !== normalizedNextName ||
    hasDriverLicenceMetadataChanged(original, values)
  );
}

/**
 * Validates the 4 editable driver detail fields and builds a minimal partial
 * PATCH payload containing ONLY modified fields (with `null` when clearing an
 * optional licence field). Never includes immutable, verification, or active
 * status columns.
 */
export function buildDriverDetailsPatchPayload(
  original: Pick<
    CustomerDriverClientItem,
    | 'full_name'
    | 'licence_issuing_country'
    | 'licence_category'
    | 'licence_expires_on'
  >,
  values: EditDriverDetailsFormValues
): DriverDetailsPatchBuildResult {
  const candidateBody = {
    full_name: values.full_name,
    licence_issuing_country: values.licence_issuing_country,
    licence_category: values.licence_category,
    licence_expires_on: values.licence_expires_on,
  };

  const validation = validatePatchCustomerDriverPayload(candidateBody);
  if (!validation.valid || !validation.data) {
    const safeFieldErrors: EditDriverDetailsFieldErrors = {};
    for (const field of ALLOWED_CREATE_DRIVER_FIELDS) {
      const msg = validation.errors[field];
      if (typeof msg === 'string' && msg.trim().length > 0) {
        safeFieldErrors[field] = msg;
      }
    }

    return {
      valid: false,
      hasChanges: false,
      licenceMetadataChanged: hasDriverLicenceMetadataChanged(original, values),
      patch: {},
      error:
        validation.error ??
        'Veuillez corriger les champs signalés dans le formulaire.',
      fieldErrors: safeFieldErrors,
    };
  }

  const patch: DriverDetailsPatchBuildResult['patch'] = {};
  const normalizedOriginalName = original.full_name.trim().replace(/\s+/g, ' ');

  if (
    validation.data.full_name !== undefined &&
    validation.data.full_name !== normalizedOriginalName
  ) {
    patch.full_name = validation.data.full_name;
  }

  const origCountry = normalizeOptionalCompareValue(
    original.licence_issuing_country,
    'country'
  );
  if (
    Object.prototype.hasOwnProperty.call(
      validation.data,
      'licence_issuing_country'
    ) &&
    validation.data.licence_issuing_country !== origCountry
  ) {
    patch.licence_issuing_country =
      validation.data.licence_issuing_country ?? null;
  }

  const origCategory = normalizeOptionalCompareValue(
    original.licence_category,
    'category'
  );
  if (
    Object.prototype.hasOwnProperty.call(validation.data, 'licence_category') &&
    validation.data.licence_category !== origCategory
  ) {
    patch.licence_category = validation.data.licence_category ?? null;
  }

  const origExpiry = normalizeOptionalCompareValue(
    original.licence_expires_on,
    'date'
  );
  if (
    Object.prototype.hasOwnProperty.call(
      validation.data,
      'licence_expires_on'
    ) &&
    validation.data.licence_expires_on !== origExpiry
  ) {
    patch.licence_expires_on = validation.data.licence_expires_on ?? null;
  }

  const licenceMetadataChanged =
    Object.prototype.hasOwnProperty.call(patch, 'licence_issuing_country') ||
    Object.prototype.hasOwnProperty.call(patch, 'licence_category') ||
    Object.prototype.hasOwnProperty.call(patch, 'licence_expires_on');

  return {
    valid: true,
    hasChanges: Object.keys(patch).length > 0,
    licenceMetadataChanged,
    patch,
    fieldErrors: {},
  };
}

function defaultUpdateDriverErrorForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Veuillez vérifier les informations saisies pour ce conducteur.';
    case 401:
      return 'Session expirée. Veuillez vous reconnecter.';
    case 403:
      return 'Accès refusé : seuls le propriétaire et le gérant peuvent modifier un conducteur autorisé.';
    case 404:
      return 'Conducteur autorisé introuvable pour ce client dans votre agence.';
    default:
      return 'Impossible d’enregistrer les modifications du conducteur autorisé.';
  }
}

export async function submitUpdateDriverDetails(
  customerId: string,
  driverId: string,
  originalDriver: CustomerDriverClientItem,
  values: EditDriverDetailsFormValues,
  options?: {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
  }
): Promise<SubmitUpdateDriverDetailsResult> {
  const trimmedCustomerId = customerId.trim();
  const trimmedDriverId = driverId.trim();

  if (!isValidUuid(trimmedCustomerId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant client invalide.',
      fieldErrors: {},
    };
  }

  if (!isValidUuid(trimmedDriverId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant de conducteur invalide.',
      fieldErrors: {},
    };
  }

  if (
    originalDriver.id !== trimmedDriverId ||
    originalDriver.customer_id !== trimmedCustomerId
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Le conducteur sélectionné ne correspond pas au client actif.',
      fieldErrors: {},
    };
  }

  const diff = buildDriverDetailsPatchPayload(originalDriver, values);
  if (!diff.valid) {
    return {
      ok: false,
      status: 400,
      error:
        diff.error ??
        'Veuillez corriger les champs signalés dans le formulaire.',
      fieldErrors: diff.fieldErrors,
    };
  }

  if (!diff.hasChanges) {
    return {
      ok: false,
      status: 400,
      noChanges: true,
      error: 'Aucune modification à enregistrer.',
      fieldErrors: {},
    };
  }

  const fetchFn: FetchLike = options?.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedCustomerId)}/drivers/${encodeURIComponent(trimmedDriverId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: options?.signal,
        body: JSON.stringify(diff.patch),
      }
    );
  } catch (error) {
    if (options?.signal?.aborted || isAbortError(error)) {
      return {
        ok: false,
        status: 0,
        error: '',
        fieldErrors: {},
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error: 'Erreur réseau lors de la mise à jour du conducteur autorisé.',
      fieldErrors: {},
    };
  }

  let payload: UpdateDriverApiPayload | null = null;
  try {
    payload = (await response.json()) as UpdateDriverApiPayload;
  } catch {
    payload = null;
  }

  if (response.status !== 200) {
    const serverError =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : defaultUpdateDriverErrorForStatus(response.status);

    return {
      ok: false,
      status: response.status,
      error: serverError,
      fieldErrors: extractSafeCreateFieldErrors(payload?.fieldErrors),
    };
  }

  if (
    !payload ||
    payload.ok !== true ||
    !payload.driver ||
    payload.driver.id !== trimmedDriverId ||
    payload.driver.customer_id !== trimmedCustomerId
  ) {
    return {
      ok: false,
      status: 500,
      error: 'Réponse invalide lors de la mise à jour du conducteur autorisé.',
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    status: 200,
    driver: payload.driver,
    licenceMetadataChanged: diff.licenceMetadataChanged,
  };
}

export interface DriverVerificationFormValues {
  verification_status: DriverVerificationStatus;
  verification_notes: string;
}

export type DriverVerificationFieldName =
  | 'verification_status'
  | 'verification_notes';

export type DriverVerificationFieldErrors = Partial<
  Record<DriverVerificationFieldName, string>
>;

export interface DriverVerificationPatchBuildResult {
  valid: boolean;
  hasChanges: boolean;
  patch: Pick<
    ValidatedPatchCustomerDriverPayload,
    'verification_status' | 'verification_notes'
  >;
  error?: string;
  fieldErrors: DriverVerificationFieldErrors;
}

export interface SubmitUpdateDriverVerificationSuccess {
  ok: true;
  status: 200;
  driver: CustomerDriverClientItem;
}

export interface SubmitUpdateDriverVerificationError {
  ok: false;
  status: number;
  error: string;
  fieldErrors: DriverVerificationFieldErrors;
  noChanges?: boolean;
  aborted?: boolean;
}

export type SubmitUpdateDriverVerificationResult =
  | SubmitUpdateDriverVerificationSuccess
  | SubmitUpdateDriverVerificationError;

export interface SubmitToggleDriverActiveSuccess {
  ok: true;
  status: 200;
  driver: CustomerDriverClientItem;
}

export interface SubmitToggleDriverActiveError {
  ok: false;
  status: number;
  error: string;
  noChanges?: boolean;
  aborted?: boolean;
}

export type SubmitToggleDriverActiveResult =
  | SubmitToggleDriverActiveSuccess
  | SubmitToggleDriverActiveError;

const ALLOWED_VERIFICATION_FIELD_SET: ReadonlySet<string> = new Set([
  'verification_status',
  'verification_notes',
]);

function extractSafeVerificationFieldErrors(
  raw: Record<string, unknown> | undefined
): DriverVerificationFieldErrors {
  if (!raw || typeof raw !== 'object') {
    return {};
  }

  const next: DriverVerificationFieldErrors = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      ALLOWED_VERIFICATION_FIELD_SET.has(key) &&
      typeof value === 'string' &&
      value.trim().length > 0
    ) {
      next[key as DriverVerificationFieldName] = value.trim();
    }
  }
  return next;
}

/**
 * Prefills the Owner/Manager verification form from the selected driver record.
 */
export function driverRecordToVerificationFormValues(
  driver: Pick<
    CustomerDriverClientItem,
    'verification_status' | 'verification_notes'
  >
): DriverVerificationFormValues {
  return {
    verification_status: driver.verification_status,
    verification_notes:
      typeof driver.verification_notes === 'string'
        ? driver.verification_notes
        : '',
  };
}

/**
 * Validates verification_status and verification_notes and returns a minimal
 * PATCH payload containing ONLY modified fields (clearing notes emits explicit null).
 * Never includes immutable fields, licence metadata, or is_active.
 */
export function buildDriverVerificationPatchPayload(
  original: Pick<
    CustomerDriverClientItem,
    'verification_status' | 'verification_notes'
  >,
  values: DriverVerificationFormValues
): DriverVerificationPatchBuildResult {
  const candidateBody = {
    verification_status: values.verification_status,
    verification_notes: values.verification_notes,
  };

  const validation = validatePatchCustomerDriverPayload(candidateBody);
  if (!validation.valid || !validation.data) {
    const fieldErrors: DriverVerificationFieldErrors = {};
    if (validation.errors.verification_status) {
      fieldErrors.verification_status = validation.errors.verification_status;
    }
    if (validation.errors.verification_notes) {
      fieldErrors.verification_notes = validation.errors.verification_notes;
    }

    return {
      valid: false,
      hasChanges: false,
      patch: {},
      error:
        validation.error ??
        'Veuillez corriger les champs de vérification signalés.',
      fieldErrors,
    };
  }

  const patch: DriverVerificationPatchBuildResult['patch'] = {};

  if (
    validation.data.verification_status !== undefined &&
    validation.data.verification_status !== original.verification_status
  ) {
    patch.verification_status = validation.data.verification_status;
  }

  const originalNotes =
    typeof original.verification_notes === 'string' &&
    original.verification_notes.trim().length > 0
      ? original.verification_notes.trim()
      : null;

  if (
    Object.prototype.hasOwnProperty.call(
      validation.data,
      'verification_notes'
    ) &&
    validation.data.verification_notes !== originalNotes
  ) {
    patch.verification_notes = validation.data.verification_notes ?? null;
  }

  return {
    valid: true,
    hasChanges: Object.keys(patch).length > 0,
    patch,
    fieldErrors: {},
  };
}

export async function submitUpdateDriverVerification(
  customerId: string,
  driverId: string,
  originalDriver: CustomerDriverClientItem,
  values: DriverVerificationFormValues,
  options?: {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
  }
): Promise<SubmitUpdateDriverVerificationResult> {
  const trimmedCustomerId = customerId.trim();
  const trimmedDriverId = driverId.trim();

  if (!isValidUuid(trimmedCustomerId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant client invalide.',
      fieldErrors: {},
    };
  }

  if (!isValidUuid(trimmedDriverId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant de conducteur invalide.',
      fieldErrors: {},
    };
  }

  if (
    originalDriver.id !== trimmedDriverId ||
    originalDriver.customer_id !== trimmedCustomerId
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Le conducteur sélectionné ne correspond pas au client actif.',
      fieldErrors: {},
    };
  }

  const diff = buildDriverVerificationPatchPayload(originalDriver, values);
  if (!diff.valid) {
    return {
      ok: false,
      status: 400,
      error:
        diff.error ?? 'Veuillez corriger les champs de vérification signalés.',
      fieldErrors: diff.fieldErrors,
    };
  }

  if (!diff.hasChanges) {
    return {
      ok: false,
      status: 400,
      noChanges: true,
      error: 'Aucune modification à enregistrer.',
      fieldErrors: {},
    };
  }

  const fetchFn: FetchLike = options?.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedCustomerId)}/drivers/${encodeURIComponent(trimmedDriverId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: options?.signal,
        body: JSON.stringify(diff.patch),
      }
    );
  } catch (error) {
    if (options?.signal?.aborted || isAbortError(error)) {
      return {
        ok: false,
        status: 0,
        error: '',
        fieldErrors: {},
        aborted: true,
      };
    }

    return {
      ok: false,
      status: 0,
      error:
        'Erreur réseau lors de la mise à jour de la vérification du conducteur.',
      fieldErrors: {},
    };
  }

  let payload: UpdateDriverApiPayload | null = null;
  try {
    payload = (await response.json()) as UpdateDriverApiPayload;
  } catch {
    payload = null;
  }

  if (response.status !== 200) {
    const serverError =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : defaultUpdateDriverErrorForStatus(response.status);

    return {
      ok: false,
      status: response.status,
      error: serverError,
      fieldErrors: extractSafeVerificationFieldErrors(payload?.fieldErrors),
    };
  }

  if (
    !payload ||
    payload.ok !== true ||
    !payload.driver ||
    payload.driver.id !== trimmedDriverId ||
    payload.driver.customer_id !== trimmedCustomerId
  ) {
    return {
      ok: false,
      status: 500,
      error:
        'Réponse invalide lors de la mise à jour de la vérification du conducteur.',
      fieldErrors: {},
    };
  }

  return {
    ok: true,
    status: 200,
    driver: payload.driver,
  };
}

/**
 * Toggles ONLY `is_active` (false = deactivate, true = reactivate) via PATCH.
 * Preserves verification_status, verification_notes, licence metadata, and
 * audit history. Never calls DELETE.
 */
export async function submitToggleDriverActive(
  customerId: string,
  driverId: string,
  originalDriver: CustomerDriverClientItem,
  nextIsActive: boolean,
  options?: {
    fetchFn?: FetchLike;
    signal?: AbortSignal;
  }
): Promise<SubmitToggleDriverActiveResult> {
  const trimmedCustomerId = customerId.trim();
  const trimmedDriverId = driverId.trim();

  if (!isValidUuid(trimmedCustomerId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant client invalide.',
    };
  }

  if (!isValidUuid(trimmedDriverId)) {
    return {
      ok: false,
      status: 400,
      error: 'Identifiant de conducteur invalide.',
    };
  }

  if (
    originalDriver.id !== trimmedDriverId ||
    originalDriver.customer_id !== trimmedCustomerId
  ) {
    return {
      ok: false,
      status: 400,
      error: 'Le conducteur sélectionné ne correspond pas au client actif.',
    };
  }

  if (originalDriver.is_active === nextIsActive) {
    return {
      ok: false,
      status: 400,
      noChanges: true,
      error: 'Aucune modification à enregistrer.',
    };
  }

  const validation = validatePatchCustomerDriverPayload({
    is_active: nextIsActive,
  });
  if (!validation.valid || !validation.data) {
    return {
      ok: false,
      status: 400,
      error:
        validation.error ??
        'Statut d’activation du conducteur invalide.',
    };
  }

  const fetchFn: FetchLike = options?.fetchFn ?? fetch;

  let response: Response;
  try {
    response = await fetchFn(
      `/api/customers/${encodeURIComponent(trimmedCustomerId)}/drivers/${encodeURIComponent(trimmedDriverId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
        signal: options?.signal,
        body: JSON.stringify({ is_active: nextIsActive }),
      }
    );
  } catch (error) {
    if (options?.signal?.aborted || isAbortError(error)) {
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
      error:
        'Erreur réseau lors de la mise à jour du statut du conducteur autorisé.',
    };
  }

  let payload: UpdateDriverApiPayload | null = null;
  try {
    payload = (await response.json()) as UpdateDriverApiPayload;
  } catch {
    payload = null;
  }

  if (response.status !== 200) {
    const serverError =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error.trim()
        : defaultUpdateDriverErrorForStatus(response.status);

    return {
      ok: false,
      status: response.status,
      error: serverError,
    };
  }

  if (
    !payload ||
    payload.ok !== true ||
    !payload.driver ||
    payload.driver.id !== trimmedDriverId ||
    payload.driver.customer_id !== trimmedCustomerId ||
    payload.driver.is_active !== nextIsActive
  ) {
    return {
      ok: false,
      status: 500,
      error:
        'Réponse invalide lors de la mise à jour du statut du conducteur autorisé.',
    };
  }

  return {
    ok: true,
    status: 200,
    driver: payload.driver,
  };
}



