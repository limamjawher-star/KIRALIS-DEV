'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
  TEXTAREA_BASE_CLASSES,
} from '@/components/ui/form-field';
import { formatTndFromMillimes, parseTndToMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  getVehiclesCopy,
  localizeVehicleFieldErrors,
} from '@/lib/vehicles/i18n';
import {
  createEmptyVehicleFormValues,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_FUEL_VALUES,
  VEHICLE_STATUS_VALUES,
  VEHICLE_TRANSMISSION_VALUES,
  vehicleRecordToFormValues,
  type VehicleCategoryPreset,
  type VehicleFieldErrors,
  type VehicleFormValues,
  type VehicleFuelType,
  type VehicleRecord,
  type VehicleStatus,
  type VehicleTransmission,
} from '@/lib/vehicles/types';
import { validateVehiclePayload } from '@/lib/vehicles/validation';

export interface VehicleFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  vehicle: VehicleRecord | null;
  currencyCode: string;
  complianceSchemaReady: boolean;
  pricingSchemaReady: boolean;
  onClose: () => void;
  onSaved: (vehicle: VehicleRecord, mode: 'create' | 'edit') => void;
}

export function VehicleFormModal({
  open,
  mode,
  vehicle,
  currencyCode,
  complianceSchemaReady,
  pricingSchemaReady,
  onClose,
  onSaved,
}: VehicleFormModalProps) {
  const { locale } = useAppPreferences();
  const copy = getVehiclesCopy(locale);

  const [values, setValues] = useState<VehicleFormValues>(() =>
    mode === 'edit' && vehicle
      ? vehicleRecordToFormValues(vehicle)
      : createEmptyVehicleFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, submitting, onClose]);

  function updateField<K extends keyof VehicleFormValues>(
    field: K,
    value: VehicleFormValues[K],
    errorKey?: keyof VehicleFieldErrors
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    const errField = errorKey ?? (field as keyof VehicleFieldErrors);
    if (fieldErrors[errField]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errField];
        return next;
      });
    }
    if (formError) {
      setFormError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const candidatePayload: Record<string, unknown> = {
      plate_number: values.plate_number,
      vin: values.vin,
      brand: values.brand,
      model: values.model,
      model_year: values.model_year,
      category: values.category,
      transmission: values.transmission,
      fuel_type: values.fuel_type,
      seats: values.seats,
      odometer_km: values.odometer_km,
      daily_rate_tnd: values.daily_rate_tnd,
      weekly_rate_tnd: pricingSchemaReady ? values.weekly_rate_tnd : '',
      monthly_rate_tnd: pricingSchemaReady ? values.monthly_rate_tnd : '',
      deposit_tnd: values.deposit_tnd,
      status: values.status,
      notes: values.notes,
      insurance_expires_on: values.insurance_expires_on,
      technical_inspection_expires_on: values.technical_inspection_expires_on,
      vignette_expires_on: values.vignette_expires_on,
    };

    const validation = validateVehiclePayload(candidatePayload);
    if (!validation.valid || !validation.data) {
      setFieldErrors(localizeVehicleFieldErrors(validation.errors, locale));
      setFormError(copy.form.fixFieldsError);
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const endpoint =
        mode === 'edit' && vehicle
          ? `/api/vehicles/${vehicle.id}`
          : '/api/vehicles';
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        vehicle?: VehicleRecord;
        error?: string;
        fieldErrors?: VehicleFieldErrors;
      } | null;

      if (!response.ok || !payload?.ok || !payload.vehicle) {
        if (payload?.fieldErrors) {
          setFieldErrors(
            localizeVehicleFieldErrors(payload.fieldErrors, locale)
          );
        }
        setFormError(payload?.error ?? copy.form.saveErrorFallback);
        setSubmitting(false);
        return;
      }

      onSaved(payload.vehicle, mode);
    } catch {
      setFormError(copy.form.networkError);
      setSubmitting(false);
    }
  }

  const parsedDailyRate = parseTndToMillimes(values.daily_rate_tnd);
  const parsedWeeklyRate = values.weekly_rate_tnd.trim()
    ? parseTndToMillimes(values.weekly_rate_tnd)
    : null;
  const parsedMonthlyRate = values.monthly_rate_tnd.trim()
    ? parseTndToMillimes(values.monthly_rate_tnd)
    : null;
  const parsedDeposit = parseTndToMillimes(values.deposit_tnd || '0');
  const titleId =
    mode === 'edit' ? 'edit-vehicle-modal-title' : 'create-vehicle-modal-title';

  const hasCustomCategory =
    values.category.trim() !== '' &&
    !VEHICLE_CATEGORY_OPTIONS.some(
      (opt) => opt.value === values.category.trim().toLowerCase()
    );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="vehicle-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Mobile bottom-sheet grabber */}
            <div
              className="flex justify-center bg-[#0B1220] pt-2.5 pb-1 sm:hidden"
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-slate-600" />
            </div>

            <div className="flex items-start justify-between gap-4 border-b border-slate-800 bg-[#0B1220] px-5 py-4 text-white sm:px-6">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-lg font-bold tracking-tight text-white"
                >
                  {mode === 'edit'
                    ? copy.form.editTitle
                    : copy.form.createTitle}
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  {mode === 'edit' && vehicle ? (
                    <>
                      {vehicle.brand} {vehicle.model} ·{' '}
                      <span dir="ltr" className="inline-block font-mono">
                        {vehicle.plate_number}
                      </span>
                    </>
                  ) : (
                    copy.form.createSubtitle
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                aria-label={copy.form.closeAria}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              noValidate
              className="flex flex-1 flex-col overflow-hidden"
            >
              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                {formError ? (
                  <AlertBanner variant="error" compact>
                    {formError}
                  </AlertBanner>
                ) : null}

                {/* Section 1: Identification */}
                <fieldset className="space-y-4">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                    {copy.form.sectionIdentification}
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      id="vehicle-plate"
                      label={copy.form.fieldPlate}
                      required
                      helperText={copy.form.fieldPlateHelper}
                      errorText={fieldErrors.plate_number}
                    >
                      <input
                        id="vehicle-plate"
                        type="text"
                        dir="ltr"
                        required
                        maxLength={32}
                        value={values.plate_number}
                        onChange={(e) =>
                          updateField(
                            'plate_number',
                            e.target.value,
                            'plate_number'
                          )
                        }
                        placeholder="214 TU 4821"
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono uppercase',
                          getInputStateClasses(Boolean(fieldErrors.plate_number))
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-status"
                      label={copy.form.fieldStatus}
                      required
                      errorText={fieldErrors.status}
                    >
                      <select
                        id="vehicle-status"
                        value={values.status}
                        onChange={(e) =>
                          updateField(
                            'status',
                            e.target.value as VehicleStatus,
                            'status'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(Boolean(fieldErrors.status))
                        )}
                      >
                        {VEHICLE_STATUS_VALUES.map((statusValue) => (
                          <option key={statusValue} value={statusValue}>
                            {copy.statuses[statusValue]}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      id="vehicle-brand"
                      label={copy.form.fieldBrand}
                      required
                      errorText={fieldErrors.brand}
                    >
                      <input
                        id="vehicle-brand"
                        type="text"
                        required
                        maxLength={60}
                        value={values.brand}
                        onChange={(e) =>
                          updateField('brand', e.target.value, 'brand')
                        }
                        placeholder={copy.form.fieldBrandPlaceholder}
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(Boolean(fieldErrors.brand))
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-model"
                      label={copy.form.fieldModel}
                      required
                      errorText={fieldErrors.model}
                    >
                      <input
                        id="vehicle-model"
                        type="text"
                        required
                        maxLength={60}
                        value={values.model}
                        onChange={(e) =>
                          updateField('model', e.target.value, 'model')
                        }
                        placeholder={copy.form.fieldModelPlaceholder}
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(Boolean(fieldErrors.model))
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-year"
                      label={copy.form.fieldYear}
                      helperText={copy.form.fieldYearHelper}
                      errorText={fieldErrors.model_year}
                    >
                      <input
                        id="vehicle-year"
                        type="number"
                        dir="ltr"
                        inputMode="numeric"
                        min={1980}
                        max={2100}
                        value={values.model_year}
                        onChange={(e) =>
                          updateField(
                            'model_year',
                            e.target.value,
                            'model_year'
                          )
                        }
                        placeholder="2024"
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(Boolean(fieldErrors.model_year))
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-vin"
                      label={copy.form.fieldVin}
                      helperText={copy.form.fieldVinHelper}
                      errorText={fieldErrors.vin}
                    >
                      <input
                        id="vehicle-vin"
                        type="text"
                        dir="ltr"
                        maxLength={32}
                        value={values.vin}
                        onChange={(e) =>
                          updateField('vin', e.target.value, 'vin')
                        }
                        placeholder="VF3UBHMZ6JS..."
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono uppercase',
                          getInputStateClasses(Boolean(fieldErrors.vin))
                        )}
                      />
                    </FormField>
                  </div>
                </fieldset>

                {/* Section 2: Specifications */}
                <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
                  <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                    {copy.form.sectionSpecs}
                  </legend>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      id="vehicle-category"
                      label={copy.form.fieldCategory}
                      required
                      errorText={fieldErrors.category}
                    >
                      <select
                        id="vehicle-category"
                        value={values.category}
                        onChange={(e) =>
                          updateField('category', e.target.value, 'category')
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(Boolean(fieldErrors.category))
                        )}
                      >
                        {hasCustomCategory ? (
                          <option value={values.category}>
                            {values.category}
                          </option>
                        ) : null}
                        {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {copy.categories[option.value as VehicleCategoryPreset]}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      id="vehicle-transmission"
                      label={copy.form.fieldTransmission}
                      required
                      errorText={fieldErrors.transmission}
                    >
                      <select
                        id="vehicle-transmission"
                        value={values.transmission}
                        onChange={(e) =>
                          updateField(
                            'transmission',
                            e.target.value as VehicleTransmission,
                            'transmission'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(
                            Boolean(fieldErrors.transmission)
                          )
                        )}
                      >
                        {VEHICLE_TRANSMISSION_VALUES.map((tr) => (
                          <option key={tr} value={tr}>
                            {copy.transmissions[tr]}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      id="vehicle-fuel"
                      label={copy.form.fieldFuel}
                      required
                      errorText={fieldErrors.fuel_type}
                    >
                      <select
                        id="vehicle-fuel"
                        value={values.fuel_type}
                        onChange={(e) =>
                          updateField(
                            'fuel_type',
                            e.target.value as VehicleFuelType,
                            'fuel_type'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          getInputStateClasses(Boolean(fieldErrors.fuel_type))
                        )}
                      >
                        {VEHICLE_FUEL_VALUES.map((fuel) => (
                          <option key={fuel} value={fuel}>
                            {copy.fuels[fuel]}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField
                      id="vehicle-seats"
                      label={copy.form.fieldSeats}
                      required
                      errorText={fieldErrors.seats}
                    >
                      <input
                        id="vehicle-seats"
                        type="number"
                        dir="ltr"
                        inputMode="numeric"
                        min={1}
                        max={20}
                        required
                        value={values.seats}
                        onChange={(e) =>
                          updateField('seats', e.target.value, 'seats')
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(Boolean(fieldErrors.seats))
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-odometer"
                      label={copy.form.fieldOdometer}
                      required
                      className="sm:col-span-2"
                      errorText={fieldErrors.odometer_km}
                    >
                      <input
                        id="vehicle-odometer"
                        type="number"
                        dir="ltr"
                        inputMode="numeric"
                        min={0}
                        max={5000000}
                        required
                        value={values.odometer_km}
                        onChange={(e) =>
                          updateField(
                            'odometer_km',
                            e.target.value,
                            'odometer_km'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(Boolean(fieldErrors.odometer_km))
                        )}
                      />
                    </FormField>
                  </div>
                </fieldset>

                {/* Section 3: Pricing */}
                <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                      {copy.form.sectionPricing(currencyCode)}
                    </legend>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.form.seasonalManagedInDrawer}
                    </span>
                  </div>

                  {!pricingSchemaReady ? (
                    <AlertBanner variant="warning" compact>
                      {copy.migrations.formPricingPrefix}{' '}
                      <span dir="ltr" className="font-mono">
                        202611210005_vehicle_advanced_pricing.sql
                      </span>{' '}
                      {copy.migrations.formPricingSuffix}
                    </AlertBanner>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FormField
                      id="vehicle-daily-rate"
                      label={copy.form.fieldDailyRate(currencyCode)}
                      required
                      helperText={
                        parsedDailyRate !== null && parsedDailyRate >= 0
                          ? copy.form.recordedPreview(
                              formatTndFromMillimes(parsedDailyRate, locale)
                            )
                          : copy.form.fieldDailyRateHelper
                      }
                      errorText={fieldErrors.daily_rate_minor}
                    >
                      <input
                        id="vehicle-daily-rate"
                        type="text"
                        dir="ltr"
                        inputMode="decimal"
                        required
                        value={values.daily_rate_tnd}
                        onChange={(e) =>
                          updateField(
                            'daily_rate_tnd',
                            e.target.value,
                            'daily_rate_minor'
                          )
                        }
                        placeholder="110,000"
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.daily_rate_minor)
                          )
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-deposit"
                      label={copy.form.fieldDeposit(currencyCode)}
                      helperText={
                        parsedDeposit !== null && parsedDeposit >= 0
                          ? copy.form.recordedPreview(
                              formatTndFromMillimes(parsedDeposit, locale)
                            )
                          : copy.form.fieldDepositHelper
                      }
                      errorText={fieldErrors.deposit_minor}
                    >
                      <input
                        id="vehicle-deposit"
                        type="text"
                        dir="ltr"
                        inputMode="decimal"
                        value={values.deposit_tnd}
                        onChange={(e) =>
                          updateField(
                            'deposit_tnd',
                            e.target.value,
                            'deposit_minor'
                          )
                        }
                        placeholder="1000,000"
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.deposit_minor)
                          )
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-weekly-rate"
                      label={copy.form.fieldWeeklyRate(currencyCode)}
                      helperText={
                        !pricingSchemaReady
                          ? copy.migrations.availableAfterMigration0005
                          : parsedWeeklyRate !== null && parsedWeeklyRate >= 0
                            ? copy.form.recordedForDaysPreview(
                                formatTndFromMillimes(parsedWeeklyRate, locale),
                                7
                              )
                            : copy.form.fieldWeeklyRateHelper
                      }
                      errorText={fieldErrors.weekly_rate_minor}
                    >
                      <input
                        id="vehicle-weekly-rate"
                        type="text"
                        dir="ltr"
                        inputMode="decimal"
                        value={values.weekly_rate_tnd}
                        onChange={(e) =>
                          updateField(
                            'weekly_rate_tnd',
                            e.target.value,
                            'weekly_rate_minor'
                          )
                        }
                        placeholder="680,000"
                        disabled={submitting || !pricingSchemaReady}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.weekly_rate_minor)
                          )
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-monthly-rate"
                      label={copy.form.fieldMonthlyRate(currencyCode)}
                      helperText={
                        !pricingSchemaReady
                          ? copy.migrations.availableAfterMigration0005
                          : parsedMonthlyRate !== null && parsedMonthlyRate >= 0
                            ? copy.form.recordedForDaysPreview(
                                formatTndFromMillimes(
                                  parsedMonthlyRate,
                                  locale
                                ),
                                30
                              )
                            : copy.form.fieldMonthlyRateHelper
                      }
                      errorText={fieldErrors.monthly_rate_minor}
                    >
                      <input
                        id="vehicle-monthly-rate"
                        type="text"
                        dir="ltr"
                        inputMode="decimal"
                        value={values.monthly_rate_tnd}
                        onChange={(e) =>
                          updateField(
                            'monthly_rate_tnd',
                            e.target.value,
                            'monthly_rate_minor'
                          )
                        }
                        placeholder="2500,000"
                        disabled={submitting || !pricingSchemaReady}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.monthly_rate_minor)
                          )
                        )}
                      />
                    </FormField>
                  </div>
                </fieldset>

                {/* Section 4: Compliance expiry dates */}
                <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                      {copy.form.sectionCompliance}
                    </legend>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {copy.form.datesOnlyNotice}
                    </span>
                  </div>

                  {!complianceSchemaReady ? (
                    <AlertBanner variant="warning" compact>
                      {copy.migrations.formCompliancePrefix}{' '}
                      <span dir="ltr" className="font-mono">
                        202611210004_vehicle_compliance_dates.sql
                      </span>{' '}
                      {copy.migrations.formComplianceSuffix}
                    </AlertBanner>
                  ) : null}

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      id="vehicle-insurance-expiry"
                      label={copy.form.fieldInsuranceExpiry}
                      errorText={fieldErrors.insurance_expires_on}
                    >
                      <input
                        id="vehicle-insurance-expiry"
                        type="date"
                        dir="ltr"
                        min="1980-01-01"
                        max="2100-12-31"
                        value={values.insurance_expires_on}
                        onChange={(e) =>
                          updateField(
                            'insurance_expires_on',
                            e.target.value,
                            'insurance_expires_on'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.insurance_expires_on)
                          )
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-inspection-expiry"
                      label={copy.form.fieldInspectionExpiry}
                      errorText={fieldErrors.technical_inspection_expires_on}
                    >
                      <input
                        id="vehicle-inspection-expiry"
                        type="date"
                        dir="ltr"
                        min="1980-01-01"
                        max="2100-12-31"
                        value={values.technical_inspection_expires_on}
                        onChange={(e) =>
                          updateField(
                            'technical_inspection_expires_on',
                            e.target.value,
                            'technical_inspection_expires_on'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.technical_inspection_expires_on)
                          )
                        )}
                      />
                    </FormField>

                    <FormField
                      id="vehicle-vignette-expiry"
                      label={copy.form.fieldVignetteExpiry}
                      errorText={fieldErrors.vignette_expires_on}
                    >
                      <input
                        id="vehicle-vignette-expiry"
                        type="date"
                        dir="ltr"
                        min="1980-01-01"
                        max="2100-12-31"
                        value={values.vignette_expires_on}
                        onChange={(e) =>
                          updateField(
                            'vignette_expires_on',
                            e.target.value,
                            'vignette_expires_on'
                          )
                        }
                        disabled={submitting}
                        className={cn(
                          INPUT_BASE_CLASSES,
                          'font-mono tabular-nums',
                          getInputStateClasses(
                            Boolean(fieldErrors.vignette_expires_on)
                          )
                        )}
                      />
                    </FormField>
                  </div>
                </fieldset>

                {/* Section 5: Internal Notes */}
                <div className="border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
                  <FormField
                    id="vehicle-notes"
                    label={copy.form.fieldNotes}
                    helperText={copy.form.fieldNotesHelper}
                    errorText={fieldErrors.notes}
                  >
                    <textarea
                      id="vehicle-notes"
                      rows={3}
                      maxLength={2000}
                      value={values.notes}
                      onChange={(e) =>
                        updateField('notes', e.target.value, 'notes')
                      }
                      disabled={submitting}
                      placeholder={copy.form.fieldNotesPlaceholder}
                      className={cn(
                        TEXTAREA_BASE_CLASSES,
                        getInputStateClasses(Boolean(fieldErrors.notes))
                      )}
                    />
                  </FormField>
                </div>
              </div>

              <div className="pb-safe flex items-center justify-end gap-3 border-t border-slate-200 bg-[#F4F6FA] px-5 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/80">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11 sm:h-10"
                  onClick={onClose}
                  disabled={submitting}
                >
                  {copy.drawer.cancel}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-11 sm:h-10"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2
                        className="h-4 w-4 animate-spin"
                        aria-hidden="true"
                      />
                      <span>{copy.form.saving}</span>
                    </>
                  ) : mode === 'edit' ? (
                    <span>{copy.form.saveChanges}</span>
                  ) : (
                    <span>{copy.form.createVehicle}</span>
                  )}
                </Button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
