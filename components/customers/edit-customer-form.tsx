'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
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
  submitUpdateCustomer,
} from '@/lib/customers/client';
import {
  CUSTOMER_COUNTRY_OPTIONS,
  customerRecordToFormValues,
  type CustomerFieldErrors,
  type CustomerFormValues,
  type CustomerRecord,
  type CustomerType,
} from '@/lib/customers/types';
import { cn } from '@/lib/utils';

export interface EditCustomerFormProps {
  customer: CustomerRecord;
  onCancel: () => void;
  onSaved: (updated: CustomerRecord) => Promise<void> | void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export function EditCustomerForm({
  customer,
  onCancel,
  onSaved,
  onSubmittingChange,
}: EditCustomerFormProps) {
  const { dict } = useAppPreferences();
  const copy = dict.customersDirectory;
  const modalCopy = copy.addModal;
  const drawerCopy = copy.detailDrawer;

  const [values, setValues] = useState<CustomerFormValues>(() =>
    customerRecordToFormValues(customer)
  );
  const [fieldErrors, setFieldErrors] = useState<CustomerFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitGuardRef = useRef(createSingleFlightGuard());
  const abortControllerRef = useRef<AbortController | null>(null);
  const fullNameInputRef = useRef<HTMLInputElement | null>(null);
  const onSubmittingChangeRef = useRef(onSubmittingChange);

  useEffect(() => {
    onSubmittingChangeRef.current = onSubmittingChange;
  }, [onSubmittingChange]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      fullNameInputRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      onSubmittingChangeRef.current?.(false);
    };
  }, []);

  const typeOptions: readonly { value: CustomerType; label: string }[] = useMemo(
    () => [
      { value: 'individual', label: copy.typeBadges.individual },
      { value: 'corporate', label: copy.typeBadges.corporate },
    ],
    [copy.typeBadges]
  );

  const countryOptions = useMemo(() => {
    const normalizedCurrent = values.country_code.trim().toUpperCase();
    const exists = CUSTOMER_COUNTRY_OPTIONS.some(
      (opt) => opt.code === normalizedCurrent
    );
    if (exists || !/^[A-Z]{2}$/.test(normalizedCurrent)) {
      return CUSTOMER_COUNTRY_OPTIONS;
    }
    return [
      { code: normalizedCurrent, label: normalizedCurrent },
      ...CUSTOMER_COUNTRY_OPTIONS,
    ];
  }, [values.country_code]);

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
      onSubmittingChangeRef.current?.(true);
      setFieldErrors({});
      setFormError(null);

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      const result = await submitUpdateCustomer(
        customer.id,
        customer,
        values,
        fetch,
        abortController.signal
      );

      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      if (!result.ok) {
        if (result.aborted) {
          return;
        }
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setFormError(
          result.noChanges ? drawerCopy.noChangesMessage : result.error
        );
        setSubmitting(false);
        onSubmittingChangeRef.current?.(false);
        return;
      }

      await onSaved(result.customer);
    });
  }

  return (
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
              id="edit-customer-full-name"
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
                id="edit-customer-full-name"
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
                    ? 'edit-customer-full-name-error'
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
                id="edit-customer-company-name"
                label={modalCopy.companyNameLabel}
                errorText={fieldErrors.company_name}
              >
                <input
                  id="edit-customer-company-name"
                  name="company_name"
                  type="text"
                  disabled={submitting}
                  value={values.company_name}
                  onChange={(e) => updateField('company_name', e.target.value)}
                  placeholder={modalCopy.companyNamePlaceholder}
                  autoComplete="organization"
                  aria-invalid={Boolean(fieldErrors.company_name)}
                  aria-describedby={
                    fieldErrors.company_name
                      ? 'edit-customer-company-name-error'
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
              id="edit-customer-phone"
              label={modalCopy.phoneLabel}
              required
              helperText={modalCopy.phoneHelper}
              errorText={fieldErrors.phone}
            >
              <input
                id="edit-customer-phone"
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
                    ? 'edit-customer-phone-error'
                    : 'edit-customer-phone-help'
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono tabular-nums',
                  getInputStateClasses(Boolean(fieldErrors.phone))
                )}
              />
            </FormField>

            <FormField
              id="edit-customer-email"
              label={modalCopy.emailLabel}
              errorText={fieldErrors.email}
            >
              <input
                id="edit-customer-email"
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
                  fieldErrors.email ? 'edit-customer-email-error' : undefined
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(fieldErrors.email))
                )}
              />
            </FormField>
          </div>
        </fieldset>

        {/* Address & Country */}
        <fieldset className="space-y-4 border-t border-slate-200/80 pt-5 dark:border-slate-800/80">
          <legend className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-400 dark:text-slate-500">
            {modalCopy.sectionAddress}
          </legend>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              id="edit-customer-address"
              label={modalCopy.addressLabel}
              errorText={fieldErrors.address}
              className="sm:col-span-2"
            >
              <input
                id="edit-customer-address"
                name="address"
                type="text"
                disabled={submitting}
                value={values.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder={modalCopy.addressPlaceholder}
                autoComplete="street-address"
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={
                  fieldErrors.address
                    ? 'edit-customer-address-error'
                    : undefined
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(fieldErrors.address))
                )}
              />
            </FormField>

            <FormField
              id="edit-customer-city"
              label={modalCopy.cityLabel}
              errorText={fieldErrors.city}
            >
              <input
                id="edit-customer-city"
                name="city"
                type="text"
                disabled={submitting}
                value={values.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder={modalCopy.cityPlaceholder}
                autoComplete="address-level2"
                aria-invalid={Boolean(fieldErrors.city)}
                aria-describedby={
                  fieldErrors.city ? 'edit-customer-city-error' : undefined
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(fieldErrors.city))
                )}
              />
            </FormField>

            <FormField
              id="edit-customer-country"
              label={modalCopy.countryLabel}
              errorText={fieldErrors.country_code}
            >
              <select
                id="edit-customer-country"
                name="country_code"
                disabled={submitting}
                value={values.country_code}
                onChange={(e) => updateField('country_code', e.target.value)}
                aria-invalid={Boolean(fieldErrors.country_code)}
                aria-describedby={
                  fieldErrors.country_code
                    ? 'edit-customer-country-error'
                    : undefined
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(fieldErrors.country_code))
                )}
              >
                {countryOptions.map((opt) => (
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
            id="edit-customer-notes"
            label={modalCopy.notesLabel}
            errorText={fieldErrors.notes}
          >
            <textarea
              id="edit-customer-notes"
              name="notes"
              rows={3}
              disabled={submitting}
              value={values.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder={modalCopy.notesPlaceholder}
              aria-invalid={Boolean(fieldErrors.notes)}
              aria-describedby={
                fieldErrors.notes ? 'edit-customer-notes-error' : undefined
              }
              className={cn(
                TEXTAREA_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.notes))
              )}
            />
          </FormField>
        </fieldset>
      </div>

      {/* Sticky Form Footer */}
      <div className="pb-safe flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200/90 bg-slate-50/80 px-5 py-3.5 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-950/70">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={submitting}
        >
          {drawerCopy.cancelLabel}
        </Button>
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{drawerCopy.savingLabel}</span>
            </>
          ) : (
            <span>{drawerCopy.saveLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
