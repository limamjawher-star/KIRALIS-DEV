import type { AgencyRole } from '@/lib/agency/types';

export type VehicleStatus = 'available' | 'rented' | 'maintenance' | 'retired';
export type VehicleTransmission = 'manual' | 'automatic';
export type VehicleFuelType =
  | 'petrol'
  | 'diesel'
  | 'hybrid'
  | 'electric'
  | 'lpg';

export type VehicleCategoryPreset =
  | 'economy'
  | 'compact'
  | 'sedan'
  | 'suv'
  | 'utility'
  | 'luxury'
  | 'minibus';

export type VehicleSortKey =
  | 'newest'
  | 'oldest'
  | 'rate_asc'
  | 'rate_desc'
  | 'mileage_asc'
  | 'mileage_desc'
  | 'brand_asc'
  | 'year_desc';

/**
 * Mirrors public.vehicles exactly from migration 0001.
 * Do not invent columns that do not exist in PostgreSQL.
 */
export interface VehicleRecord {
  id: string;
  agency_id: string;
  plate_number: string;
  vin: string | null;
  brand: string;
  model: string;
  model_year: number | null;
  category: string;
  transmission: VehicleTransmission;
  fuel_type: VehicleFuelType;
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

export interface VehicleFormValues {
  plate_number: string;
  vin: string;
  brand: string;
  model: string;
  model_year: string;
  category: string;
  transmission: VehicleTransmission;
  fuel_type: VehicleFuelType;
  seats: string;
  odometer_km: string;
  daily_rate_tnd: string;
  weekly_rate_tnd: string;
  monthly_rate_tnd: string;
  deposit_tnd: string;
  status: VehicleStatus;
  notes: string;
  insurance_expires_on: string;
  technical_inspection_expires_on: string;
  vignette_expires_on: string;
}

export type VehicleFieldName =
  | 'plate_number'
  | 'vin'
  | 'brand'
  | 'model'
  | 'model_year'
  | 'category'
  | 'transmission'
  | 'fuel_type'
  | 'seats'
  | 'odometer_km'
  | 'daily_rate_minor'
  | 'weekly_rate_minor'
  | 'monthly_rate_minor'
  | 'deposit_minor'
  | 'status'
  | 'notes'
  | 'insurance_expires_on'
  | 'technical_inspection_expires_on'
  | 'vignette_expires_on';

export type VehicleFieldErrors = Partial<Record<VehicleFieldName, string>>;

export interface ValidatedVehiclePayload {
  plate_number: string;
  vin: string | null;
  brand: string;
  model: string;
  model_year: number | null;
  category: string;
  transmission: VehicleTransmission;
  fuel_type: VehicleFuelType;
  seats: number;
  odometer_km: number;
  daily_rate_minor: number;
  weekly_rate_minor: number | null;
  monthly_rate_minor: number | null;
  deposit_minor: number;
  status: VehicleStatus;
  notes: string | null;
  insurance_expires_on: string | null;
  technical_inspection_expires_on: string | null;
  vignette_expires_on: string | null;
}

export type VehicleComplianceFilter =
  | 'all'
  | 'expired'
  | 'expiring_soon'
  | 'valid'
  | 'not_provided';

export interface VehicleFilterState {
  search: string;
  status: 'all' | VehicleStatus;
  compliance: VehicleComplianceFilter;
  category: 'all' | string;
  transmission: 'all' | VehicleTransmission;
  fuelType: 'all' | VehicleFuelType;
  sortBy: VehicleSortKey;
}

export interface VehicleFleetSummary {
  totalCount: number;
  availableCount: number;
  rentedCount: number;
  maintenanceCount: number;
  retiredCount: number;
}

export const VEHICLE_STATUS_VALUES: readonly VehicleStatus[] = [
  'available',
  'rented',
  'maintenance',
  'retired',
] as const;

export const VEHICLE_TRANSMISSION_VALUES: readonly VehicleTransmission[] = [
  'manual',
  'automatic',
] as const;

export const VEHICLE_FUEL_VALUES: readonly VehicleFuelType[] = [
  'petrol',
  'diesel',
  'hybrid',
  'electric',
  'lpg',
] as const;

export const VEHICLE_CATEGORY_OPTIONS: readonly {
  value: VehicleCategoryPreset;
  label: string;
}[] = [
  { value: 'economy', label: 'Économique' },
  { value: 'compact', label: 'Compacte' },
  { value: 'sedan', label: 'Berline' },
  { value: 'suv', label: 'SUV / 4x4' },
  { value: 'utility', label: 'Utilitaire' },
  { value: 'luxury', label: 'Luxe' },
  { value: 'minibus', label: 'Minibus' },
] as const;

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Disponible',
  rented: 'En location',
  maintenance: 'Maintenance',
  retired: 'Retiré',
};

export const VEHICLE_TRANSMISSION_LABELS: Record<VehicleTransmission, string> = {
  manual: 'Manuelle',
  automatic: 'Automatique',
};

export const VEHICLE_FUEL_LABELS: Record<VehicleFuelType, string> = {
  petrol: 'Essence',
  diesel: 'Diesel',
  hybrid: 'Hybride',
  electric: 'Électrique',
  lpg: 'GPL',
};

export const VEHICLE_SORT_OPTIONS: readonly {
  value: VehicleSortKey;
  label: string;
}[] = [
  { value: 'newest', label: 'Ajoutés récemment' },
  { value: 'oldest', label: 'Plus anciens' },
  { value: 'rate_asc', label: 'Tarif croissant' },
  { value: 'rate_desc', label: 'Tarif décroissant' },
  { value: 'mileage_asc', label: 'Kilométrage croissant' },
  { value: 'mileage_desc', label: 'Kilométrage décroissant' },
  { value: 'brand_asc', label: 'Marque (A–Z)' },
  { value: 'year_desc', label: 'Année (récent)' },
] as const;

export const DEFAULT_VEHICLE_FILTERS: VehicleFilterState = {
  search: '',
  status: 'all',
  compliance: 'all',
  category: 'all',
  transmission: 'all',
  fuelType: 'all',
  sortBy: 'newest',
};

/**
 * Only active agency Owners and Managers may create or edit vehicles.
 * Agents have read-only inventory access (enforced on server + PostgreSQL RLS).
 */
export function canManageVehicles(role: AgencyRole | null | undefined): boolean {
  return role === 'owner' || role === 'manager';
}

export function getVehicleCategoryLabel(category: string): string {
  const normalized = category.trim().toLowerCase();
  const preset = VEHICLE_CATEGORY_OPTIONS.find((opt) => opt.value === normalized);
  if (preset) {
    return preset.label;
  }
  return category.trim() || 'Compacte';
}

/**
 * Converts integer millimes to an editable decimal TND string (3 decimals, French comma).
 */
export function formatMinorToEditableTnd(minor: number): string {
  if (!Number.isFinite(minor) || minor < 0) {
    return '0,000';
  }
  const intMinor = Math.trunc(minor);
  const whole = Math.floor(intMinor / 1000);
  const frac = String(intMinor % 1000).padStart(3, '0');
  return `${whole},${frac}`;
}

export function createEmptyVehicleFormValues(): VehicleFormValues {
  return {
    plate_number: '',
    vin: '',
    brand: '',
    model: '',
    model_year: String(new Date().getFullYear()),
    category: 'compact',
    transmission: 'manual',
    fuel_type: 'petrol',
    seats: '5',
    odometer_km: '0',
    daily_rate_tnd: '',
    weekly_rate_tnd: '',
    monthly_rate_tnd: '',
    deposit_tnd: '0,000',
    status: 'available',
    notes: '',
    insurance_expires_on: '',
    technical_inspection_expires_on: '',
    vignette_expires_on: '',
  };
}

export function vehicleRecordToFormValues(
  vehicle: VehicleRecord
): VehicleFormValues {
  return {
    plate_number: vehicle.plate_number,
    vin: vehicle.vin ?? '',
    brand: vehicle.brand,
    model: vehicle.model,
    model_year: vehicle.model_year !== null ? String(vehicle.model_year) : '',
    category: vehicle.category,
    transmission: vehicle.transmission,
    fuel_type: vehicle.fuel_type,
    seats: String(vehicle.seats),
    odometer_km: String(vehicle.odometer_km),
    daily_rate_tnd: formatMinorToEditableTnd(vehicle.daily_rate_minor),
    weekly_rate_tnd:
      vehicle.weekly_rate_minor !== null
        ? formatMinorToEditableTnd(vehicle.weekly_rate_minor)
        : '',
    monthly_rate_tnd:
      vehicle.monthly_rate_minor !== null
        ? formatMinorToEditableTnd(vehicle.monthly_rate_minor)
        : '',
    deposit_tnd: formatMinorToEditableTnd(vehicle.deposit_minor),
    status: vehicle.status,
    notes: vehicle.notes ?? '',
    insurance_expires_on: vehicle.insurance_expires_on ?? '',
    technical_inspection_expires_on:
      vehicle.technical_inspection_expires_on ?? '',
    vignette_expires_on: vehicle.vignette_expires_on ?? '',
  };
}
