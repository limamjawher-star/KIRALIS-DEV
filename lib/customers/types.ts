import type { AgencyRole, CustomerRow, CustomerType } from '@/lib/supabase/database.types';

export type { CustomerRow, CustomerType };

export type CustomerRecord = CustomerRow;

export const CUSTOMER_TYPE_VALUES: readonly CustomerType[] = [
  'individual',
  'corporate',
] as const;

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  individual: 'Particulier',
  corporate: 'Entreprise',
};

export interface CustomerCountryOption {
  code: string;
  label: string;
}

export const DEFAULT_CUSTOMER_COUNTRY_CODE = 'TN';

export const CUSTOMER_COUNTRY_OPTIONS: readonly CustomerCountryOption[] = [
  { code: 'TN', label: 'Tunisie (TN)' },
  { code: 'MA', label: 'Maroc (MA)' },
  { code: 'DZ', label: 'Algérie (DZ)' },
  { code: 'LY', label: 'Libye (LY)' },
  { code: 'FR', label: 'France (FR)' },
  { code: 'IT', label: 'Italie (IT)' },
  { code: 'DE', label: 'Allemagne (DE)' },
  { code: 'ES', label: 'Espagne (ES)' },
  { code: 'BE', label: 'Belgique (BE)' },
  { code: 'CH', label: 'Suisse (CH)' },
  { code: 'GB', label: 'Royaume-Uni (GB)' },
  { code: 'AE', label: 'Émirats arabes unis (AE)' },
  { code: 'SA', label: 'Arabie saoudite (SA)' },
  { code: 'QA', label: 'Qatar (QA)' },
  { code: 'CA', label: 'Canada (CA)' },
  { code: 'US', label: 'États-Unis (US)' },
] as const;

export function getCustomerCountryLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  const match = CUSTOMER_COUNTRY_OPTIONS.find((item) => item.code === normalized);
  return match ? match.label : normalized || DEFAULT_CUSTOMER_COUNTRY_CODE;
}

export type CustomerSortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc';

export const CUSTOMER_SORT_OPTIONS: readonly {
  value: CustomerSortKey;
  label: string;
}[] = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'oldest', label: 'Plus anciens' },
  { value: 'name_asc', label: 'Nom (A → Z)' },
  { value: 'name_desc', label: 'Nom (Z → A)' },
] as const;

export interface CustomerFilterState {
  search: string;
  customerType: 'all' | CustomerType;
  sortBy: CustomerSortKey;
}

export const DEFAULT_CUSTOMER_FILTERS: CustomerFilterState = {
  search: '',
  customerType: 'all',
  sortBy: 'newest',
};

export interface CustomerFormValues {
  customer_type: CustomerType;
  full_name: string;
  company_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country_code: string;
  notes: string;
}

export type CustomerFieldName =
  | 'customer_type'
  | 'full_name'
  | 'company_name'
  | 'email'
  | 'phone'
  | 'address'
  | 'city'
  | 'country_code'
  | 'notes';

export const EDITABLE_CUSTOMER_FIELDS: readonly CustomerFieldName[] = [
  'customer_type',
  'full_name',
  'company_name',
  'email',
  'phone',
  'address',
  'city',
  'country_code',
  'notes',
] as const;

export type CustomerFieldErrors = Partial<Record<CustomerFieldName, string>>;

export interface ValidatedCustomerPayload {
  customer_type: CustomerType;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  country_code: string;
  notes: string | null;
}

export type ValidatedCustomerPatchPayload = Partial<ValidatedCustomerPayload>;

/**
 * Matches the existing PostgreSQL RLS policies on public.customers:
 * active Owners, Managers, and Agents can read, create, and edit customers
 * within their verified active agency.
 */
export function canManageCustomers(role: AgencyRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'agent';
}

export function createEmptyCustomerFormValues(
  defaultCountryCode: string = DEFAULT_CUSTOMER_COUNTRY_CODE
): CustomerFormValues {
  const normalizedCountry = /^[A-Z]{2}$/.test(defaultCountryCode.trim().toUpperCase())
    ? defaultCountryCode.trim().toUpperCase()
    : DEFAULT_CUSTOMER_COUNTRY_CODE;

  return {
    customer_type: 'individual',
    full_name: '',
    company_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country_code: normalizedCountry,
    notes: '',
  };
}

export function customerRecordToFormValues(
  customer: CustomerRecord
): CustomerFormValues {
  return {
    customer_type: customer.customer_type,
    full_name: customer.full_name,
    company_name: customer.company_name ?? '',
    email: customer.email ?? '',
    phone: customer.phone,
    address: customer.address ?? '',
    city: customer.city ?? '',
    country_code: customer.country_code || DEFAULT_CUSTOMER_COUNTRY_CODE,
    notes: customer.notes ?? '',
  };
}
