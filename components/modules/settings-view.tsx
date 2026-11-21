'use client';

import React, { useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import {
  INITIAL_AGENCY_SETTINGS,
  hasValidationErrors,
  validateAgencySettings,
  type AgencySettingsErrors,
  type AgencySettingsFormValues,
} from '@/lib/settings-validation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import {
  FormField,
  INPUT_BASE_CLASSES,
  getInputStateClasses,
} from '@/components/ui/form-field';
import { ModuleNotice } from '@/components/ui/module-notice';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

export function SettingsView() {
  const { dict } = useAppPreferences();
  const moduleCopy = dict.modules.settings;
  const copy = dict.settings;

  const [values, setValues] = useState<AgencySettingsFormValues>(
    INITIAL_AGENCY_SETTINGS
  );
  const [errors, setErrors] = useState<AgencySettingsErrors>({});
  const [submissionState, setSubmissionState] = useState<
    'idle' | 'invalid' | 'validated'
  >('idle');

  const updateField = <K extends keyof AgencySettingsFormValues>(
    field: K,
    nextValue: AgencySettingsFormValues[K]
  ) => {
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    if (errors[field]) {
      setErrors((prev) => {
        const copyErrors = { ...prev };
        delete copyErrors[field];
        return copyErrors;
      });
    }
    if (submissionState !== 'idle') {
      setSubmissionState('idle');
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateAgencySettings(values);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      setSubmissionState('invalid');
      return;
    }
    setSubmissionState('validated');
  };

  const handleReset = () => {
    setValues(INITIAL_AGENCY_SETTINGS);
    setErrors({});
    setSubmissionState('idle');
  };

  const errorTextFor = (field: keyof AgencySettingsFormValues) => {
    const code = errors[field];
    return code ? copy.errors[code] : undefined;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase="Phase 2"
      />

      <ModuleNotice
        title={dict.common.phase1NoticeTitle}
        body={moduleCopy.emptyDescription}
      />

      {submissionState === 'validated' ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3.5 text-sm dark:border-emerald-900 dark:bg-emerald-950/40"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700 dark:text-emerald-400"
            aria-hidden="true"
          />
          <div className="space-y-0.5">
            <p className="font-medium text-emerald-950 dark:text-emerald-200">
              {copy.validationSuccessTitle}
            </p>
            <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300/90">
              {copy.validationSuccessBody}
            </p>
          </div>
        </div>
      ) : null}

      {submissionState === 'invalid' ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50/70 px-4 py-3.5 text-sm dark:border-red-900 dark:bg-red-950/40"
        >
          <AlertCircle
            className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400"
            aria-hidden="true"
          />
          <p className="text-xs font-medium text-red-800 dark:text-red-200">
            {copy.validationErrorSummary}
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* Identity section */}
        <Surface padded className="space-y-5">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {copy.identitySectionTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {copy.identitySectionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              id="agencyName"
              label={copy.fields.agencyName}
              required
              errorText={errorTextFor('agencyName')}
            >
              <input
                id="agencyName"
                name="agencyName"
                type="text"
                value={values.agencyName}
                onChange={(e) => updateField('agencyName', e.target.value)}
                placeholder={copy.fields.agencyNamePlaceholder}
                aria-invalid={Boolean(errors.agencyName)}
                aria-describedby={errors.agencyName ? 'agencyName-error' : undefined}
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(errors.agencyName))
                )}
              />
            </FormField>

            <FormField id="legalName" label={copy.fields.legalName}>
              <input
                id="legalName"
                name="legalName"
                type="text"
                value={values.legalName}
                onChange={(e) => updateField('legalName', e.target.value)}
                placeholder={copy.fields.legalNamePlaceholder}
                className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
              />
            </FormField>

            <FormField
              id="taxId"
              label={copy.fields.taxId}
              helperText={copy.fields.taxIdHelp}
            >
              <input
                id="taxId"
                name="taxId"
                type="text"
                value={values.taxId}
                onChange={(e) => updateField('taxId', e.target.value)}
                placeholder={copy.fields.taxIdPlaceholder}
                aria-describedby="taxId-help"
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono',
                  getInputStateClasses(false)
                )}
              />
            </FormField>

            <FormField
              id="email"
              label={copy.fields.email}
              required
              errorText={errorTextFor('email')}
            >
              <input
                id="email"
                name="email"
                type="email"
                value={values.email}
                onChange={(e) => updateField('email', e.target.value)}
                placeholder={copy.fields.emailPlaceholder}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(errors.email))
                )}
              />
            </FormField>

            <FormField
              id="phone"
              label={copy.fields.phone}
              required
              errorText={errorTextFor('phone')}
            >
              <input
                id="phone"
                name="phone"
                type="tel"
                value={values.phone}
                onChange={(e) => updateField('phone', e.target.value)}
                placeholder={copy.fields.phonePlaceholder}
                aria-invalid={Boolean(errors.phone)}
                aria-describedby={errors.phone ? 'phone-error' : undefined}
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono',
                  getInputStateClasses(Boolean(errors.phone))
                )}
              />
            </FormField>

            <FormField
              id="city"
              label={copy.fields.city}
              required
              errorText={errorTextFor('city')}
            >
              <input
                id="city"
                name="city"
                type="text"
                value={values.city}
                onChange={(e) => updateField('city', e.target.value)}
                placeholder={copy.fields.cityPlaceholder}
                aria-invalid={Boolean(errors.city)}
                aria-describedby={errors.city ? 'city-error' : undefined}
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(errors.city))
                )}
              />
            </FormField>

            <FormField
              id="address"
              label={copy.fields.address}
              className="md:col-span-2"
            >
              <input
                id="address"
                name="address"
                type="text"
                value={values.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder={copy.fields.addressPlaceholder}
                className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
              />
            </FormField>
          </div>
        </Surface>

        {/* Regional & tax defaults */}
        <Surface padded className="space-y-5">
          <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {copy.regionalSectionTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {copy.regionalSectionDesc}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField id="currency" label={copy.fields.currency}>
              <input
                id="currency"
                type="text"
                value="TND (3 décimales)"
                disabled
                readOnly
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono',
                  getInputStateClasses(false)
                )}
              />
            </FormField>

            <FormField id="timezone" label={copy.fields.timezone}>
              <input
                id="timezone"
                type="text"
                value="Africa/Tunis (UTC+1)"
                disabled
                readOnly
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono',
                  getInputStateClasses(false)
                )}
              />
            </FormField>

            <FormField id="defaultLanguage" label={copy.fields.defaultLanguage}>
              <select
                id="defaultLanguage"
                name="defaultLanguage"
                value={values.defaultLanguage}
                onChange={(e) =>
                  updateField(
                    'defaultLanguage',
                    e.target.value as 'fr' | 'en' | 'ar'
                  )
                }
                className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
              >
                <option value="fr">Français (FR)</option>
                <option value="en">English (EN)</option>
                <option value="ar">العربية (AR)</option>
              </select>
            </FormField>

            <FormField
              id="vatRatePercent"
              label={copy.fields.vatRatePercent}
              helperText={copy.fields.vatHelp}
              errorText={errorTextFor('vatRatePercent')}
            >
              <input
                id="vatRatePercent"
                name="vatRatePercent"
                type="text"
                inputMode="decimal"
                value={values.vatRatePercent}
                onChange={(e) => updateField('vatRatePercent', e.target.value)}
                aria-invalid={Boolean(errors.vatRatePercent)}
                aria-describedby={
                  errors.vatRatePercent
                    ? 'vatRatePercent-error'
                    : 'vatRatePercent-help'
                }
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono tabular-nums',
                  getInputStateClasses(Boolean(errors.vatRatePercent))
                )}
              />
            </FormField>
          </div>
        </Surface>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="secondary" type="button" onClick={handleReset}>
            {copy.resetButton}
          </Button>
          <Button variant="primary" type="submit">
            {copy.validateButton}
          </Button>
        </div>
      </form>
    </div>
  );
}
