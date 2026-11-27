'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, ShieldCheck, X } from 'lucide-react';
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
    <motion.form
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${formIdPrefix}-title`}
      className="space-y-3.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100/90 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
          <h4
            id={`${formIdPrefix}-title`}
            className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50"
          >
            {verifyCopy.title} · {driver.full_name}
          </h4>
        </div>

        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          aria-label={verifyCopy.cancelLabel}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Explicit manual-review guidance: never a legal eligibility ruling */}
      <AlertBanner variant="info" compact>
        {verifyCopy.manualReviewNotice}
      </AlertBanner>

      {formError ? (
        <AlertBanner variant="error" compact>
          {formError}
        </AlertBanner>
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
            className="block text-[13px] font-medium text-slate-700 dark:text-slate-200"
          >
            {verifyCopy.notesLabel}
          </label>
          {values.verification_notes.trim().length > 0 ? (
            <button
              type="button"
              onClick={() => updateNotes('')}
              disabled={submitting}
              className="text-xs font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
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
            TEXTAREA_BASE_CLASSES,
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

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-blue-200/60 pt-3 dark:border-blue-900/50">
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
    </motion.form>
  );
}
