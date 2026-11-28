import type { VehiclesCopy } from './i18n';
import type { VehicleCategoryPreset, VehicleRecord } from './types';

/**
 * CSV formula neutralization must run BEFORE quoting.
 * Leading whitespace cannot be trusted: spreadsheet applications may trim it
 * before interpreting =, +, -, or @ as a formula.
 */
const FORMULA_START = /^[\s\u200B-\u200D\uFEFF]*[=+@-]/u;

export function escapeFleetCsvCell(value: string | number | null | undefined): string {
  let text = value == null ? '' : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/** Export monetary values as machine-readable TND, preserving three decimals. */
export function fleetTndAmount(minor: number | null | undefined): string {
  if (minor == null) return '';
  if (!Number.isSafeInteger(minor) || minor < 0) return '';
  const dinars = Math.floor(minor / 1000);
  const millimes = String(minor % 1000).padStart(3, '0');
  return `${dinars}.${millimes}`;
}

function categoryName(category: string, copy: VehiclesCopy): string {
  const key = category.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(copy.categories, key)) {
    return copy.categories[key as VehicleCategoryPreset];
  }
  // Preserve a custom category exactly as entered, except CSV injection escaping.
  return category;
}

/**
 * Export ONLY the currently filtered agency fleet already authorized by RLS.
 * Do not include VIN, notes, agency IDs, audit fields, or customer information.
 */
export function buildFleetCsv(
  vehicles: readonly VehicleRecord[],
  copy: VehiclesCopy
): string {
  const headings = [
    copy.form.fieldPlate,
    copy.form.fieldBrand,
    copy.form.fieldModel,
    copy.form.fieldYear,
    copy.list.colStatus,
    copy.form.fieldCategory,
    copy.form.fieldTransmission,
    copy.form.fieldFuel,
    copy.form.fieldSeats,
    copy.form.fieldOdometer,
    copy.form.fieldDailyRate('TND'),
    copy.form.fieldWeeklyRate('TND'),
    copy.form.fieldMonthlyRate('TND'),
    copy.form.fieldDeposit('TND'),
    copy.form.fieldInsuranceExpiry,
    copy.form.fieldInspectionExpiry,
    copy.form.fieldVignetteExpiry,
  ];
  const records = vehicles.map((vehicle) => [
    vehicle.plate_number,
    vehicle.brand,
    vehicle.model,
    vehicle.model_year,
    copy.statuses[vehicle.status],
    categoryName(vehicle.category, copy),
    copy.transmissions[vehicle.transmission],
    copy.fuels[vehicle.fuel_type],
    vehicle.seats,
    vehicle.odometer_km,
    fleetTndAmount(vehicle.daily_rate_minor),
    fleetTndAmount(vehicle.weekly_rate_minor),
    fleetTndAmount(vehicle.monthly_rate_minor),
    fleetTndAmount(vehicle.deposit_minor),
    vehicle.insurance_expires_on,
    vehicle.technical_inspection_expires_on,
    vehicle.vignette_expires_on,
  ]);
  return '\uFEFF' + [headings, ...records]
    .map((cells) => cells.map(escapeFleetCsvCell).join(','))
    .join('\r\n') + '\r\n';
}
