import {
  isValidDriverLicenceDate,
  normalizeIsoCountryCode,
  normalizeLicenceCategory,
} from './eligibility';
import {
  DRIVER_VERIFICATION_STATUSES,
  EDITABLE_CUSTOMER_DRIVER_FIELDS,
  type CustomerDriverFieldName,
  type DriverVerificationStatus,
} from './types';

export const ALLOWED_CREATE_DRIVER_FIELDS = [
  'full_name',
  'licence_issuing_country',
  'licence_category',
  'licence_expires_on',
] as const;

/**
 * Material identity and driving-licence metadata fields whose modification
 * invalidates prior manual verification (enforced atomically by migration 0008).
 */
export const DRIVER_VERIFICATION_SENSITIVE_FIELDS =
  ALLOWED_CREATE_DRIVER_FIELDS;

export type CreateCustomerDriverFieldName =
  (typeof ALLOWED_CREATE_DRIVER_FIELDS)[number];

export type CreateCustomerDriverFieldErrors = Partial<
  Record<CreateCustomerDriverFieldName, string>
>;

export type DriverFieldErrors = Partial<Record<CustomerDriverFieldName, string>>;

export interface ValidatedCreateCustomerDriverPayload {
  full_name: string;
  licence_issuing_country: string | null;
  licence_category: string | null;
  licence_expires_on: string | null;
}

export interface ValidatedPatchCustomerDriverPayload {
  full_name?: string;
  licence_issuing_country?: string | null;
  licence_category?: string | null;
  licence_expires_on?: string | null;
  verification_status?: DriverVerificationStatus;
  verification_notes?: string | null;
  is_active?: boolean;
}

export interface CreateCustomerDriverValidationResult {
  valid: boolean;
  data: ValidatedCreateCustomerDriverPayload | null;
  error?: string;
  errors: CreateCustomerDriverFieldErrors;
}

export interface PatchCustomerDriverValidationResult {
  valid: boolean;
  data: ValidatedPatchCustomerDriverPayload | null;
  error?: string;
  errors: DriverFieldErrors;
}

const ALLOWED_CREATE_DRIVER_FIELD_SET: ReadonlySet<string> = new Set(
  ALLOWED_CREATE_DRIVER_FIELDS
);

const ALLOWED_PATCH_DRIVER_FIELD_SET: ReadonlySet<string> = new Set(
  EDITABLE_CUSTOMER_DRIVER_FIELDS
);

const VALID_VERIFICATION_STATUS_SET: ReadonlySet<string> = new Set(
  DRIVER_VERIFICATION_STATUSES
);

function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function isOptionalEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '')
  );
}

/**
 * Strictly validates the POST /api/customers/[id]/drivers payload against
 * migration 0007 constraints. Rejects any unknown, immutable, verification,
 * or sensitive identity/document fields.
 */
export function validateCreateCustomerDriverPayload(
  rawBody: Record<string, unknown>
): CreateCustomerDriverValidationResult {
  const unexpectedKeys = Object.keys(rawBody).filter(
    (key) => !ALLOWED_CREATE_DRIVER_FIELD_SET.has(key)
  );

  if (unexpectedKeys.length > 0) {
    return {
      valid: false,
      data: null,
      error:
        'La requête contient des champs non autorisés, immuables ou réservés.',
      errors: {},
    };
  }

  const errors: CreateCustomerDriverFieldErrors = {};

  // 1. full_name (required, 2–140 chars after trimming)
  let fullName = '';
  if (typeof rawBody.full_name !== 'string') {
    errors.full_name = 'Le nom complet du conducteur est obligatoire.';
  } else {
    fullName = normalizeFullName(rawBody.full_name);
    if (fullName.length < 2) {
      errors.full_name =
        'Le nom complet doit contenir au moins 2 caractères.';
    } else if (fullName.length > 140) {
      errors.full_name =
        'Le nom complet ne peut pas dépasser 140 caractères.';
    }
  }

  // 2. licence_issuing_country (optional, ISO alpha-2 ^[A-Z]{2}$)
  let issuingCountry: string | null = null;
  if (!isOptionalEmpty(rawBody.licence_issuing_country)) {
    if (typeof rawBody.licence_issuing_country !== 'string') {
      errors.licence_issuing_country =
        'Le pays de délivrance doit être un code ISO à 2 lettres (ex. TN).';
    } else {
      const normalized = normalizeIsoCountryCode(
        rawBody.licence_issuing_country
      );
      if (!normalized) {
        errors.licence_issuing_country =
          'Le pays de délivrance doit être un code ISO à 2 lettres (ex. TN, MA, FR).';
      } else {
        issuingCountry = normalized;
      }
    }
  }

  // 3. licence_category (optional, ^[A-Z][A-Z0-9+]{0,9}$)
  let licenceCategory: string | null = null;
  if (!isOptionalEmpty(rawBody.licence_category)) {
    if (typeof rawBody.licence_category !== 'string') {
      errors.licence_category =
        'La catégorie de permis est invalide (ex. B, BE, C).';
    } else {
      const normalized = normalizeLicenceCategory(rawBody.licence_category);
      if (!normalized) {
        errors.licence_category =
          'La catégorie de permis est invalide (ex. B, BE, C, D).';
      } else {
        licenceCategory = normalized;
      }
    }
  }

  // 4. licence_expires_on (optional, valid calendar YYYY-MM-DD between 1980-01-01 and 2150-12-31)
  let licenceExpiresOn: string | null = null;
  if (!isOptionalEmpty(rawBody.licence_expires_on)) {
    if (typeof rawBody.licence_expires_on !== 'string') {
      errors.licence_expires_on =
        'La date d’expiration du permis doit être au format AAAA-MM-JJ.';
    } else {
      const trimmedDate = rawBody.licence_expires_on.trim();
      if (!isValidDriverLicenceDate(trimmedDate)) {
        errors.licence_expires_on =
          'La date d’expiration du permis est invalide (format attendu : AAAA-MM-JJ, entre 1980 et 2150).';
      } else {
        licenceExpiresOn = trimmedDate;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      valid: false,
      data: null,
      error: 'Veuillez corriger les champs signalés.',
      errors,
    };
  }

  return {
    valid: true,
    data: {
      full_name: fullName,
      licence_issuing_country: issuingCountry,
      licence_category: licenceCategory,
      licence_expires_on: licenceExpiresOn,
    },
    errors: {},
  };
}

/**
 * Strictly validates PATCH /api/customers/[id]/drivers/[driverId] partial updates.
 * Accepts ONLY the 7 mutable columns granted UPDATE in migration 0007.
 * Omitted fields are never populated so partial updates never overwrite existing values.
 */
export function validatePatchCustomerDriverPayload(
  rawBody: Record<string, unknown>
): PatchCustomerDriverValidationResult {
  const keys = Object.keys(rawBody);
  if (keys.length === 0) {
    return {
      valid: false,
      data: null,
      error: 'Aucun champ modifiable fourni.',
      errors: {},
    };
  }

  const unexpectedKeys = keys.filter(
    (key) => !ALLOWED_PATCH_DRIVER_FIELD_SET.has(key)
  );
  if (unexpectedKeys.length > 0) {
    return {
      valid: false,
      data: null,
      error:
        'La requête contient des champs non autorisés, immuables ou réservés.',
      errors: {},
    };
  }

  const errors: DriverFieldErrors = {};
  const patch: ValidatedPatchCustomerDriverPayload = {};
  const hasKey = (key: CustomerDriverFieldName) =>
    Object.prototype.hasOwnProperty.call(rawBody, key);

  if (hasKey('full_name')) {
    if (typeof rawBody.full_name !== 'string') {
      errors.full_name = 'Le nom complet du conducteur est obligatoire.';
    } else {
      const normalized = normalizeFullName(rawBody.full_name);
      if (normalized.length < 2) {
        errors.full_name =
          'Le nom complet doit contenir au moins 2 caractères.';
      } else if (normalized.length > 140) {
        errors.full_name =
          'Le nom complet ne peut pas dépasser 140 caractères.';
      } else {
        patch.full_name = normalized;
      }
    }
  }

  if (hasKey('licence_issuing_country')) {
    const val = rawBody.licence_issuing_country;
    if (val === null || (typeof val === 'string' && val.trim() === '')) {
      patch.licence_issuing_country = null;
    } else if (typeof val !== 'string') {
      errors.licence_issuing_country =
        'Le pays de délivrance doit être un code ISO à 2 lettres (ex. TN).';
    } else {
      const normalized = normalizeIsoCountryCode(val);
      if (!normalized) {
        errors.licence_issuing_country =
          'Le pays de délivrance doit être un code ISO à 2 lettres (ex. TN, MA, FR).';
      } else {
        patch.licence_issuing_country = normalized;
      }
    }
  }

  if (hasKey('licence_category')) {
    const val = rawBody.licence_category;
    if (val === null || (typeof val === 'string' && val.trim() === '')) {
      patch.licence_category = null;
    } else if (typeof val !== 'string') {
      errors.licence_category =
        'La catégorie de permis est invalide (ex. B, BE, C).';
    } else {
      const normalized = normalizeLicenceCategory(val);
      if (!normalized) {
        errors.licence_category =
          'La catégorie de permis est invalide (ex. B, BE, C, D).';
      } else {
        patch.licence_category = normalized;
      }
    }
  }

  if (hasKey('licence_expires_on')) {
    const val = rawBody.licence_expires_on;
    if (val === null || (typeof val === 'string' && val.trim() === '')) {
      patch.licence_expires_on = null;
    } else if (typeof val !== 'string') {
      errors.licence_expires_on =
        'La date d’expiration du permis doit être au format AAAA-MM-JJ.';
    } else {
      const trimmedDate = val.trim();
      if (!isValidDriverLicenceDate(trimmedDate)) {
        errors.licence_expires_on =
          'La date d’expiration du permis est invalide (format attendu : AAAA-MM-JJ, entre 1980 et 2150).';
      } else {
        patch.licence_expires_on = trimmedDate;
      }
    }
  }

  if (hasKey('verification_status')) {
    const val = rawBody.verification_status;
    if (typeof val !== 'string' || !VALID_VERIFICATION_STATUS_SET.has(val)) {
      errors.verification_status =
        'Le statut de vérification est invalide (valeurs autorisées : unverified, pending, verified, rejected).';
    } else {
      patch.verification_status = val as DriverVerificationStatus;
    }
  }

  if (hasKey('verification_notes')) {
    const val = rawBody.verification_notes;
    if (val === null || (typeof val === 'string' && val.trim() === '')) {
      patch.verification_notes = null;
    } else if (typeof val !== 'string') {
      errors.verification_notes =
        'Les notes de vérification doivent être une chaîne de caractères ou null.';
    } else {
      const trimmed = val.trim();
      if (trimmed.length > 1000) {
        errors.verification_notes =
          'Les notes de vérification ne peuvent pas dépasser 1000 caractères.';
      } else {
        patch.verification_notes = trimmed;
      }
    }
  }

  if (hasKey('is_active')) {
    const val = rawBody.is_active;
    if (typeof val !== 'boolean') {
      errors.is_active =
        'Le statut actif du conducteur doit être un booléen (true ou false).';
    } else {
      patch.is_active = val;
    }
  }

  const isSimultaneousVerifyConflict =
    patch.verification_status === 'verified' &&
    DRIVER_VERIFICATION_SENSITIVE_FIELDS.some((field) => hasKey(field));
  if (isSimultaneousVerifyConflict) {
    errors.verification_status =
      'Impossible de marquer le conducteur comme vérifié dans la même mise à jour qu’une modification de son identité ou de son permis.';
  }

  if (Object.keys(errors).length > 0) {
    return {
      valid: false,
      data: null,
      error: isSimultaneousVerifyConflict
        ? 'Impossible de marquer le conducteur comme vérifié lors d’une modification des informations d’identité ou de permis. Enregistrez d’abord les modifications puis effectuez une nouvelle vérification manuelle.'
        : 'Veuillez corriger les champs signalés.',
      errors,
    };
  }

  if (Object.keys(patch).length === 0) {
    return {
      valid: false,
      data: null,
      error: 'Aucun champ modifiable fourni.',
      errors: {},
    };
  }

  return {
    valid: true,
    data: patch,
    errors: {},
  };
}

interface PostgresLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  constraint?: string | null;
}

export function mapDriverWriteDbError(error: PostgresLikeError): {
  status: number;
  message: string;
  fieldErrors?: DriverFieldErrors;
} {
  if (error.code === '42501') {
    return {
      status: 403,
      message:
        'Accès refusé : seuls le propriétaire et le gérant peuvent gérer les conducteurs autorisés.',
    };
  }

  if (error.code === '23503') {
    return {
      status: 404,
      message: 'Client introuvable dans votre agence.',
    };
  }

  if (error.code === '23514') {
    const rawContext = `${error.constraint ?? ''} ${error.message ?? ''}`.toLowerCase();
    const fieldErrors: DriverFieldErrors = {};

    if (rawContext.includes('full_name')) {
      fieldErrors.full_name =
        'Le nom complet doit contenir entre 2 et 140 caractères.';
    } else if (rawContext.includes('licence_issuing_country')) {
      fieldErrors.licence_issuing_country =
        'Le pays de délivrance doit être un code ISO à 2 lettres.';
    } else if (rawContext.includes('licence_category')) {
      fieldErrors.licence_category = 'La catégorie de permis est invalide.';
    } else if (rawContext.includes('licence_expires_on')) {
      fieldErrors.licence_expires_on =
        'La date d’expiration du permis est invalide.';
    } else if (rawContext.includes('verification_notes')) {
      fieldErrors.verification_notes =
        'Les notes de vérification ne peuvent pas dépasser 1000 caractères.';
    } else if (rawContext.includes('verification_integrity')) {
      fieldErrors.verification_status =
        'Impossible de marquer le conducteur comme vérifié dans la même mise à jour qu’une modification de son identité ou de son permis.';
      return {
        status: 400,
        message:
          'Impossible de marquer le conducteur comme vérifié lors d’une modification des informations d’identité ou de permis. Enregistrez d’abord les modifications puis effectuez une nouvelle vérification manuelle.',
        fieldErrors,
      };
    }

    return {
      status: 400,
      message: 'Les données du conducteur ne respectent pas les règles de validation.',
      ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    };
  }

  if (error.code === '22P02' || error.code === '22007') {
    return {
      status: 400,
      message: 'Le format des données du conducteur est invalide.',
    };
  }

  return {
    status: 500,
    message: 'Impossible d’enregistrer les modifications du conducteur autorisé.',
  };
}

