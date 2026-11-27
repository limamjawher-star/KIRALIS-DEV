'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
  TEXTAREA_BASE_CLASSES,
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 20, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Mobile grabber */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden" aria-hidden="true">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        <div className="flex items-start justify-between gap-4 border-b border-slate-200/90 px-5 py-4 sm:px-6 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="font-display text-lg font-bold tracking-tight text-slate-950 dark:text-slate-50"
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
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
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

            {/* Identity */}
            <fieldset className="space-y-4">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
                {modalCopy.sectionIdentity}
              </legend>

              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-slate-800 dark:text-slate-200">
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
            <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
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
            <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
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
            <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
              <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
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
                    TEXTAREA_BASE_CLASSES,
                    getInputStateClasses(Boolean(fieldErrors.notes))
                  )}
                />
              </FormField>
            </fieldset>
          </div>

          <div className="pb-safe flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200/90 bg-slate-50/80 px-5 py-3.5 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-950/70">
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
      </motion.div>
    </motion.div>
  );
}
