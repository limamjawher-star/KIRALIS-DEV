export type AgencyRole = 'owner' | 'manager' | 'agent';

export type MembershipStatus = 'active' | 'invited' | 'suspended';

export interface AgencyRecord {
  id: string;
  name: string;
  legal_name: string | null;
  slug: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  address: string | null;
  country_code: string;
  currency_code: string;
  currency_minor_unit: number;
  timezone: string;
  default_locale: 'fr' | 'en' | 'ar';
  vat_rate_bps: number;
  created_at: string;
  updated_at: string;
}

export interface AgencyMembershipWithAgency {
  id: string;
  agency_id: string;
  role: AgencyRole;
  status: MembershipStatus;
  created_at: string;
  agency: AgencyRecord;
}

export interface AgencySummary {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  countryCode: string;
  role: AgencyRole;
}

export interface AgencyDashboardStats {
  vehicleCount: number;
  customerCount: number;
  reservationCount: number;
  activeRentalCount: number;
}

export const ACTIVE_AGENCY_COOKIE_NAME = 'kiralis_active_agency_id';

export const SUPPORTED_COUNTRIES = [
  { code: 'TN', labelFr: 'Tunisie', labelEn: 'Tunisia', labelAr: 'تونس' },
  { code: 'MA', labelFr: 'Maroc', labelEn: 'Morocco', labelAr: 'المغرب' },
  { code: 'DZ', labelFr: 'Algérie', labelEn: 'Algeria', labelAr: 'الجزائر' },
  { code: 'FR', labelFr: 'France', labelEn: 'France', labelAr: 'فرنسا' },
  { code: 'AE', labelFr: 'Émirats arabes unis', labelEn: 'United Arab Emirates', labelAr: 'الإمارات العربية المتحدة' },
  { code: 'SA', labelFr: 'Arabie saoudite', labelEn: 'Saudi Arabia', labelAr: 'المملكة العربية السعودية' },
] as const;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value.trim());
}

/**
 * Pure active agency resolver.
 * Security invariant: NEVER trusts a client-supplied or cookie-supplied agency ID
 * unless it matches one of the caller's verified active memberships.
 */
export function resolveSelectedMembership(
  memberships: readonly AgencyMembershipWithAgency[],
  requestedAgencyId?: string | null
): AgencyMembershipWithAgency | null {
  const activeMemberships = memberships.filter(
    (entry) => entry.status === 'active' && Boolean(entry.agency?.id)
  );

  if (activeMemberships.length === 0) {
    return null;
  }

  if (activeMemberships.length === 1) {
    return activeMemberships[0];
  }

  if (requestedAgencyId && isValidUuid(requestedAgencyId)) {
    const matched = activeMemberships.find(
      (entry) => entry.agency_id === requestedAgencyId
    );
    if (matched) {
      return matched;
    }
  }

  return activeMemberships[0];
}

export function toAgencySummary(
  membership: AgencyMembershipWithAgency
): AgencySummary {
  return {
    id: membership.agency.id,
    name: membership.agency.name,
    slug: membership.agency.slug,
    city: membership.agency.city,
    countryCode: membership.agency.country_code,
    role: membership.role,
  };
}

export function formatAgencyRoleLabel(
  role: AgencyRole,
  locale: 'fr' | 'en' | 'ar' = 'fr'
): string {
  const labels: Record<'fr' | 'en' | 'ar', Record<AgencyRole, string>> = {
    fr: {
      owner: 'Propriétaire',
      manager: 'Gestionnaire',
      agent: 'Agent',
    },
    en: {
      owner: 'Owner',
      manager: 'Manager',
      agent: 'Agent',
    },
    ar: {
      owner: 'المالك',
      manager: 'المدير',
      agent: 'عون',
    },
  };

  return labels[locale][role];
}

export function formatCountryLabel(
  countryCode: string,
  locale: 'fr' | 'en' | 'ar' = 'fr'
): string {
  const normalized = countryCode.trim().toUpperCase();
  const match = SUPPORTED_COUNTRIES.find((c) => c.code === normalized);
  if (!match) {
    return normalized;
  }
  if (locale === 'en') return match.labelEn;
  if (locale === 'ar') return match.labelAr;
  return match.labelFr;
}

export function formatVatRateFromBps(
  vatRateBps: number,
  locale: 'fr' | 'en' | 'ar' = 'fr'
): string {
  const percent = vatRateBps / 100;
  const numberLocale =
    locale === 'en' ? 'en-US' : locale === 'ar' ? 'ar-TN' : 'fr-TN';
  const formatted = new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: Number.isInteger(percent) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(percent);
  return `${formatted} %`;
}

export function isOnboardingPath(pathname: string): boolean {
  const normalized = pathname.trim() || '/';
  return normalized === '/onboarding' || normalized.startsWith('/onboarding/');
}
