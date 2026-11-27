'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
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
  createEmptyDriverFormValues,
  submitCreateCustomerDriver,
  type CreateCustomerDriverFormValues,
  type CustomerDriverClientItem,
} from '@/lib/drivers/client';
import { COMMON_LICENCE_CATEGORIES } from '@/lib/drivers/types';
import type { CreateCustomerDriverFieldErrors } from '@/lib/drivers/validation';
import { cn } from '@/lib/utils';

export interface AddDriverFormProps {
  customerId: string;
  onCancel: () => void;
  onCreated: (driver: CustomerDriverClientItem) => Promise<void> | void;
}

export function AddDriverForm({
  customerId,
  onCancel,
  onCreated,
}: AddDriverFormProps) {
  const { dict } = useAppPreferences();
  const addCopy = dict.customersDirectory.detailDrawer.drivers.addForm;

  const [values, setValues] = useState<CreateCustomerDriverFormValues>(
    createEmptyDriverFormValues
  );
  const [fieldErrors, setFieldErrors] =
    useState<CreateCustomerDriverFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitGuardRef = useRef(createDriverSingleFlightGuard());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeCustomerIdRef = useRef(customerId);
  const isMountedRef = useRef(true);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    activeCustomerIdRef.current = customerId;
  }, [customerId]);

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

  function updateField<K extends keyof CreateCustomerDriverFormValues>(
    field: K,
    value: CreateCustomerDriverFormValues[K]
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
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await submitCreateCustomerDriver(
        requestCustomerId,
        values,
        {
          signal: abortController.signal,
        }
      );

      // Guard against stale responses after unmount or customer switch
      if (
        !isMountedRef.current ||
        abortController.signal.aborted ||
        activeCustomerIdRef.current !== requestCustomerId
      ) {
        return;
      }

      if (!result.ok) {
        if (result.aborted) {
          return;
        }
        setFieldErrors(result.fieldErrors);
        setFormError(result.error);
        return;
      }

      await onCreated(result.driver);
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

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby="add-driver-form-title"
      className="mt-3 rounded-xl border border-blue-200/80 bg-blue-50/35 p-4 dark:border-blue-900/60 dark:bg-blue-950/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4
            id="add-driver-form-title"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {addCopy.title}
          </h4>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
            {addCopy.subtitle}
          </p>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label={addCopy.cancelLabel}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {formError ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200"
        >
          <AlertCircle
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <span>{formError}</span>
        </div>
      ) : null}

      <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField
          id="driver-full-name"
          label={addCopy.fullNameLabel}
          required
          errorText={fieldErrors.full_name}
          className="sm:col-span-2"
        >
          <input
            ref={fullNameInputRef}
            id="driver-full-name"
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
              fieldErrors.full_name ? 'driver-full-name-error' : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.full_name))
            )}
          />
        </FormField>

        <FormField
          id="driver-issuing-country"
          label={addCopy.issuingCountryLabel}
          errorText={fieldErrors.licence_issuing_country}
        >
          <select
            id="driver-issuing-country"
            name="licence_issuing_country"
            disabled={submitting}
            value={values.licence_issuing_country}
            onChange={(event) =>
              updateField('licence_issuing_country', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.licence_issuing_country)}
            aria-describedby={
              fieldErrors.licence_issuing_country
                ? 'driver-issuing-country-error'
                : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.licence_issuing_country))
            )}
          >
            <option value="">{addCopy.issuingCountryEmptyOption}</option>
            {CUSTOMER_COUNTRY_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="driver-licence-category"
          label={addCopy.licenceCategoryLabel}
          errorText={fieldErrors.licence_category}
        >
          <select
            id="driver-licence-category"
            name="licence_category"
            disabled={submitting}
            value={values.licence_category}
            onChange={(event) =>
              updateField('licence_category', event.target.value)
            }
            aria-invalid={Boolean(fieldErrors.licence_category)}
            aria-describedby={
              fieldErrors.licence_category
                ? 'driver-licence-category-error'
                : undefined
            }
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(Boolean(fieldErrors.licence_category))
            )}
          >
            <option value="">{addCopy.licenceCategoryEmptyOption}</option>
            {COMMON_LICENCE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </FormField>

        <FormField
          id="driver-licence-expires-on"
          label={addCopy.licenceExpiresOnLabel}
          helperText={addCopy.licenceExpiresOnHelper}
          errorText={fieldErrors.licence_expires_on}
          className="sm:col-span-2"
        >
          <input
            id="driver-licence-expires-on"
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
                ? 'driver-licence-expires-on-error'
                : 'driver-licence-expires-on-help'
            }
            className={cn(
              INPUT_BASE_CLASSES,
              'font-mono tabular-nums',
              getInputStateClasses(Boolean(fieldErrors.licence_expires_on))
            )}
          />
        </FormField>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {addCopy.cancelLabel}
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
              <span>{addCopy.submittingLabel}</span>
            </>
          ) : (
            <span>{addCopy.submitLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
