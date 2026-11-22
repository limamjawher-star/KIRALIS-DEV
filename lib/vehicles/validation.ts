import { parseTndToMillimes } from '@/lib/currency';
import {
  evaluateVehicleCompliance,
  isValidIsoCalendarDate,
  type ComplianceEvaluationOptions,
} from './compliance';
import { isMissingPricingColumnError } from './pricing';
import {
  VEHICLE_FUEL_VALUES,
  VEHICLE_STATUS_VALUES,
  VEHICLE_TRANSMISSION_VALUES,
  type ValidatedVehiclePayload,
  type VehicleFieldErrors,
  type VehicleFilterState,
  type VehicleFleetSummary,
  type VehicleFuelType,
  type VehicleRecord,
  type VehicleStatus,
  type VehicleTransmission,
} from './types';

export interface VehicleValidationResult {
  valid: boolean;
  errors: VehicleFieldErrors;
  data?: ValidatedVehiclePayload;
}

export interface VehicleStatusValidationResult {
  valid: boolean;
  error?: string;
  status?: VehicleStatus;
}

export interface MappedVehicleDbError {
  status: number;
  message: string;
  fieldErrors?: VehicleFieldErrors;
  missingComplianceColumns?: boolean;
  missingPricingColumns?: boolean;
}

const MAX_ODOMETER_KM = 5_000_000;
const MAX_MONEY_MINOR = 999_999_999_000; // 999,999,999.000 TND (safe JS integer & PG bigint)

function cleanText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : '';
}

export function normalizePlateNumber(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

export function isVehicleStatus(value: unknown): value is VehicleStatus {
  return (
    typeof value === 'string' &&
    (VEHICLE_STATUS_VALUES as readonly string[]).includes(value)
  );
}

export function isVehicleTransmission(
  value: unknown
): value is VehicleTransmission {
  return (
    typeof value === 'string' &&
    (VEHICLE_TRANSMISSION_VALUES as readonly string[]).includes(value)
  );
}

export function isVehicleFuelType(value: unknown): value is VehicleFuelType {
  return (
    typeof value === 'string' &&
    (VEHICLE_FUEL_VALUES as readonly string[]).includes(value)
  );
}

function parseStrictInteger(raw: unknown): number | null {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) ? raw : null;
  }
  if (typeof raw === 'string') {
    const cleaned = raw.trim().replace(/\s+/g, '');
    if (!/^-?\d+$/.test(cleaned)) {
      return null;
    }
    const parsed = Number(cleaned);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Parses money either from exact integer minor units (`*_minor`) or from a
 * decimal TND string (`*_tnd`) without floating-point drift.
 */
function parseMinorAmount(
  minorRaw: unknown,
  tndRaw: unknown,
  defaultZeroWhenEmpty: boolean
): number | null {
  if (minorRaw !== undefined && minorRaw !== null && minorRaw !== '') {
    const parsedInt = parseStrictInteger(minorRaw);
    if (parsedInt === null) {
      return null;
    }
    return parsedInt;
  }

  if (typeof tndRaw === 'string') {
    const trimmed = tndRaw.trim();
    if (!trimmed) {
      return defaultZeroWhenEmpty ? 0 : null;
    }
    return parseTndToMillimes(trimmed);
  }

  if (defaultZeroWhenEmpty && (tndRaw === undefined || tndRaw === null)) {
    return 0;
  }

  return null;
}

/**
 * Parses an optional nullable non-negative money field (weekly/monthly package).
 * Empty / null / undefined -> { ok: true, value: null }.
 */
function parseOptionalMinorAmount(
  minorRaw: unknown,
  tndRaw: unknown
): { ok: true; value: number | null } | { ok: false } {
  if (minorRaw !== undefined && minorRaw !== null && minorRaw !== '') {
    const parsedInt = parseStrictInteger(minorRaw);
    if (
      parsedInt === null ||
      parsedInt < 0 ||
      parsedInt > MAX_MONEY_MINOR
    ) {
      return { ok: false };
    }
    return { ok: true, value: parsedInt };
  }

  if (typeof tndRaw === 'string') {
    const trimmed = tndRaw.trim();
    if (!trimmed) {
      return { ok: true, value: null };
    }
    const parsed = parseTndToMillimes(trimmed);
    if (parsed === null || parsed < 0 || parsed > MAX_MONEY_MINOR) {
      return { ok: false };
    }
    return { ok: true, value: parsed };
  }

  if (tndRaw === undefined || tndRaw === null) {
    return { ok: true, value: null };
  }

  return { ok: false };
}

/**
 * Parses an optional YYYY-MM-DD PostgreSQL DATE field strictly.
 */
export function parseOptionalIsoDate(
  raw: unknown
): { ok: true; value: string | null } | { ok: false } {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== 'string') {
    return { ok: false };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }
  if (!isValidIsoCalendarDate(trimmed)) {
    return { ok: false };
  }
  return { ok: true, value: trimmed };
}

/**
 * Authoritative vehicle payload validator (used both on client forms and API routes).
 * Enforces every CHECK constraint defined on public.vehicles in migrations 0001 & 0004.
 */
export function validateVehiclePayload(
  raw: Record<string, unknown>
): VehicleValidationResult {
  const errors: VehicleFieldErrors = {};

  const plateRaw = cleanText(raw.plate_number);
  const plateNumber = normalizePlateNumber(plateRaw);
  if (!plateNumber) {
    errors.plate_number = 'Le numéro d’immatriculation est obligatoire.';
  } else if (plateNumber.length < 2 || plateNumber.length > 32) {
    errors.plate_number =
      'L’immatriculation doit contenir entre 2 et 32 caractères.';
  }

  const brand = cleanText(raw.brand);
  if (!brand) {
    errors.brand = 'La marque est obligatoire.';
  } else if (brand.length > 60) {
    errors.brand = 'La marque ne doit pas dépasser 60 caractères.';
  }

  const model = cleanText(raw.model);
  if (!model) {
    errors.model = 'Le modèle est obligatoire.';
  } else if (model.length > 60) {
    errors.model = 'Le modèle ne doit pas dépasser 60 caractères.';
  }

  const vinRaw = cleanText(raw.vin).toUpperCase();
  const vin = vinRaw ? vinRaw : null;
  if (vin && vin.length > 32) {
    errors.vin = 'Le numéro de châssis (VIN) ne doit pas dépasser 32 caractères.';
  }

  let modelYear: number | null = null;
  const rawYear = raw.model_year;
  if (rawYear !== undefined && rawYear !== null && String(rawYear).trim() !== '') {
    const parsedYear = parseStrictInteger(rawYear);
    if (parsedYear === null || parsedYear < 1980 || parsedYear > 2100) {
      errors.model_year = 'L’année doit être un entier compris entre 1980 et 2100.';
    } else {
      modelYear = parsedYear;
    }
  }

  const category = cleanText(raw.category).toLowerCase() || 'compact';
  if (category.length < 2 || category.length > 40) {
    errors.category = 'La catégorie doit contenir entre 2 et 40 caractères.';
  }

  const transmissionRaw = cleanText(raw.transmission) || 'manual';
  let transmission: VehicleTransmission = 'manual';
  if (!isVehicleTransmission(transmissionRaw)) {
    errors.transmission = 'Type de transmission invalide.';
  } else {
    transmission = transmissionRaw;
  }

  const fuelRaw = cleanText(raw.fuel_type) || 'petrol';
  let fuelType: VehicleFuelType = 'petrol';
  if (!isVehicleFuelType(fuelRaw)) {
    errors.fuel_type = 'Type de carburant invalide.';
  } else {
    fuelType = fuelRaw;
  }

  const seatsParsed = parseStrictInteger(
    raw.seats === undefined || raw.seats === '' ? 5 : raw.seats
  );
  if (seatsParsed === null || seatsParsed < 1 || seatsParsed > 20) {
    errors.seats = 'Le nombre de places doit être compris entre 1 et 20.';
  }

  const odometerParsed = parseStrictInteger(
    raw.odometer_km === undefined || raw.odometer_km === '' ? 0 : raw.odometer_km
  );
  if (
    odometerParsed === null ||
    odometerParsed < 0 ||
    odometerParsed > MAX_ODOMETER_KM
  ) {
    errors.odometer_km =
      'Le kilométrage doit être un entier positif ou nul (max 5 000 000 km).';
  }

  const dailyRateMinor = parseMinorAmount(
    raw.daily_rate_minor,
    raw.daily_rate_tnd,
    false
  );
  if (
    dailyRateMinor === null ||
    dailyRateMinor < 0 ||
    dailyRateMinor > MAX_MONEY_MINOR
  ) {
    errors.daily_rate_minor =
      'Indiquez un tarif journalier valide positif en TND (max 3 décimales).';
  }

  const weeklyRate = parseOptionalMinorAmount(
    raw.weekly_rate_minor,
    raw.weekly_rate_tnd
  );
  if (!weeklyRate.ok) {
    errors.weekly_rate_minor =
      'Indiquez un forfait 7 jours valide positif ou nul en TND (max 3 décimales).';
  }

  const monthlyRate = parseOptionalMinorAmount(
    raw.monthly_rate_minor,
    raw.monthly_rate_tnd
  );
  if (!monthlyRate.ok) {
    errors.monthly_rate_minor =
      'Indiquez un forfait 30 jours valide positif ou nul en TND (max 3 décimales).';
  }

  const depositMinor = parseMinorAmount(
    raw.deposit_minor,
    raw.deposit_tnd,
    true
  );
  if (
    depositMinor === null ||
    depositMinor < 0 ||
    depositMinor > MAX_MONEY_MINOR
  ) {
    errors.deposit_minor =
      'Indiquez une caution valide positive ou nulle en TND (max 3 décimales).';
  }

  const statusRaw = cleanText(raw.status) || 'available';
  let status: VehicleStatus = 'available';
  if (!isVehicleStatus(statusRaw)) {
    errors.status = 'Statut opérationnel invalide.';
  } else {
    status = statusRaw;
  }

  const notesRaw = cleanText(raw.notes);
  const notes = notesRaw ? notesRaw : null;
  if (notes && notes.length > 2000) {
    errors.notes = 'Les notes ne doivent pas dépasser 2 000 caractères.';
  }

  const insuranceDate = parseOptionalIsoDate(raw.insurance_expires_on);
  if (!insuranceDate.ok) {
    errors.insurance_expires_on =
      'Indiquez une date d’assurance valide au format AAAA-MM-JJ (1980–2100).';
  }

  const inspectionDate = parseOptionalIsoDate(
    raw.technical_inspection_expires_on
  );
  if (!inspectionDate.ok) {
    errors.technical_inspection_expires_on =
      'Indiquez une date de visite technique valide au format AAAA-MM-JJ (1980–2100).';
  }

  const vignetteDate = parseOptionalIsoDate(raw.vignette_expires_on);
  if (!vignetteDate.ok) {
    errors.vignette_expires_on =
      'Indiquez une date de vignette valide au format AAAA-MM-JJ (1980–2100).';
  }

  if (Object.keys(errors).length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: {},
    data: {
      plate_number: plateNumber,
      vin,
      brand,
      model,
      model_year: modelYear,
      category,
      transmission,
      fuel_type: fuelType,
      seats: seatsParsed!,
      odometer_km: odometerParsed!,
      daily_rate_minor: dailyRateMinor!,
      weekly_rate_minor: weeklyRate.ok ? weeklyRate.value : null,
      monthly_rate_minor: monthlyRate.ok ? monthlyRate.value : null,
      deposit_minor: depositMinor!,
      status,
      notes,
      insurance_expires_on: insuranceDate.ok ? insuranceDate.value : null,
      technical_inspection_expires_on: inspectionDate.ok
        ? inspectionDate.value
        : null,
      vignette_expires_on: vignetteDate.ok ? vignetteDate.value : null,
    },
  };
}

export function validateStatusOnlyPatch(
  raw: Record<string, unknown>
): VehicleStatusValidationResult {
  if (!isVehicleStatus(raw.status)) {
    return {
      valid: false,
      error: 'Statut opérationnel invalide.',
    };
  }
  return {
    valid: true,
    status: raw.status,
  };
}

/**
 * Detects when the optional Phase 5B.1 compliance columns have not yet been
 * installed on the live Supabase database (PostgreSQL 42703 / PostgREST PGRST204).
 */
export function isMissingComplianceColumnError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
} | null | undefined): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
  const mentionsComplianceColumn =
    combined.includes('insurance_expires_on') ||
    combined.includes('technical_inspection_expires_on') ||
    combined.includes('vignette_expires_on');

  return (
    mentionsComplianceColumn &&
    (code === '42703' ||
      code === 'PGRST204' ||
      combined.includes('does not exist') ||
      combined.includes('schema cache'))
  );
}

/**
 * Translates PostgreSQL / PostgREST errors from public.vehicles into safe French messages.
 */
export function mapVehicleDbError(error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}): MappedVehicleDbError {
  if (isMissingPricingColumnError(error)) {
    return {
      status: 503,
      missingPricingColumns: true,
      message:
        'Les colonnes de tarification avancée (forfait 7 jours et forfait 30 jours) ne sont pas encore installées dans Supabase. Appliquez la migration 202611210005_vehicle_advanced_pricing.sql puis réessayez.',
    };
  }

  if (isMissingComplianceColumnError(error)) {
    return {
      status: 503,
      missingComplianceColumns: true,
      message:
        'Les colonnes d’échéances (assurance, visite technique, vignette) ne sont pas encore installées dans Supabase. Appliquez la migration 202611210004_vehicle_compliance_dates.sql puis réessayez.',
    };
  }

  const code = error.code ?? '';
  const combined = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();

  if (
    code === '23505' ||
    combined.includes('idx_vehicles_agency_plate_unique') ||
    combined.includes('duplicate key')
  ) {
    return {
      status: 409,
      message:
        'Un véhicule portant cette immatriculation existe déjà dans votre agence.',
      fieldErrors: {
        plate_number: 'Cette immatriculation est déjà utilisée dans votre agence.',
      },
    };
  }

  if (
    code === '42501' ||
    combined.includes('row-level security') ||
    combined.includes('permission denied')
  ) {
    return {
      status: 403,
      message:
        'Accès refusé : seuls les propriétaires et gestionnaires peuvent créer ou modifier des véhicules.',
    };
  }

  if (code === '23514' || code === '22P02' || code === '22003' || code === '22007') {
    return {
      status: 400,
      message:
        'Certaines valeurs du véhicule ne respectent pas les contraintes de la base de données.',
    };
  }

  return {
    status: 500,
    message:
      'Impossible d’enregistrer le véhicule pour le moment. Veuillez réessayer.',
  };
}

/**
 * Deterministic client/server filtering and sorting over the active agency's vehicles.
 */
export function filterAndSortVehicles(
  vehicles: readonly VehicleRecord[],
  filters: VehicleFilterState,
  complianceOptions?: ComplianceEvaluationOptions
): VehicleRecord[] {
  const needle = filters.search.trim().toLowerCase();

  const filtered = vehicles.filter((vehicle) => {
    if (filters.status !== 'all' && vehicle.status !== filters.status) {
      return false;
    }

    if (filters.compliance !== 'all') {
      const compliance = evaluateVehicleCompliance(vehicle, complianceOptions);
      if (filters.compliance === 'expired' && compliance.expiredCount === 0) {
        return false;
      }
      if (
        filters.compliance === 'expiring_soon' &&
        compliance.expiringSoonCount === 0
      ) {
        return false;
      }
      if (
        filters.compliance === 'valid' &&
        compliance.overallStatus !== 'valid'
      ) {
        return false;
      }
      if (
        filters.compliance === 'not_provided' &&
        compliance.overallStatus !== 'not_provided'
      ) {
        return false;
      }
    }

    if (
      filters.category !== 'all' &&
      vehicle.category.toLowerCase() !== filters.category.toLowerCase()
    ) {
      return false;
    }

    if (
      filters.transmission !== 'all' &&
      vehicle.transmission !== filters.transmission
    ) {
      return false;
    }

    if (filters.fuelType !== 'all' && vehicle.fuel_type !== filters.fuelType) {
      return false;
    }

    if (needle) {
      const haystack = [
        vehicle.plate_number,
        vehicle.brand,
        vehicle.model,
        vehicle.vin ?? '',
        vehicle.category,
        vehicle.model_year !== null ? String(vehicle.model_year) : '',
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(needle)) {
        return false;
      }
    }

    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (filters.sortBy) {
      case 'oldest':
        return a.created_at.localeCompare(b.created_at);
      case 'rate_asc':
        return a.daily_rate_minor - b.daily_rate_minor || a.brand.localeCompare(b.brand);
      case 'rate_desc':
        return b.daily_rate_minor - a.daily_rate_minor || a.brand.localeCompare(b.brand);
      case 'mileage_asc':
        return a.odometer_km - b.odometer_km || a.brand.localeCompare(b.brand);
      case 'mileage_desc':
        return b.odometer_km - a.odometer_km || a.brand.localeCompare(b.brand);
      case 'brand_asc':
        return (
          a.brand.localeCompare(b.brand, 'fr', { sensitivity: 'base' }) ||
          a.model.localeCompare(b.model, 'fr', { sensitivity: 'base' })
        );
      case 'year_desc':
        return (b.model_year ?? 0) - (a.model_year ?? 0) || a.brand.localeCompare(b.brand);
      case 'newest':
      default:
        return b.created_at.localeCompare(a.created_at);
    }
  });

  return sorted;
}

/**
 * Computes exact fleet counters from real database records (never hardcoded).
 */
export function computeFleetSummary(
  vehicles: readonly VehicleRecord[]
): VehicleFleetSummary {
  let availableCount = 0;
  let rentedCount = 0;
  let maintenanceCount = 0;
  let retiredCount = 0;

  for (const v of vehicles) {
    switch (v.status) {
      case 'available':
        availableCount += 1;
        break;
      case 'rented':
        rentedCount += 1;
        break;
      case 'maintenance':
        maintenanceCount += 1;
        break;
      case 'retired':
        retiredCount += 1;
        break;
    }
  }

  return {
    totalCount: vehicles.length,
    availableCount,
    rentedCount,
    maintenanceCount,
    retiredCount,
  };
}
