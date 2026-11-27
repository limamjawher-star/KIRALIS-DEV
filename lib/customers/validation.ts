import {
  CUSTOMER_TYPE_VALUES,
  DEFAULT_CUSTOMER_COUNTRY_CODE,
  EDITABLE_CUSTOMER_FIELDS,
  type CustomerFieldErrors,
  type CustomerFieldName,
  type CustomerFilterState,
  type CustomerRecord,
  type CustomerType,
  type ValidatedCustomerPatchPayload,
  type ValidatedCustomerPayload,
} from './types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const ALLOWED_PHONE_CHARS_PATTERN = /^\+?[\d\s().-]+$/;
const EDITABLE_FIELD_SET: ReadonlySet<string> = new Set(EDITABLE_CUSTOMER_FIELDS);

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Normalizes optional customer email addresses to trimmed lowercase.
 * Returns null when omitted so PostgreSQL's partial unique index allows
 * multiple customers without an email address.
 */
export function normalizeCustomerEmail(value: unknown): string | null {
  const trimmed = cleanString(value).toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes international phone numbers while preserving leading '+' and
 * readable separators (spaces, hyphens, parentheses, dots).
 */
export function normalizeCustomerPhone(value: unknown): string {
  return collapseWhitespace(cleanString(value));
}

export interface CustomerValidationResult {
  valid: boolean;
  errors: CustomerFieldErrors;
  data?: ValidatedCustomerPayload;
}

export interface CustomerPatchValidationResult {
  valid: boolean;
  error?: string;
  errors: CustomerFieldErrors;
  data?: ValidatedCustomerPatchPayload;
}

export function validateCustomerPayload(
  input: Record<string, unknown>
): CustomerValidationResult {
  const errors: CustomerFieldErrors = {};

  const rawType = cleanString(input.customer_type);
  const customerType: CustomerType = CUSTOMER_TYPE_VALUES.includes(
    rawType as CustomerType
  )
    ? (rawType as CustomerType)
    : 'individual';

  if (rawType && !CUSTOMER_TYPE_VALUES.includes(rawType as CustomerType)) {
    errors.customer_type = 'Type de client invalide.';
  }

  const fullName = collapseWhitespace(cleanString(input.full_name));
  if (fullName.length < 2 || fullName.length > 140) {
    errors.full_name =
      'Le nom complet doit contenir entre 2 et 140 caractères.';
  }

  const rawCompany = collapseWhitespace(cleanString(input.company_name));
  if (rawCompany.length > 140) {
    errors.company_name =
      'La raison sociale ne doit pas dépasser 140 caractères.';
  }
  const companyName = rawCompany.length > 0 ? rawCompany : null;

  const email = normalizeCustomerEmail(input.email);
  if (email !== null) {
    if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
      errors.email = 'Veuillez saisir une adresse e-mail valide.';
    }
  }

  const phone = normalizeCustomerPhone(input.phone);
  const digitCount = (phone.match(/\d/g) ?? []).length;
  if (phone.length < 6 || phone.length > 30) {
    errors.phone =
      'Le numéro de téléphone doit contenir entre 6 et 30 caractères.';
  } else if (!ALLOWED_PHONE_CHARS_PATTERN.test(phone) || digitCount < 6) {
    errors.phone =
      'Format de téléphone invalide (ex. +216 22 123 456 ou +33 6 12 34 56 78).';
  }

  const rawAddress = collapseWhitespace(cleanString(input.address));
  if (rawAddress.length > 240) {
    errors.address = 'L’adresse ne doit pas dépasser 240 caractères.';
  }
  const address = rawAddress.length > 0 ? rawAddress : null;

  const rawCity = collapseWhitespace(cleanString(input.city));
  if (rawCity.length > 100) {
    errors.city = 'La ville ne doit pas dépasser 100 caractères.';
  }
  const city = rawCity.length > 0 ? rawCity : null;

  const rawCountry = cleanString(input.country_code).toUpperCase();
  const countryCode = rawCountry || DEFAULT_CUSTOMER_COUNTRY_CODE;
  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.country_code = 'Le code pays doit comporter exactement 2 lettres ISO (ex. TN, FR).';
  }

  const rawNotes = cleanString(input.notes);
  if (rawNotes.length > 2000) {
    errors.notes = 'Les notes internes ne doivent pas dépasser 2 000 caractères.';
  }
  const notes = rawNotes.length > 0 ? rawNotes : null;

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      customer_type: customerType,
      full_name: fullName,
      company_name: companyName,
      email,
      phone,
      address,
      city,
      country_code: countryCode,
      notes,
    },
  };
}

/**
 * Validates a partial PATCH payload strictly against the editable columns
 * granted on public.customers. Rejects immutable/unknown fields and preserves
 * omitted fields so partial updates never clear untouched attributes.
 */
export function validateCustomerPatchPayload(
  input: Record<string, unknown>
): CustomerPatchValidationResult {
  const keys = Object.keys(input);
  if (keys.length === 0) {
    return {
      valid: false,
      error: 'Aucun champ modifiable fourni.',
      errors: {},
    };
  }

  for (const key of keys) {
    if (!EDITABLE_FIELD_SET.has(key)) {
      return {
        valid: false,
        error:
          'Modification refusée : un ou plusieurs champs fournis sont non modifiables ou non autorisés.',
        errors: {},
      };
    }
  }

  const errors: CustomerFieldErrors = {};
  const data: ValidatedCustomerPatchPayload = {};
  const hasField = (field: CustomerFieldName) =>
    Object.prototype.hasOwnProperty.call(input, field) &&
    input[field] !== undefined;

  if (hasField('customer_type')) {
    const rawType = typeof input.customer_type === 'string'
      ? input.customer_type.trim()
      : '';
    if (!CUSTOMER_TYPE_VALUES.includes(rawType as CustomerType)) {
      errors.customer_type = 'Type de client invalide.';
    } else {
      data.customer_type = rawType as CustomerType;
    }
  }

  if (hasField('full_name')) {
    if (typeof input.full_name !== 'string') {
      errors.full_name =
        'Le nom complet doit contenir entre 2 et 140 caractères.';
    } else {
      const fullName = collapseWhitespace(input.full_name);
      if (fullName.length < 2 || fullName.length > 140) {
        errors.full_name =
          'Le nom complet doit contenir entre 2 et 140 caractères.';
      } else {
        data.full_name = fullName;
      }
    }
  }

  if (hasField('company_name')) {
    const raw = input.company_name;
    if (raw === null) {
      data.company_name = null;
    } else if (typeof raw !== 'string') {
      errors.company_name = 'La raison sociale doit être une chaîne de caractères.';
    } else {
      const company = collapseWhitespace(raw);
      if (company.length > 140) {
        errors.company_name =
          'La raison sociale ne doit pas dépasser 140 caractères.';
      } else {
        data.company_name = company.length > 0 ? company : null;
      }
    }
  }

  if (hasField('email')) {
    const raw = input.email;
    if (raw === null) {
      data.email = null;
    } else if (typeof raw !== 'string') {
      errors.email = 'Veuillez saisir une adresse e-mail valide.';
    } else {
      const email = normalizeCustomerEmail(raw);
      if (email !== null && (email.length > 254 || !EMAIL_PATTERN.test(email))) {
        errors.email = 'Veuillez saisir une adresse e-mail valide.';
      } else {
        data.email = email;
      }
    }
  }

  if (hasField('phone')) {
    if (typeof input.phone !== 'string') {
      errors.phone =
        'Le numéro de téléphone doit contenir entre 6 et 30 caractères.';
    } else {
      const phone = normalizeCustomerPhone(input.phone);
      const digitCount = (phone.match(/\d/g) ?? []).length;
      if (phone.length < 6 || phone.length > 30) {
        errors.phone =
          'Le numéro de téléphone doit contenir entre 6 et 30 caractères.';
      } else if (!ALLOWED_PHONE_CHARS_PATTERN.test(phone) || digitCount < 6) {
        errors.phone =
          'Format de téléphone invalide (ex. +216 22 123 456 ou +33 6 12 34 56 78).';
      } else {
        data.phone = phone;
      }
    }
  }

  if (hasField('address')) {
    const raw = input.address;
    if (raw === null) {
      data.address = null;
    } else if (typeof raw !== 'string') {
      errors.address = 'L’adresse doit être une chaîne de caractères.';
    } else {
      const address = collapseWhitespace(raw);
      if (address.length > 240) {
        errors.address = 'L’adresse ne doit pas dépasser 240 caractères.';
      } else {
        data.address = address.length > 0 ? address : null;
      }
    }
  }

  if (hasField('city')) {
    const raw = input.city;
    if (raw === null) {
      data.city = null;
    } else if (typeof raw !== 'string') {
      errors.city = 'La ville doit être une chaîne de caractères.';
    } else {
      const city = collapseWhitespace(raw);
      if (city.length > 100) {
        errors.city = 'La ville ne doit pas dépasser 100 caractères.';
      } else {
        data.city = city.length > 0 ? city : null;
      }
    }
  }

  if (hasField('country_code')) {
    if (typeof input.country_code !== 'string') {
      errors.country_code =
        'Le code pays doit comporter exactement 2 lettres ISO (ex. TN, FR).';
    } else {
      const countryCode = input.country_code.trim().toUpperCase();
      if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
        errors.country_code =
          'Le code pays doit comporter exactement 2 lettres ISO (ex. TN, FR).';
      } else {
        data.country_code = countryCode;
      }
    }
  }

  if (hasField('notes')) {
    const raw = input.notes;
    if (raw === null) {
      data.notes = null;
    } else if (typeof raw !== 'string') {
      errors.notes = 'Les notes internes doivent être une chaîne de caractères.';
    } else {
      const notes = raw.trim();
      if (notes.length > 2000) {
        errors.notes =
          'Les notes internes ne doivent pas dépasser 2 000 caractères.';
      } else {
        data.notes = notes.length > 0 ? notes : null;
      }
    }
  }

  if (Object.keys(errors).length > 0) {
    return {
      valid: false,
      error: 'Veuillez corriger les champs signalés dans le formulaire.',
      errors,
    };
  }

  if (Object.keys(data).length === 0) {
    return {
      valid: false,
      error: 'Aucun champ modifiable fourni.',
      errors: {},
    };
  }

  return {
    valid: true,
    errors: {},
    data,
  };
}

export interface MappedCustomerDbError {
  status: number;
  message: string;
  fieldErrors?: CustomerFieldErrors;
}

/**
 * Maps PostgreSQL / Supabase errors to safe, actionable French responses
 * without exposing raw SQL internals or personal customer details.
 */
export function mapCustomerDbError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): MappedCustomerDbError {
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  const details = (error.details ?? '').toLowerCase();

  if (
    code === '23505' ||
    message.includes('idx_customers_agency_email_unique') ||
    details.includes('email')
  ) {
    return {
      status: 409,
      message: 'Un client avec cette adresse e-mail existe déjà dans votre agence.',
      fieldErrors: {
        email: 'Cette adresse e-mail est déjà utilisée dans votre agence.',
      },
    };
  }

  if (
    code === '42501' ||
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return {
      status: 403,
      message:
        'Accès refusé : vous ne disposez pas des droits nécessaires pour gérer les clients de cette agence.',
    };
  }

  if (code === '23514' || code === '22P02') {
    return {
      status: 400,
      message: 'Certaines informations client sont invalides. Vérifiez les champs saisis.',
    };
  }

  return {
    status: 500,
    message: 'Une erreur est survenue lors de l’enregistrement du client.',
  };
}

export function filterAndSortCustomers(
  customers: readonly CustomerRecord[],
  filters: CustomerFilterState
): CustomerRecord[] {
  const query = filters.search.trim().toLowerCase();

  const filtered = customers.filter((customer) => {
    if (
      filters.customerType !== 'all' &&
      customer.customer_type !== filters.customerType
    ) {
      return false;
    }

    if (query) {
      const haystack = [
        customer.full_name,
        customer.phone,
        customer.email ?? '',
        customer.company_name ?? '',
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(query)) {
        return false;
      }
    }

    return true;
  });

  return filtered.sort((a, b) => {
    switch (filters.sortBy) {
      case 'oldest':
        return a.created_at.localeCompare(b.created_at);
      case 'name_asc':
        return a.full_name.localeCompare(b.full_name, 'fr', {
          sensitivity: 'base',
        });
      case 'name_desc':
        return b.full_name.localeCompare(a.full_name, 'fr', {
          sensitivity: 'base',
        });
      case 'newest':
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });
}

export interface CustomerSummary {
  totalCount: number;
  individualCount: number;
  corporateCount: number;
  withEmailCount: number;
}

export function computeCustomerSummary(
  customers: readonly CustomerRecord[]
): CustomerSummary {
  let individualCount = 0;
  let corporateCount = 0;
  let withEmailCount = 0;

  for (const customer of customers) {
    if (customer.customer_type === 'corporate') {
      corporateCount += 1;
    } else {
      individualCount += 1;
    }
    if (customer.email && customer.email.trim().length > 0) {
      withEmailCount += 1;
    }
  }

  return {
    totalCount: customers.length,
    individualCount,
    corporateCount,
    withEmailCount,
  };
}
