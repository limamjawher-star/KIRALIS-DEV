'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Info, Loader2, ShieldCheck, X } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import {
  createDriverSingleFlightGuard,
  driverRecordToVerificationFormValues,
  submitUpdateDriverVerification,
  type CustomerDriverClientItem,
  type DriverVerificationFieldErrors,
  type DriverVerificationFormValues,
} from '@/lib/drivers/client';
import {
  DRIVER_VERIFICATION_STATUSES,
  type DriverVerificationStatus,
} from '@/lib/drivers/types';
import { cn } from '@/lib/utils';

export interface DriverVerificationFormProps {
  customerId: string;
  driver: CustomerDriverClientItem;
  onCancel: () => void;
  onSaved: (updated: CustomerDriverClientItem) => Promise<void> | void;
}

export function DriverVerificationForm({
  customerId,
  driver,
  onCancel,
  onSaved,
}: DriverVerificationFormProps) {
  const { dict } = useAppPreferences();
  const driversCopy = dict.customersDirectory.detailDrawer.drivers;
  const verifyCopy = driversCopy.verificationForm;

  const [values, setValues] = useState<DriverVerificationFormValues>(() =>
    driverRecordToVerificationFormValues(driver)
  );
  const [fieldErrors, setFieldErrors] = useState<DriverVerificationFieldErrors>(
    {}
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submitGuardRef = useRef(createDriverSingleFlightGuard());
  const abortControllerRef = useRef<AbortController | null>(null);
  const activeContextRef = useRef({ customerId, driverId: driver.id });
  const isMountedRef = useRef(true);
  const statusSelectRef = useRef<HTMLSelectElement | null>(null);

  useEffect(() => {
    activeContextRef.current = { customerId, driverId: driver.id };
  }, [customerId, driver.id]);

  useEffect(() => {
    isMountedRef.current = true;
    const submitGuard = submitGuardRef.current;
    const frame = window.requestAnimationFrame(() => {
      statusSelectRef.current?.focus();
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

  function updateStatus(nextStatus: DriverVerificationStatus) {
    setValues((prev) => ({ ...prev, verification_status: nextStatus }));
    if (fieldErrors.verification_status) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.verification_status;
        return next;
      });
    }
    if (formError) {
      setFormError(null);
    }
  }

  function updateNotes(nextNotes: string) {
    setValues((prev) => ({ ...prev, verification_notes: nextNotes }));
    if (fieldErrors.verification_notes) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next.verification_notes;
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
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setSubmitting(true);
    setFormError(null);
    setFieldErrors({});

    try {
      const result = await submitUpdateDriverVerification(
        requestCustomerId,
        requestDriverId,
        driver,
        values,
        {
          signal: abortController.signal,
        }
      );

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
          result.noChanges ? verifyCopy.noChangesMessage : result.error
        );
        return;
      }

      await onSaved(result.driver);
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

  const formIdPrefix = `verify-driver-${driver.id}`;

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
            className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400"
              aria-hidden="true"
            />
            <span className="truncate">
              {verifyCopy.title} · {driver.full_name}
            </span>
          </h4>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label={verifyCopy.cancelLabel}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Explicit manual-review guidance: never a legal eligibility ruling */}
      <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-xs leading-relaxed text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200">
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        />
        <p>{verifyCopy.manualReviewNotice}</p>
      </div>

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

      <FormField
        id={`${formIdPrefix}-status`}
        label={verifyCopy.statusLabel}
        required
        errorText={fieldErrors.verification_status}
      >
        <select
          ref={statusSelectRef}
          id={`${formIdPrefix}-status`}
          name="verification_status"
          disabled={submitting}
          value={values.verification_status}
          onChange={(event) =>
            updateStatus(event.target.value as DriverVerificationStatus)
          }
          aria-invalid={Boolean(fieldErrors.verification_status)}
          aria-describedby={
            fieldErrors.verification_status
              ? `${formIdPrefix}-status-error`
              : undefined
          }
          className={cn(
            INPUT_BASE_CLASSES,
            getInputStateClasses(Boolean(fieldErrors.verification_status))
          )}
        >
          {DRIVER_VERIFICATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {driversCopy.verificationStatuses[status]}
            </option>
          ))}
        </select>
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor={`${formIdPrefix}-notes`}
            className="block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            {verifyCopy.notesLabel}
          </label>
          {values.verification_notes.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => updateNotes('')}
              disabled={submitting}
              className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200"
            >
              {verifyCopy.clearNotesLabel}
            </button>
          ) : null}
        </div>
        <textarea
          id={`${formIdPrefix}-notes`}
          name="verification_notes"
          rows={3}
          maxLength={1000}
          disabled={submitting}
          value={values.verification_notes}
          onChange={(event) => updateNotes(event.target.value)}
          placeholder={verifyCopy.notesPlaceholder}
          aria-invalid={Boolean(fieldErrors.verification_notes)}
          aria-describedby={
            fieldErrors.verification_notes
              ? `${formIdPrefix}-notes-error`
              : `${formIdPrefix}-notes-help`
          }
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-400',
            getInputStateClasses(Boolean(fieldErrors.verification_notes))
          )}
        />
        {fieldErrors.verification_notes ? (
          <p
            id={`${formIdPrefix}-notes-error`}
            role="alert"
            className="text-xs font-medium text-red-600 dark:text-red-400"
          >
            {fieldErrors.verification_notes}
          </p>
        ) : (
          <p
            id={`${formIdPrefix}-notes-help`}
            className="text-xs text-slate-500 dark:text-slate-400"
          >
            {verifyCopy.notesHelper}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {verifyCopy.cancelLabel}
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
              <span>{verifyCopy.savingLabel}</span>
            </>
          ) : (
            <span>{verifyCopy.saveLabel}</span>
          )}
        </Button>
      </div>
    </form>
  );
}
