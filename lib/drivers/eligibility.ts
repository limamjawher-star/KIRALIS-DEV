import { DEFAULT_TIMEZONE } from '@/lib/currency';
import type {
  CustomerDriversEligibilitySummary,
  DriverEligibilityAssessment,
  DriverEligibilityFlag,
  DriverEligibilityInput,
  DriverEligibilityOptions,
  DriverEligibilityPrecheckStatus,
  DriverEligibilityRuleSet,
  DriverLicenceExpiryStatus,
} from './types';

export const DEFAULT_DRIVER_LICENCE_WARNING_DAYS = 30;

export const DRIVER_ELIGIBILITY_LEGAL_NOTICE =
  'Pré-contrôle opérationnel basé uniquement sur les métadonnées enregistrées. Il ne déclare pas automatiquement le conducteur légalement éligible : les conditions légales (âge minimal, ancienneté du permis, réciprocité internationale, vérification physique du permis original) restent soumises à la réglementation locale et à la validation de l’agence.';

const DEFAULT_CATEGORY_EQUIVALENCES: Readonly<Record<string, readonly string[]>> = {
  AM: ['AM', 'A1', 'A2', 'A', 'B', 'BE', 'C1', 'C1E', 'C', 'CE', 'D1', 'D1E', 'D', 'DE'],
  A1: ['A1', 'A2', 'A'],
  A2: ['A2', 'A'],
  A: ['A'],
  B: ['B', 'BE'],
  BE: ['BE'],
  C1: ['C1', 'C1E', 'C', 'CE'],
  C1E: ['C1E', 'CE'],
  C: ['C', 'CE'],
  CE: ['CE'],
  D1: ['D1', 'D1E', 'D', 'DE'],
  D1E: ['D1E', 'DE'],
  D: ['D', 'DE'],
  DE: ['DE'],
};

export const DEFAULT_TUNISIA_DRIVER_RULE_SET: DriverEligibilityRuleSet = {
  id: 'TN_DEFAULT',
  jurisdictionCode: 'TN',
  warningThresholdDays: DEFAULT_DRIVER_LICENCE_WARNING_DAYS,
  categoryEquivalences: DEFAULT_CATEGORY_EQUIVALENCES,
  flagForeignIssuingCountry: true,
};

/**
 * Builds a jurisdiction-configurable rule set for Tunisia, Morocco, MENA, or Europe.
 */
export function createDriverEligibilityRuleSet(
  overrides: Partial<DriverEligibilityRuleSet> & {
    jurisdictionCode: string;
  }
): DriverEligibilityRuleSet {
  const normalizedCountry = normalizeIsoCountryCode(overrides.jurisdictionCode) ?? 'TN';
  const threshold = normalizeWarningThresholdDays(
    overrides.warningThresholdDays ?? DEFAULT_DRIVER_LICENCE_WARNING_DAYS
  );

  return {
    id: overrides.id?.trim() || `${normalizedCountry}_CUSTOM`,
    jurisdictionCode: normalizedCountry,
    warningThresholdDays: threshold,
    categoryEquivalences:
      overrides.categoryEquivalences ?? DEFAULT_CATEGORY_EQUIVALENCES,
    flagForeignIssuingCountry: overrides.flagForeignIssuingCountry ?? true,
  };
}

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_COUNTRY_PATTERN = /^[A-Z]{2}$/;
const LICENCE_CATEGORY_PATTERN = /^[A-Z][A-Z0-9+]{0,9}$/;
const MS_PER_DAY = 86_400_000;

export function normalizeIsoCountryCode(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  return ISO_COUNTRY_PATTERN.test(trimmed) ? trimmed : null;
}

export function normalizeLicenceCategory(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, '');
  return LICENCE_CATEGORY_PATTERN.test(trimmed) ? trimmed : null;
}

export function isValidDriverLicenceDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1980 || year > 2150 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

function parseIsoDateToUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function diffCalendarDays(fromIsoDate: string, toIsoDate: string): number {
  return Math.round(
    (parseIsoDateToUtcMs(toIsoDate) - parseIsoDateToUtcMs(fromIsoDate)) /
      MS_PER_DAY
  );
}

function resolveSafeTimeZone(timeZone?: string | null): string {
  const candidate = timeZone?.trim() || DEFAULT_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

export function getAgencyTodayIsoDate(
  timeZone?: string | null,
  now: Date = new Date()
): string {
  const safeTz = resolveSafeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value ?? '2026';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${year}-${month}-${day}`;
}

function normalizeWarningThresholdDays(days: number): number {
  if (!Number.isFinite(days)) {
    return DEFAULT_DRIVER_LICENCE_WARNING_DAYS;
  }
  return Math.max(0, Math.min(365, Math.floor(days)));
}

/**
 * Evaluates operational pre-check eligibility signals for an authorized driver.
 *
 * Identifies:
 * - Inactive driver record
 * - Missing licence expiry date
 * - Expired licence (or licence expiring before an optional rental end date)
 * - Licence approaching expiry within the configured threshold
 * - Missing (unverified), pending, or rejected verification status
 * - Missing or potentially mismatched licence category against a required vehicle category
 * - Foreign issuing country requiring manual reciprocity/international permit review
 *
 * Never declares a driver legally eligible on its own.
 */
export function evaluateDriverEligibility(
  driver: DriverEligibilityInput,
  options: DriverEligibilityOptions = {}
): DriverEligibilityAssessment {
  const ruleSet = options.ruleSet ?? DEFAULT_TUNISIA_DRIVER_RULE_SET;
  const timeZone = resolveSafeTimeZone(options.timeZone);
  const referenceDate = getAgencyTodayIsoDate(timeZone, options.now);
  const warningThresholdDays = normalizeWarningThresholdDays(
    options.warningThresholdDays ?? ruleSet.warningThresholdDays
  );

  const flags: DriverEligibilityFlag[] = [];

  if (driver.is_active === false) {
    flags.push({
      code: 'driver_inactive',
      severity: 'blocking',
      message: 'Ce conducteur autorisé est désactivé pour ce client.',
    });
  }

  // 1. Licence expiry date evaluation
  const rawExpiry = driver.licence_expires_on?.trim() || null;
  let licenceExpiryStatus: DriverLicenceExpiryStatus = 'missing';
  let daysUntilExpiry: number | null = null;
  let expiresBeforeRentalEnd = false;

  if (!rawExpiry || !isValidDriverLicenceDate(rawExpiry)) {
    licenceExpiryStatus = 'missing';
    flags.push({
      code: 'licence_expiry_missing',
      severity: 'warning',
      message: 'La date d’expiration du permis de conduire n’est pas renseignée.',
    });
  } else {
    daysUntilExpiry = diffCalendarDays(referenceDate, rawExpiry);

    if (daysUntilExpiry < 0) {
      licenceExpiryStatus = 'expired';
      flags.push({
        code: 'licence_expired',
        severity: 'blocking',
        message: 'Le permis de conduire enregistré est expiré.',
      });
    } else {
      if (daysUntilExpiry <= warningThresholdDays) {
        licenceExpiryStatus = 'expiring_soon';
        flags.push({
          code: 'licence_expiring_soon',
          severity: 'warning',
          message: `Le permis de conduire expire bientôt (dans ${daysUntilExpiry} jour${daysUntilExpiry > 1 ? 's' : ''}).`,
        });
      } else {
        licenceExpiryStatus = 'valid_for_window';
      }

      const rentalEnd = options.rentalEndDate?.trim() || null;
      if (rentalEnd && isValidDriverLicenceDate(rentalEnd)) {
        const daysAfterRentalEnd = diffCalendarDays(rentalEnd, rawExpiry);
        if (daysAfterRentalEnd < 0) {
          expiresBeforeRentalEnd = true;
          flags.push({
            code: 'licence_expires_during_rental',
            severity: 'blocking',
            message:
              'Le permis de conduire expire avant la date de retour prévue de la location.',
          });
        }
      }
    }
  }

  // 2. Verification status evaluation
  switch (driver.verification_status) {
    case 'rejected':
      flags.push({
        code: 'verification_rejected',
        severity: 'blocking',
        message: 'La vérification de ce conducteur a été refusée par l’agence.',
      });
      break;
    case 'unverified':
      flags.push({
        code: 'verification_unverified',
        severity: 'warning',
        message: 'Ce conducteur n’a pas encore été vérifié par l’agence.',
      });
      break;
    case 'pending':
      flags.push({
        code: 'verification_pending',
        severity: 'warning',
        message: 'La vérification de ce conducteur est en attente de validation.',
      });
      break;
    case 'verified':
      break;
  }

  // 3. Licence category check (potential mismatch flagged for manual review)
  const driverCategory = normalizeLicenceCategory(driver.licence_category);
  const requiredCategory = normalizeLicenceCategory(
    options.requiredLicenceCategory
  );

  if (!driverCategory) {
    flags.push({
      code: 'licence_category_missing',
      severity: 'warning',
      message: 'La catégorie du permis de conduire n’est pas renseignée.',
    });
  } else if (requiredCategory) {
    const accepted = ruleSet.categoryEquivalences[requiredCategory] ?? [
      requiredCategory,
    ];
    if (!accepted.includes(driverCategory)) {
      flags.push({
        code: 'licence_category_mismatch',
        severity: 'warning',
        message: `Incompatibilité potentielle de catégorie de permis : permis « ${driverCategory} » pour une catégorie requise « ${requiredCategory} » (vérification manuelle requise).`,
      });
    }
  }

  // 4. Issuing country check (foreign permit awareness, never an automated denial)
  const issuingCountry = normalizeIsoCountryCode(driver.licence_issuing_country);
  if (!issuingCountry) {
    flags.push({
      code: 'issuing_country_missing',
      severity: 'info',
      message: 'Le pays de délivrance du permis n’est pas renseigné.',
    });
  } else if (
    ruleSet.flagForeignIssuingCountry &&
    issuingCountry !== ruleSet.jurisdictionCode
  ) {
    flags.push({
      code: 'foreign_licence_manual_check',
      severity: 'info',
      message: `Permis délivré à l’étranger (${issuingCountry}) : vérifiez les règles locales de reconnaissance et la nécessité d’un permis international.`,
    });
  }

  let blockingCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const flag of flags) {
    if (flag.severity === 'blocking') blockingCount += 1;
    else if (flag.severity === 'warning') warningCount += 1;
    else infoCount += 1;
  }

  let status: DriverEligibilityPrecheckStatus;
  if (blockingCount > 0) {
    status = 'blocked';
  } else if (warningCount > 0) {
    status = 'attention_required';
  } else {
    status = 'checks_passed_manual_review_required';
  }

  return {
    status,
    requiresCountrySpecificVerification: true,
    legalNotice: DRIVER_ELIGIBILITY_LEGAL_NOTICE,
    ruleSetId: ruleSet.id,
    jurisdictionCode: ruleSet.jurisdictionCode,
    referenceDate,
    timeZone,
    warningThresholdDays,
    licenceExpiryStatus,
    daysUntilExpiry,
    expiresBeforeRentalEnd,
    blockingCount,
    warningCount,
    infoCount,
    flags,
  };
}

/**
 * Computes an operational eligibility overview across a customer's authorized drivers.
 */
export function summarizeCustomerDriversEligibility(
  drivers: readonly DriverEligibilityInput[],
  options: DriverEligibilityOptions = {}
): CustomerDriversEligibilitySummary {
  let activeDrivers = 0;
  let checksPassedManualReviewCount = 0;
  let attentionRequiredCount = 0;
  let blockedCount = 0;
  let expiredLicenceCount = 0;
  let expiringSoonLicenceCount = 0;
  let missingExpiryCount = 0;

  for (const driver of drivers) {
    if (driver.is_active !== false) {
      activeDrivers += 1;
    }

    const assessment = evaluateDriverEligibility(driver, options);
    if (assessment.status === 'blocked') blockedCount += 1;
    else if (assessment.status === 'attention_required') attentionRequiredCount += 1;
    else checksPassedManualReviewCount += 1;

    if (assessment.licenceExpiryStatus === 'expired') expiredLicenceCount += 1;
    else if (assessment.licenceExpiryStatus === 'expiring_soon')
      expiringSoonLicenceCount += 1;
    else if (assessment.licenceExpiryStatus === 'missing') missingExpiryCount += 1;
  }

  return {
    totalDrivers: drivers.length,
    activeDrivers,
    checksPassedManualReviewCount,
    attentionRequiredCount,
    blockedCount,
    expiredLicenceCount,
    expiringSoonLicenceCount,
    missingExpiryCount,
  };
}
