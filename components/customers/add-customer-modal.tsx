'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import {
  createSingleFlightGuard,
  submitCreateCustomer,
} from '@/lib/customers/client';
import {
  createEmptyCustomerFormValues,
  CUSTOMER_COUNTRY_OPTIONS,
  DEFAULT_CUSTOMER_COUNTRY_CODE,
  type CustomerFieldErrors,
  type CustomerFormValues,
  type CustomerRecord,
  type CustomerType,
} from '@/lib/customers/types';
import { cn } from '@/lib/utils';

export interface AddCustomerModalProps {
  open: boolean;
  defaultCountryCode?: string;
  onClose: () => void;
  onCreated: (customer: CustomerRecord) => Promise<void> | void;
}

export function AddCustomerModal({
  open,
  defaultCountryCode = DEFAULT_CUSTOMER_COUNTRY_CODE,
  onClose,
  onCreated,
}: AddCustomerModalProps) {
  const { dict } = useAppPreferences();
  const copy = dict.customersDirectory;
  const modalCopy = copy.addModal;

  const [values, setValues] = useState<CustomerFormValues>(() =>
    createEmptyCustomerFormValues(defaultCountryCode)
  );
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitGuardRef = useRef(createSingleFlightGuard());
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const frame = window.requestAnimationFrame(() => {
      fullNameInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  const typeOptions: readonly { value: CustomerType; label: string }[] = useMemo(
    () => [
      { value: 'individual', label: copy.typeBadges.individual },
      { value: 'corporate', label: copy.typeBadges.corporate },
    ],
    [copy.typeBadges]
  );

  if (!open) {
    return null;
  }

  function updateField<K extends keyof CustomerFormValues>(
    field: K,
    value: CustomerFormValues[K]
  ) {
    setValues((prev) => {
      if (field === 'customer_type' && value === 'individual') {
        return { ...prev, customer_type: 'individual', company_name: '' };
      }
      return { ...prev, [field]: value };
    });

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

    await submitGuardRef.current.run(async () => {
      setSubmitting(true);
      setFieldErrors({});
      setFormError(null);

      const result = await submitCreateCustomer(values);

      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(result.error);
        setSubmitting(false);
        return;
      }

      await onCreated(result.customer);
    });
  }

  const titleId = 'add-customer-modal-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
            >
              {modalCopy.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {modalCopy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label={modalCopy.closeAriaLabel}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{formError}</span>
              </div>
            ) : null}

            {/* Identity */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {modalCopy.sectionIdentity}
              </legend>

              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                  {modalCopy.customerTypeLabel}
                </span>
                <SegmentedControl
                  options={typeOptions}
                  value={values.customer_type}
                  onChange={(nextType) =>
                    !submitting && updateField('customer_type', nextType)
                  }
                  ariaLabel={modalCopy.customerTypeLabel}
                />
                {fieldErrors.customer_type ? (
                  <p
                    role="alert"
                    className="text-xs font-medium text-red-600 dark:text-red-400"
                  >
                    {fieldErrors.customer_type}
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="customer-full-name"
                  label={modalCopy.fullNameLabel}
                  required
                  errorText={fieldErrors.full_name}
                  className={
                    values.customer_type === 'individual'
                      ? 'sm:col-span-2'
                      : undefined
                  }
                >
                  <input
                    ref={fullNameInputRef}
                    id="customer-full-name"
                    name="full_name"
                    type="text"
                    required
                    disabled={submitting}
                    value={values.full_name}
                    onChange={(e) => updateField('full_name', e.target.value)}
                    placeholder={modalCopy.fullNamePlaceholder}
                    autoComplete="name"
                    aria-invalid={Boolean(fieldErrors.full_name)}
                    aria-describedby={
                      fieldErrors.full_name
                        ? 'customer-full-name-error'
                        : undefined
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.full_name))
                    )}
                  />
                </FormField>

                {values.customer_type === 'corporate' ? (
                  <FormField
                    id="customer-company-name"
                    label={modalCopy.companyNameLabel}
                    errorText={fieldErrors.company_name}
                  >
                    <input
                      id="customer-company-name"
                      name="company_name"
                      type="text"
                      disabled={submitting}
                      value={values.company_name}
                      onChange={(e) =>
                        updateField('company_name', e.target.value)
                      }
                      placeholder={modalCopy.companyNamePlaceholder}
                      autoComplete="organization"
                      aria-invalid={Boolean(fieldErrors.company_name)}
                      aria-describedby={
                        fieldErrors.company_name
                          ? 'customer-company-name-error'
                          : undefined
                      }
                      className={cn(
                        INPUT_BASE_CLASSES,
                        getInputStateClasses(Boolean(fieldErrors.company_name))
                      )}
                    />
                  </FormField>
                ) : null}
              </div>
            </fieldset>

            {/* Contact */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {modalCopy.sectionContact}
              </legend>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="customer-phone"
                  label={modalCopy.phoneLabel}
                  required
                  helperText={modalCopy.phoneHelper}
                  errorText={fieldErrors.phone}
                >
                  <input
                    id="customer-phone"
                    name="phone"
                    type="tel"
                    dir="ltr"
                    required
                    disabled={submitting}
                    value={values.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    placeholder={modalCopy.phonePlaceholder}
                    autoComplete="tel"
                    aria-invalid={Boolean(fieldErrors.phone)}
                    aria-describedby={
                      fieldErrors.phone
                        ? 'customer-phone-error'
                        : 'customer-phone-help'
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.phone))
                    )}
                  />
                </FormField>

                <FormField
                  id="customer-email"
                  label={modalCopy.emailLabel}
                  errorText={fieldErrors.email}
                >
                  <input
                    id="customer-email"
                    name="email"
                    type="email"
                    dir="ltr"
                    disabled={submitting}
                    value={values.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder={modalCopy.emailPlaceholder}
                    autoComplete="email"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={
                      fieldErrors.email ? 'customer-email-error' : undefined
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.email))
                    )}
                  />
                </FormField>
              </div>
            </fieldset>

            {/* Address */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {modalCopy.sectionAddress}
              </legend>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="customer-address"
                  label={modalCopy.addressLabel}
                  errorText={fieldErrors.address}
                  className="sm:col-span-2"
                >
                  <input
                    id="customer-address"
                    name="address"
                    type="text"
                    disabled={submitting}
                    value={values.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    placeholder={modalCopy.addressPlaceholder}
                    autoComplete="street-address"
                    aria-invalid={Boolean(fieldErrors.address)}
                    aria-describedby={
                      fieldErrors.address ? 'customer-address-error' : undefined
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.address))
                    )}
                  />
                </FormField>

                <FormField
                  id="customer-city"
                  label={modalCopy.cityLabel}
                  errorText={fieldErrors.city}
                >
                  <input
                    id="customer-city"
                    name="city"
                    type="text"
                    disabled={submitting}
                    value={values.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder={modalCopy.cityPlaceholder}
                    autoComplete="address-level2"
                    aria-invalid={Boolean(fieldErrors.city)}
                    aria-describedby={
                      fieldErrors.city ? 'customer-city-error' : undefined
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.city))
                    )}
                  />
                </FormField>

                <FormField
                  id="customer-country"
                  label={modalCopy.countryLabel}
                  errorText={fieldErrors.country_code}
                >
                  <select
                    id="customer-country"
                    name="country_code"
                    disabled={submitting}
                    value={values.country_code}
                    onChange={(e) =>
                      updateField('country_code', e.target.value)
                    }
                    aria-invalid={Boolean(fieldErrors.country_code)}
                    aria-describedby={
                      fieldErrors.country_code
                        ? 'customer-country-error'
                        : undefined
                    }
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.country_code))
                    )}
                  >
                    {CUSTOMER_COUNTRY_OPTIONS.map((opt) => (
                      <option key={opt.code} value={opt.code}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </fieldset>

            {/* Internal Notes */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {modalCopy.sectionNotes}
              </legend>

              <FormField
                id="customer-notes"
                label={modalCopy.notesLabel}
                errorText={fieldErrors.notes}
              >
                <textarea
                  id="customer-notes"
                  name="notes"
                  rows={3}
                  disabled={submitting}
                  value={values.notes}
                  onChange={(e) => updateField('notes', e.target.value)}
                  placeholder={modalCopy.notesPlaceholder}
                  aria-invalid={Boolean(fieldErrors.notes)}
                  aria-describedby={
                    fieldErrors.notes ? 'customer-notes-error' : undefined
                  }
                  className={cn(
                    'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-400',
                    getInputStateClasses(Boolean(fieldErrors.notes))
                  )}
                />
              </FormField>
            </fieldset>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 bg-slate-50/70 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              {modalCopy.cancelLabel}
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  <span>{modalCopy.submittingLabel}</span>
                </>
              ) : (
                <span>{modalCopy.submitLabel}</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
