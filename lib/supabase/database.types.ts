/**
 * TypeScript contract matching the KIRALIS Phase 3 Supabase PostgreSQL schema.
 * Money values are stored as integer minor units (e.g. millimes for TND: 1.000 TND = 1000).
 */

export type AgencyRole = 'owner' | 'manager' | 'agent';
export type MembershipStatus = 'active' | 'invited' | 'suspended';
export type VehicleStatus = 'available' | 'rented' | 'maintenance' | 'retired';
export type CustomerType = 'individual' | 'corporate';
export type DriverVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected';
export type ReservationStatus =
  | 'draft'
  | 'pending'
  | 'confirmed'
  | 'active'
  | 'completed'
  | 'cancelled';

export interface AgencyRow {
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
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgencyMembershipRow {
  id: string;
  agency_id: string;
  user_id: string;
  role: AgencyRole;
  status: MembershipStatus;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleRow {
  id: string;
  agency_id: string;
  plate_number: string;
  vin: string | null;
  brand: string;
  model: string;
  model_year: number | null;
  category: string;
  transmission: 'manual' | 'automatic';
  fuel_type: 'petrol' | 'diesel' | 'hybrid' | 'electric' | 'lpg';
  seats: number;
  odometer_km: number;
  daily_rate_minor: number;
  weekly_rate_minor: number | null;
  monthly_rate_minor: number | null;
  deposit_minor: number;
  currency_code: string;
  status: VehicleStatus;
  notes: string | null;
  insurance_expires_on: string | null;
  technical_inspection_expires_on: string | null;
  vignette_expires_on: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface VehicleSeasonalRateRow {
  id: string;
  agency_id: string;
  vehicle_id: string;
  label: string | null;
  start_date: string;
  end_date: string;
  daily_rate_minor: number;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerRow {
  id: string;
  agency_id: string;
  customer_type: CustomerType;
  full_name: string;
  company_name: string | null;
  email: string | null;
  phone: string;
  address: string | null;
  city: string | null;
  country_code: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerDriverRow {
  id: string;
  agency_id: string;
  customer_id: string;
  full_name: string;
  licence_issuing_country: string | null;
  licence_category: string | null;
  licence_expires_on: string | null;
  verification_status: DriverVerificationStatus;
  verification_notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReservationRow {
  id: string;
  agency_id: string;
  reference_code: string;
  vehicle_id: string;
  customer_id: string;
  status: ReservationStatus;
  pickup_at: string;
  return_at: string;
  pickup_location: string | null;
  return_location: string | null;
  currency_code: string;
  daily_rate_minor: number;
  subtotal_minor: number;
  tax_minor: number;
  discount_minor: number;
  total_minor: number;
  deposit_minor: number;
  notes: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogRow {
  id: string;
  agency_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateAgencyRpcArgs {
  p_name: string;
  p_slug: string;
  p_legal_name?: string | null;
  p_tax_id?: string | null;
  p_email?: string | null;
  p_phone?: string | null;
  p_city?: string | null;
  p_address?: string | null;
  p_country_code?: string;
  p_currency_code?: string;
  p_currency_minor_unit?: number;
  p_timezone?: string;
  p_default_locale?: 'fr' | 'en' | 'ar';
  p_vat_rate_bps?: number;
}

export interface TransitionReservationStatusRpcArgs {
  p_reservation_id: string;
  p_next_status: ReservationStatus;
}

export interface UpdatePendingReservationTermsRpcArgs {
  p_reservation_id: string;
  p_vehicle_id?: string | null;
  p_customer_id?: string | null;
  p_pickup_at?: string | null;
  p_return_at?: string | null;
  p_daily_rate_minor?: number | null;
  p_subtotal_minor?: number | null;
  p_tax_minor?: number | null;
  p_discount_minor?: number | null;
  p_deposit_minor?: number | null;
  p_currency_code?: string | null;
}
