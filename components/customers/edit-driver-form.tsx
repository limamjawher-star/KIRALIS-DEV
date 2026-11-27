'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Loader2, X } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { CUSTOMER_COUNTRY_OPTIONS } from '@/lib/customers/types';
import {
  createDriverSingleFlightGuard,
  driverRecordToDetailsFormValues,
  hasDriverVerificationSensitiveDetailsChanged,
  submitUpdateDriverDetails,
  type CustomerDriverClientItem,
  type EditDriverDetailsFieldErrors,
  type EditDriverDetailsFormValues,
} from '@/lib/drivers/client';
import { COMMON_LICENCE_CATEGORIES } from '@/lib/drivers/types';
import { cn } from '@/lib/utils';

export interface EditDriverFormProps {
  customerId: string;
  driver: CustomerDriverClientItem;
  onCancel: () => void;
  onSaved: (
    updated: CustomerDriverClientItem,
    meta: { licenceMetadataChanged: boolean; wasVerified: boolean }
  ) => Promise<void> | void;
}

export function EditDriverForm({
  customerId,
  driver,
  onCancel,
  onSaved,
}: EditDriverFormProps) {
  const { dict } = useAppPreferences();
  const driversCopy = dict.customersDirectory.detailDrawer.drivers;
  const addCopy = driversCopy.addForm;
  const editCopy = driversCopy.editForm;

  const [values, setValues] = useState<EditDriverDetailsFormValues>(() =>
    driverRecordToDetailsFormValues(driver)
  );
  const [fieldErrors, setFieldErrors] = useState<EditDriverDetailsFieldErrors>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitGuardRef = useRef(createDriverSingleFlightGuard());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeContextRef = useRef({ customerId, driverId: driver.id });
  const isMountedRef = useRef(true);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    activeContextRef.current = { customerId, driverId: driver.id };
  }, [customerId, driver.id]);

  useEffect(() => {
    isMountedRef.current = true;
    const submitGuard = submitGuardRef.current;
    const frame = window.requestAnimationFrame(() => {
      fullNameInputRef.current?.focus();
    });

    return () => {
      isMountedRef.current = false;
      window.cancelAnimationFrame(frame);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      submitGuard.release();
    };
  }, []);

  // Preserve an existing non-listed ISO country code so editing never silently drops it
  const countryOptions = useMemo(() => {
    const current = (driver.licence_issuing_country ?? '').trim().toUpperCase();
    if (
      !current ||
      !/^[A-Z]{2}$/.test(current) ||
      CUSTOMER_COUNTRY_OPTIONS.some((opt) => opt.code === current)
    ) {
      return CUSTOMER_COUNTRY_OPTIONS;
    }
    return [{ code: current, label: current }, ...CUSTOMER_COUNTRY_OPTIONS];
  }, [driver.licence_issuing_country]);

  // Preserve an existing non-listed licence category if present in Supabase
  const categoryOptions = useMemo(() => {
    const current = (driver.licence_category ?? '').trim().toUpperCase();
    if (!current || COMMON_LICENCE_CATEGORIES.includes(current)) {
      return COMMON_LICENCE_CATEGORIES;
    }
    return [current, ...COMMON_LICENCE_CATEGORIES];
  }, [driver.licence_category]);

  const showVerifiedLicenceWarning =
    driver.verification_status === 'verified' &&
    hasDriverVerificationSensitiveDetailsChanged(driver, values);

  function updateField<K extends keyof EditDriverDetailsFormValues>(
    field: K,
    value: EditDriverDetailsFormValues[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
    if (formError) {
      setFormError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!submitGuardRef.current.tryAcquire()) {
      return;
    }

    const requestCustomerId = customerId;
    const requestDriverId = driver.id;
    const wasVerified = driver.verification_status === 'verified';
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await submitUpdateDriverDetails(
        requestCustomerId,
        requestDriverId,
        driver,
        values,
        {
          signal: abortController.signal,
        }
      );

      // Guard against stale responses after unmount, driver switch, or customer switch
      if (
        !isMountedRef.current ||
        abortController.signal.aborted ||
        activeContextRef.current.customerId !== requestCustomerId ||
        activeContextRef.current.driverId !== requestDriverId
      ) {
        return;
      }

      if (!result.ok) {
        if (result.aborted) {
          return;
        }
        setFieldErrors(result.fieldErrors);
        setFormError(
          result.noChanges ? editCopy.noChangesMessage : result.error
        );
        return;
      }

      await onSaved(result.driver, {
        licenceMetadataChanged: result.licenceMetadataChanged,
        wasVerified,
      });
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
      submitGuardRef.current.release();
      if (isMountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  const formIdPrefix = `edit-driver-${driver.id}`;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${formIdPrefix}-title`}
      className="space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4
            id={`${formIdPrefix}-title`}
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {editCopy.title}
          </h4>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {editCopy.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label={editCopy.cancelLabel}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {showVerifiedLicenceWarning ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
            aria-hidden="true"
          />
          <span>{editCopy.verifiedLicenceChangeWarning}</span>
        </div>
      ) : null}

      {formError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          id={`${formIdPrefix}-full-name`}
          label={addCopy.fullNameLabel}
          required
          errorText={fieldErrors.full_name}
          className="sm:col-span-2"
        >
          <input
            ref={fullNameInputRef}
            id={`${formIdPrefix}-full-name`}
            name="full_name"
            type="text"
            autoComplete="name"
            required
            maxLength={140}
            disabled={submitting}
            value={values.full_name}
            onChange={(event) => updateField('full_name', event.target.value)}
            placeholder={addCopy.fullNamePlaceholder}
            aria-invalid={Boolean(fieldErrors.full_name)}
            aria-describedby={
              fieldErrors.full_name
                ? `${formIdPrefix}-full-name-error`
                : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.full_name))
            )}
          />
        </FormField>

        <FormField
          id={`${formIdPrefix}-issuing-country`}
          label={addCopy.issuingCountryLabel}
          errorText={fieldErrors.licence_issuing_country}
        >
          <select
            id={`${formIdPrefix}-issuing-country`}
            name="licence_issuing_country"
            disabled={submitting}
            value={values.licence_issuing_country}
            onChange={(event) =>
              updateField('licence_issuing_country', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.licence_issuing_country)}
            aria-describedby={
              fieldErrors.licence_issuing_country
                ? `${formIdPrefix}-issuing-country-error`
                : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.licence_issuing_country))
            )}
          >
            <option value="">{addCopy.issuingCountryEmptyOption}</option>
            {countryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id={`${formIdPrefix}-licence-category`}
          label={addCopy.licenceCategoryLabel}
          errorText={fieldErrors.licence_category}
        >
          <select
            id={`${formIdPrefix}-licence-category`}
            name="licence_category"
            disabled={submitting}
            value={values.licence_category}
            onChange={(event) =>
              updateField('licence_category', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.licence_category)}
            aria-describedby={
              fieldErrors.licence_category
                ? `${formIdPrefix}-licence-category-error`
                : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.licence_category))
            )}
          >
            <option value="">{addCopy.licenceCategoryEmptyOption}</option>
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id={`${formIdPrefix}-licence-expires-on`}
          label={addCopy.licenceExpiresOnLabel}
          helperText={addCopy.licenceExpiresOnHelper}
          errorText={fieldErrors.licence_expires_on}
          className="sm:col-span-2"
        >
          <input
            id={`${formIdPrefix}-licence-expires-on`}
            name="licence_expires_on"
            type="date"
            dir="ltr"
            min="1980-01-01"
            max="2150-12-31"
            disabled={submitting}
            value={values.licence_expires_on}
            onChange={(event) =>
              updateField('licence_expires_on', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.licence_expires_on)}
            aria-describedby={
              fieldErrors.licence_expires_on
                ? `${formIdPrefix}-licence-expires-on-error`
                : `${formIdPrefix}-licence-expires-on-help`
            }
            className={cn(
              INPUT_BASE_CLASSES,
              'font-mono tabular-nums',
              getInputStateClasses(Boolean(fieldErrors.licence_expires_on))
            )}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {editCopy.cancelLabel}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>{editCopy.savingLabel}</span>
            </>
          ) : (
            <span>{editCopy.saveLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
