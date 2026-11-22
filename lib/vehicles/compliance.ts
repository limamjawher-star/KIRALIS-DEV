import { DEFAULT_TIMEZONE } from '@/lib/currency';

export const DEFAULT_COMPLIANCE_WARNING_DAYS = 30;

export type ComplianceStatus =
  | 'valid'
  | 'expiring_soon'
  | 'expired'
  | 'not_provided';

export type ComplianceDocumentKey =
  | 'insurance'
  | 'technical_inspection'
  | 'vignette';

export interface VehicleComplianceDates {
  insurance_expires_on: string | null;
  technical_inspection_expires_on: string | null;
  vignette_expires_on: string | null;
}

export interface ComplianceEvaluationOptions {
  /** IANA timezone of the active agency (defaults to Africa/Tunis). */
  timeZone?: string | null;
  /** Number of calendar days inclusive before expiry that trigger a warning (default 30). */
  warningThresholdDays?: number;
  /** Optional explicit reference timestamp for deterministic testing. */
  now?: Date;
}

export interface ComplianceDocumentEvaluation {
  key: ComplianceDocumentKey;
  label: string;
  shortLabel: string;
  expiresOn: string | null;
  status: ComplianceStatus;
  /** Signed calendar days from agency's "today" to expiresOn (negative when expired, 0 when today). */
  daysRemaining: number | null;
}

export interface VehicleComplianceEvaluation {
  overallStatus: ComplianceStatus;
  referenceDate: string;
  timeZone: string;
  warningThresholdDays: number;
  items: readonly ComplianceDocumentEvaluation[];
  expiredCount: number;
  expiringSoonCount: number;
  validCount: number;
  notProvidedCount: number;
  /** Most urgent item (most overdue or soonest expiring) for compact UI summaries. */
  mostUrgentItem: ComplianceDocumentEvaluation | null;
}

export interface FleetComplianceSummary {
  referenceDate: string;
  timeZone: string;
  warningThresholdDays: number;
  vehiclesWithExpiredCount: number;
  vehiclesWithExpiringSoonCount: number;
  vehiclesValidCount: number;
  vehiclesNotProvidedCount: number;
  expiredDocumentsCount: number;
  expiringSoonDocumentsCount: number;
}

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  valid: 'Valide',
  expiring_soon: 'Expire bientôt',
  expired: 'Expiré',
  not_provided: 'Non renseigné',
};

export const COMPLIANCE_DOCUMENT_META: Record<
  ComplianceDocumentKey,
  { label: string; shortLabel: string; field: keyof VehicleComplianceDates }
> = {
  insurance: {
    label: 'Assurance',
    shortLabel: 'Assurance',
    field: 'insurance_expires_on',
  },
  technical_inspection: {
    label: 'Visite technique',
    shortLabel: 'Visite tech.',
    field: 'technical_inspection_expires_on',
  },
  vignette: {
    label: 'Vignette',
    shortLabel: 'Vignette',
    field: 'vignette_expires_on',
  },
};

export const COMPLIANCE_INFORMATIONAL_NOTICE =
  'Alerte informative calculée à partir des dates saisies dans le fuseau horaire de l’agence. Elle ne constitue pas une attestation de conformité légale et ne modifie pas automatiquement le statut opérationnel du véhicule.';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/**
 * Validates that a string is a real Gregorian calendar date in YYYY-MM-DD format.
 */
export function isValidIsoCalendarDate(value: string): boolean {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (year < 1980 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const utcDate = new Date(Date.UTC(year, month - 1, day));
  return (
    utcDate.getUTCFullYear() === year &&
    utcDate.getUTCMonth() === month - 1 &&
    utcDate.getUTCDate() === day
  );
}

/**
 * Converts a validated YYYY-MM-DD calendar date to UTC midnight epoch milliseconds.
 * Using UTC midnight for calendar-date arithmetic avoids DST 23h/25h drift.
 */
function isoDateToUtcDayMs(isoDate: string): number {
  const match = ISO_DATE_PATTERN.exec(isoDate);
  if (!match) {
    throw new RangeError(`Invalid ISO calendar date: ${isoDate}`);
  }
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Resolves a valid IANA timezone, falling back cleanly to Africa/Tunis.
 */
export function resolveAgencyTimeZone(timeZone?: string | null): string {
  const candidate = timeZone?.trim();
  if (!candidate) {
    return DEFAULT_TIMEZONE;
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return candidate;
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Resolves today's calendar date (YYYY-MM-DD) in the specified agency timezone.
 */
export function getTodayIsoDateInTimeZone(
  timeZone?: string | null,
  now: Date = new Date()
): string {
  const resolvedTz = resolveAgencyTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: resolvedTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) {
    return now.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Exact signed calendar day difference: targetIsoDate - referenceIsoDate.
 */
export function diffCalendarDays(
  referenceIsoDate: string,
  targetIsoDate: string
): number {
  return Math.round(
    (isoDateToUtcDayMs(targetIsoDate) - isoDateToUtcDayMs(referenceIsoDate)) /
      MS_PER_DAY
  );
}

export function normalizeWarningThresholdDays(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_COMPLIANCE_WARNING_DAYS;
  }
  return Math.max(0, Math.min(365, Math.trunc(value)));
}

/**
 * Evaluates a single expiry date against today's agency calendar date.
 * - null / invalid -> 'not_provided'
 * - daysRemaining < 0 -> 'expired'
 * - 0 <= daysRemaining <= warningThresholdDays -> 'expiring_soon'
 * - daysRemaining > warningThresholdDays -> 'valid'
 */
export function evaluateExpiryDate(
  expiresOn: string | null | undefined,
  referenceIsoDate: string,
  warningThresholdDays: number = DEFAULT_COMPLIANCE_WARNING_DAYS
): { status: ComplianceStatus; daysRemaining: number | null } {
  if (!expiresOn || !isValidIsoCalendarDate(expiresOn)) {
    return { status: 'not_provided', daysRemaining: null };
  }

  const threshold = normalizeWarningThresholdDays(warningThresholdDays);
  const daysRemaining = diffCalendarDays(referenceIsoDate, expiresOn);

  if (daysRemaining < 0) {
    return { status: 'expired', daysRemaining };
  }
  if (daysRemaining <= threshold) {
    return { status: 'expiring_soon', daysRemaining };
  }
  return { status: 'valid', daysRemaining };
}

/**
 * Evaluates all three compliance expiry dates for a single vehicle.
 */
export function evaluateVehicleCompliance(
  vehicle: VehicleComplianceDates,
  options: ComplianceEvaluationOptions = {}
): VehicleComplianceEvaluation {
  const timeZone = resolveAgencyTimeZone(options.timeZone);
  const warningThresholdDays = normalizeWarningThresholdDays(
    options.warningThresholdDays
  );
  const referenceDate = getTodayIsoDateInTimeZone(timeZone, options.now);

  const keys: readonly ComplianceDocumentKey[] = [
    'insurance',
    'technical_inspection',
    'vignette',
  ];

  const items: ComplianceDocumentEvaluation[] = keys.map((key) => {
    const meta = COMPLIANCE_DOCUMENT_META[key];
    const expiresOn = vehicle[meta.field] ?? null;
    const { status, daysRemaining } = evaluateExpiryDate(
      expiresOn,
      referenceDate,
      warningThresholdDays
    );
    return {
      key,
      label: meta.label,
      shortLabel: meta.shortLabel,
      expiresOn,
      status,
      daysRemaining,
    };
  });

  let expiredCount = 0;
  let expiringSoonCount = 0;
  let validCount = 0;
  let notProvidedCount = 0;

  for (const item of items) {
    switch (item.status) {
      case 'expired':
        expiredCount += 1;
        break;
      case 'expiring_soon':
        expiringSoonCount += 1;
        break;
      case 'valid':
        validCount += 1;
        break;
      case 'not_provided':
        notProvidedCount += 1;
        break;
    }
  }

  let overallStatus: ComplianceStatus = 'not_provided';
  if (expiredCount > 0) {
    overallStatus = 'expired';
  } else if (expiringSoonCount > 0) {
    overallStatus = 'expiring_soon';
  } else if (validCount > 0) {
    overallStatus = 'valid';
  }

  // Pick the most urgent tracked document (smallest signed daysRemaining)
  const datedItems = items.filter(
    (item): item is ComplianceDocumentEvaluation & { daysRemaining: number } =>
      item.daysRemaining !== null
  );
  datedItems.sort((a, b) => a.daysRemaining - b.daysRemaining);
  const mostUrgentItem = datedItems[0] ?? null;

  return {
    overallStatus,
    referenceDate,
    timeZone,
    warningThresholdDays,
    items,
    expiredCount,
    expiringSoonCount,
    validCount,
    notProvidedCount,
    mostUrgentItem,
  };
}

/**
 * Computes fleet-wide compliance alert counts from real vehicle records.
 */
export function computeFleetComplianceSummary(
  vehicles: readonly VehicleComplianceDates[],
  options: ComplianceEvaluationOptions = {}
): FleetComplianceSummary {
  const timeZone = resolveAgencyTimeZone(options.timeZone);
  const warningThresholdDays = normalizeWarningThresholdDays(
    options.warningThresholdDays
  );
  const referenceDate = getTodayIsoDateInTimeZone(timeZone, options.now);

  let vehiclesWithExpiredCount = 0;
  let vehiclesWithExpiringSoonCount = 0;
  let vehiclesValidCount = 0;
  let vehiclesNotProvidedCount = 0;
  let expiredDocumentsCount = 0;
  let expiringSoonDocumentsCount = 0;

  for (const vehicle of vehicles) {
    const evalResult = evaluateVehicleCompliance(vehicle, {
      timeZone,
      warningThresholdDays,
      now: options.now,
    });

    expiredDocumentsCount += evalResult.expiredCount;
    expiringSoonDocumentsCount += evalResult.expiringSoonCount;

    if (evalResult.expiredCount > 0) {
      vehiclesWithExpiredCount += 1;
    }
    if (evalResult.expiringSoonCount > 0) {
      vehiclesWithExpiringSoonCount += 1;
    }
    if (evalResult.overallStatus === 'valid') {
      vehiclesValidCount += 1;
    } else if (evalResult.overallStatus === 'not_provided') {
      vehiclesNotProvidedCount += 1;
    }
  }

  return {
    referenceDate,
    timeZone,
    warningThresholdDays,
    vehiclesWithExpiredCount,
    vehiclesWithExpiringSoonCount,
    vehiclesValidCount,
    vehiclesNotProvidedCount,
    expiredDocumentsCount,
    expiringSoonDocumentsCount,
  };
}

/**
 * Formats an ISO YYYY-MM-DD date as DD/MM/YYYY for French agency display.
 */
export function formatIsoDateFr(isoDate: string | null): string {
  if (!isoDate || !isValidIsoCalendarDate(isoDate)) {
    return 'Non renseignée';
  }
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

/**
 * Formats relative remaining/overdue calendar days in clear French prose.
 */
export function formatComplianceRelativeDays(
  daysRemaining: number | null
): string {
  if (daysRemaining === null) {
    return 'Date non renseignée';
  }
  if (daysRemaining < 0) {
    const overdue = Math.abs(daysRemaining);
    return overdue === 1 ? 'Expiré depuis 1 jour' : `Expiré depuis ${overdue} jours`;
  }
  if (daysRemaining === 0) {
    return 'Expire aujourd’hui';
  }
  if (daysRemaining === 1) {
    return 'Expire demain';
  }
  return `Dans ${daysRemaining} jours`;
}
