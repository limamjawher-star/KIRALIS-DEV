import {
  DEFAULT_VEHICLE_FILTERS,
  type VehicleFilterState,
} from '@/lib/vehicles/types';

/**
 * Mobile filter changes are drafts until the person taps Apply.
 * Search and operational status live outside the sheet, so never overwrite
 * those fields with an older draft when applying sheet controls.
 */
export function applyMobileVehicleFilters(
  applied: VehicleFilterState,
  draft: VehicleFilterState
): VehicleFilterState {
  return {
    ...applied,
    compliance: draft.compliance,
    category: draft.category,
    transmission: draft.transmission,
    fuelType: draft.fuelType,
    sortBy: draft.sortBy,
  };
}

/** Reset only the controls presented in the mobile filter sheet. */
export function resetMobileVehicleFilters(
  draft: VehicleFilterState
): VehicleFilterState {
  return {
    ...draft,
    compliance: DEFAULT_VEHICLE_FILTERS.compliance,
    category: DEFAULT_VEHICLE_FILTERS.category,
    transmission: DEFAULT_VEHICLE_FILTERS.transmission,
    fuelType: DEFAULT_VEHICLE_FILTERS.fuelType,
    sortBy: DEFAULT_VEHICLE_FILTERS.sortBy,
  };
}
