export interface OnboardingAgencyInput {
  name: string;
  legalName?: string;
  slug: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  address: string;
  taxId?: string;
  vatRatePercent?: string;
}

export type OnboardingField = keyof OnboardingAgencyInput;

export type OnboardingFieldErrors = Partial<Record<OnboardingField, string>>;

export interface NormalizedOnboardingAgency {
  name: string;
  legalName: string | null;
  slug: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  address: string;
  taxId: string | null;
  currencyCode: 'TND';
  currencyMinorUnit: 3;
  timezone: 'Africa/Tunis';
  defaultLocale: 'fr';
  vatRateBps: number;
}

export interface CreateAgencyRpcParams {
  p_name: string;
  p_slug: string;
  p_legal_name: string | null;
  p_tax_id: string | null;
  p_email: string | null;
  p_phone: string | null;
  p_city: string | null;
  p_address: string | null;
  p_country_code: string;
  p_currency_code: string;
  p_currency_minor_unit: number;
  p_timezone: string;
  p_default_locale: string;
  p_vat_rate_bps: number;
}

export interface OnboardingValidationResult {
  valid: boolean;
  errors: OnboardingFieldErrors;
  data: NormalizedOnboardingAgency | null;
}

export const DEFAULT_ONBOARDING_VALUES: OnboardingAgencyInput = {
  name: '',
  legalName: '',
  slug: '',
  city: '',
  countryCode: 'TN',
  phone: '',
  email: '',
  address: '',
  taxId: '',
  vatRatePercent: '19',
};

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+?[0-9\s\-()]{8,24}$/;

/**
 * Generates a PostgreSQL-compatible lowercase slug from an agency name.
 * Strips accents/diacritics, collapses separators, and enforces the 80-char DB ceiling.
 */
export function slugifyAgencyName(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Validates and normalizes onboarding fields on both client and server.
 * Server Route Handler ALWAYS runs this before calling public.create_agency().
 */
export function validateOnboardingAgencyInput(
  raw: Partial<Record<OnboardingField, unknown>>
): OnboardingValidationResult {
  const errors: OnboardingFieldErrors = {};

  const name = asTrimmedString(raw.name);
  const legalName = asTrimmedString(raw.legalName);
  const slug = asTrimmedString(raw.slug).toLowerCase();
  const city = asTrimmedString(raw.city);
  const countryCode = (asTrimmedString(raw.countryCode) || 'TN').toUpperCase();
  const phone = asTrimmedString(raw.phone);
  const email = asTrimmedString(raw.email).toLowerCase();
  const address = asTrimmedString(raw.address);
  const taxId = asTrimmedString(raw.taxId);
  const rawVat = asTrimmedString(raw.vatRatePercent);

  if (!name) {
    errors.name = 'Le nom de l’agence est obligatoire.';
  } else if (name.length < 2 || name.length > 120) {
    errors.name = 'Le nom de l’agence doit contenir entre 2 et 120 caractères.';
  }

  if (legalName.length > 160) {
    errors.legalName = 'Le nom légal ne doit pas dépasser 160 caractères.';
  }

  if (!slug) {
    errors.slug = 'L’identifiant unique (slug) est obligatoire.';
  } else if (slug.length < 2 || slug.length > 80 || !SLUG_PATTERN.test(slug)) {
    errors.slug =
      'Utilisez entre 2 et 80 caractères en minuscules, chiffres et tirets uniquement (ex. atlas-location-tunis).';
  }

  if (!city) {
    errors.city = 'La ville est obligatoire.';
  } else if (city.length < 2 || city.length > 80) {
    errors.city = 'La ville doit contenir entre 2 et 80 caractères.';
  }

  if (!COUNTRY_CODE_PATTERN.test(countryCode)) {
    errors.countryCode = 'Sélectionnez un pays valide (code ISO à 2 lettres).';
  }

  if (!phone) {
    errors.phone = 'Le numéro de téléphone est obligatoire.';
  } else if (!PHONE_PATTERN.test(phone)) {
    errors.phone =
      'Saisissez un numéro de téléphone valide (8 à 24 caractères, ex. +216 71 000 000).';
  }

  if (!email) {
    errors.email = 'L’adresse e-mail professionnelle est obligatoire.';
  } else if (email.length > 160 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Saisissez une adresse e-mail professionnelle valide.';
  }

  if (!address) {
    errors.address = 'L’adresse de l’agence est obligatoire.';
  } else if (address.length < 4 || address.length > 240) {
    errors.address = 'L’adresse doit contenir entre 4 et 240 caractères.';
  }

  if (taxId.length > 64) {
    errors.taxId = 'Le matricule fiscal ne doit pas dépasser 64 caractères.';
  }

  let vatRateBps = 1900;
  if (rawVat) {
    const parsedVat = Number(rawVat.replace(',', '.'));
    if (!Number.isFinite(parsedVat) || parsedVat < 0 || parsedVat > 100) {
      errors.vatRatePercent =
        'Le taux de TVA configurable doit être compris entre 0 et 100 %.';
    } else {
      vatRateBps = Math.round(parsedVat * 100);
    }
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors, data: null };
  }

  return {
    valid: true,
    errors: {},
    data: {
      name,
      legalName: legalName || null,
      slug,
      city,
      countryCode,
      phone,
      email,
      address,
      taxId: taxId || null,
      currencyCode: 'TND',
      currencyMinorUnit: 3,
      timezone: 'Africa/Tunis',
      defaultLocale: 'fr',
      vatRateBps,
    },
  };
}

/**
 * Builds the exact PostgreSQL parameter payload expected by public.create_agency(...).
 */
export function buildCreateAgencyRpcParams(
  data: NormalizedOnboardingAgency
): CreateAgencyRpcParams {
  return {
    p_name: data.name,
    p_slug: data.slug,
    p_legal_name: data.legalName,
    p_tax_id: data.taxId,
    p_email: data.email,
    p_phone: data.phone,
    p_city: data.city,
    p_address: data.address,
    p_country_code: data.countryCode,
    p_currency_code: data.currencyCode,
    p_currency_minor_unit: data.currencyMinorUnit,
    p_timezone: data.timezone,
    p_default_locale: data.defaultLocale,
    p_vat_rate_bps: data.vatRateBps,
  };
}

export interface MappedRpcError {
  status: number;
  message: string;
  fieldErrors?: OnboardingFieldErrors;
}

/**
 * Translates PostgreSQL / PostgREST RPC errors from public.create_agency()
 * into clean HTTP status codes and French messages without leaking internals.
 */
export function mapCreateAgencyRpcError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): MappedRpcError {
  const code = (error.code ?? '').trim();
  const message = (error.message ?? '').toLowerCase();
  const details = (error.details ?? '').toLowerCase();

  if (
    code === '23505' ||
    message.includes('agencies_slug_unique') ||
    details.includes('(slug)')
  ) {
    return {
      status: 409,
      message:
        'Cet identifiant unique (slug) est déjà utilisé par une autre agence. Veuillez en choisir un autre.',
      fieldErrors: {
        slug: 'Cet identifiant est déjà pris. Essayez une variante (ex. ajoutez votre ville).',
      },
    };
  }

  if (code === '42501' || message.includes('authentication required')) {
    return {
      status: 401,
      message:
        'Votre session a expiré ou n’est pas autorisée. Veuillez vous reconnecter.',
    };
  }

  if (code === '22023' || code === '23514') {
    if (message.includes('slug')) {
      return {
        status: 400,
        message: 'Le format de l’identifiant unique (slug) est invalide.',
        fieldErrors: {
          slug: 'Utilisez uniquement des lettres minuscules, des chiffres et des tirets (2 à 80 caractères).',
        },
      };
    }
    if (message.includes('name')) {
      return {
        status: 400,
        message: 'Le nom de l’agence est invalide.',
        fieldErrors: {
          name: 'Le nom de l’agence doit contenir entre 2 et 120 caractères.',
        },
      };
    }
    return {
      status: 400,
      message:
        'Certaines informations saisies ne respectent pas les règles de validation. Veuillez vérifier le formulaire.',
    };
  }

  return {
    status: 500,
    message:
      'Impossible de créer l’agence pour le moment. Veuillez réessayer dans quelques instants.',
  };
}
