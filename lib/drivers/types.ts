import type {
  AgencyRole,
  CustomerDriverRow,
  DriverVerificationStatus,
} from '@/lib/supabase/database.types';

export type { CustomerDriverRow, DriverVerificationStatus };

export type CustomerDriverRecord = CustomerDriverRow;

export const DRIVER_VERIFICATION_STATUSES: readonly DriverVerificationStatus[] =
  ['unverified', 'pending', 'verified', 'rejected'] as const;

export const DRIVER_VERIFICATION_STATUS_LABELS: Record<
  DriverVerificationStatus,
  string
> = {
  unverified: 'Non vérifié',
  pending: 'En attente de vérification',
  verified: 'Vérifié',
  rejected: 'Refusé',
};

/**
 * Common driving licence categories across Tunisia, Morocco, MENA, and Europe.
 * Used as guidance; jurisdiction-specific rules remain configurable per market.
 */
export const COMMON_LICENCE_CATEGORIES: readonly string[] = [
  'AM',
  'A1',
  'A2',
  'A',
  'B',
  'BE',
  'C1',
  'C1E',
  'C',
  'CE',
  'D1',
  'D1E',
  'D',
  'DE',
] as const;

export type CustomerDriverFieldName =
  | 'full_name'
  | 'licence_issuing_country'
  | 'licence_category'
  | 'licence_expires_on'
  | 'verification_status'
  | 'verification_notes'
  | 'is_active';

export const EDITABLE_CUSTOMER_DRIVER_FIELDS: readonly CustomerDriverFieldName[] =
  [
    'full_name',
    'licence_issuing_country',
    'licence_category',
    'licence_expires_on',
    'verification_status',
    'verification_notes',
    'is_active',
  ] as const;

/**
 * Matches migration 0007 RLS policies on public.customer_drivers:
 * only active Owners and Managers can create or update authorized driver records.
 */
export function canManageCustomerDrivers(role: AgencyRole): boolean {
  return role === 'owner' || role === 'manager';
}

/**
 * Matches migration 0007 RLS policies on public.customer_drivers:
 * active Owners, Managers, and Agents can read authorized driver metadata.
 */
export function canReadCustomerDrivers(role: AgencyRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'agent';
}

export type DriverLicenceExpiryStatus =
  | 'missing'
  | 'expired'
  | 'expiring_soon'
  | 'valid_for_window';

export type DriverEligibilityFlagCode =
  | 'driver_inactive'
  | 'licence_expiry_missing'
  | 'licence_expired'
  | 'licence_expires_during_rental'
  | 'licence_expiring_soon'
  | 'verification_unverified'
  | 'verification_pending'
  | 'verification_rejected'
  | 'licence_category_missing'
  | 'licence_category_mismatch'
  | 'issuing_country_missing'
  | 'foreign_licence_manual_check';

export type DriverEligibilitySeverity = 'blocking' | 'warning' | 'info';

export interface DriverEligibilityFlag {
  code: DriverEligibilityFlagCode;
  severity: DriverEligibilitySeverity;
  message: string;
}

/**
 * Operational pre-check outcome.
 * Intentionally NEVER declares a driver "legally eligible": legal compliance
 * remains subject to country-specific rules and physical/manual verification.
 */
export type DriverEligibilityPrecheckStatus =
  | 'blocked'
  | 'attention_required'
  | 'checks_passed_manual_review_required';

export interface DriverEligibilityRuleSet {
  /** Identifier for auditing/configuring market-specific rule profiles (e.g. 'TN_DEFAULT'). */
  id: string;
  /** 2-letter ISO country code where the rental takes place (e.g. 'TN', 'MA', 'FR'). */
  jurisdictionCode: string;
  /** Calendar days inclusive before expiry that trigger an approaching-expiry warning. */
  warningThresholdDays: number;
  /**
   * Maps a required vehicle licence category (e.g. 'B') to licence categories that
   * are typically accepted in this jurisdiction. Categories outside this mapping
   * trigger a potential mismatch warning rather than an automated legal ruling.
   */
  categoryEquivalences: Readonly<Record<string, readonly string[]>>;
  /** When true, licences issued outside jurisdictionCode add an informational check flag. */
  flagForeignIssuingCountry: boolean;
}

export interface DriverEligibilityInput {
  licence_issuing_country: string | null;
  licence_category: string | null;
  licence_expires_on: string | null;
  verification_status: DriverVerificationStatus;
  is_active?: boolean;
}

export interface DriverEligibilityOptions {
  /** IANA timezone of the active agency (defaults to Africa/Tunis). */
  timeZone?: string | null;
  /** Optional deterministic reference timestamp for testing. */
  now?: Date;
  /** Optional configurable jurisdiction rule set (defaults to Tunisia profile). */
  ruleSet?: DriverEligibilityRuleSet;
  /** Optional override for expiring-soon threshold days. */
  warningThresholdDays?: number;
  /** Optional required licence category for a target vehicle (e.g. 'B', 'C', 'D'). */
  requiredLicenceCategory?: string | null;
  /** Optional ISO YYYY-MM-DD rental end date to verify licence covers the full rental window. */
  rentalEndDate?: string | null;
}

export interface DriverEligibilityAssessment {
  status: DriverEligibilityPrecheckStatus;
  /** Always true: automated metadata checks never replace country-specific legal verification. */
  requiresCountrySpecificVerification: true;
  legalNotice: string;
  ruleSetId: string;
  jurisdictionCode: string;
  referenceDate: string;
  timeZone: string;
  warningThresholdDays: number;
  licenceExpiryStatus: DriverLicenceExpiryStatus;
  /** Signed calendar days from agency's "today" to licence_expires_on (negative if expired). */
  daysUntilExpiry: number | null;
  expiresBeforeRentalEnd: boolean;
  blockingCount: number;
  warningCount: number;
  infoCount: number;
  flags: readonly DriverEligibilityFlag[];
}

export interface CustomerDriversEligibilitySummary {
  totalDrivers: number;
  activeDrivers: number;
  checksPassedManualReviewCount: number;
  attentionRequiredCount: number;
  blockedCount: number;
  expiredLicenceCount: number;
  expiringSoonLicenceCount: number;
  missingExpiryCount: number;
}
