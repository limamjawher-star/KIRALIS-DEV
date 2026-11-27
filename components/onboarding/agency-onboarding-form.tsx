'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  CheckCircle2,
  Globe,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { AuthAlert } from '@/components/auth/auth-alert';
import { Button } from '@/components/ui/button';
import {
  FormField,
  INPUT_BASE_CLASSES,
  getInputStateClasses,
} from '@/components/ui/form-field';
import { Surface } from '@/components/ui/surface';
import { SUPPORTED_COUNTRIES } from '@/lib/agency/types';
import {
  DEFAULT_ONBOARDING_VALUES,
  slugifyAgencyName,
  validateOnboardingAgencyInput,
  type OnboardingAgencyInput,
  type OnboardingField,
  type OnboardingFieldErrors,
} from '@/lib/agency/validation';
import { cn } from '@/lib/utils';

export interface AgencyOnboardingFormProps {
  defaultEmail?: string | null;
  isFirstAgency: boolean;
}

interface OnboardingApiResponse {
  ok: boolean;
  agency?: {
    id: string;
    name: string;
    slug: string;
  };
  role?: 'owner';
  redirectTo?: string;
  error?: string;
  fieldErrors?: OnboardingFieldErrors;
}

export function AgencyOnboardingForm({
  defaultEmail = null,
  isFirstAgency,
}: AgencyOnboardingFormProps) {
  const router = useRouter();
  const submittingRef = useRef(false);

  const [values, setValues] = useState<OnboardingAgencyInput>({
    ...DEFAULT_ONBOARDING_VALUES,
    email: defaultEmail ?? '',
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<OnboardingFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAgencyName, setCreatedAgencyName] = useState<string | null>(
    null
  );

  function clearFieldError(field: OnboardingField) {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function handleNameChange(nextName: string) {
    setValues((prev) => ({
      ...prev,
      name: nextName,
      slug: slugTouched ? prev.slug : slugifyAgencyName(nextName),
    }));
    clearFieldError('name');
    if (!slugTouched) {
      clearFieldError('slug');
    }
    setServerError(null);
  }

  function handleSlugChange(nextSlug: string) {
    setSlugTouched(true);
    setValues((prev) => ({
      ...prev,
      slug: nextSlug.toLowerCase().replace(/\s+/g, '-'),
    }));
    clearFieldError('slug');
    setServerError(null);
  }

  function updateField<K extends OnboardingField>(
    field: K,
    nextValue: OnboardingAgencyInput[K]
  ) {
    setValues((prev) => ({ ...prev, [field]: nextValue }));
    clearFieldError(field);
    setServerError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submittingRef.current || isSubmitting || createdAgencyName) {
      return;
    }

    const clientCheck = validateOnboardingAgencyInput(values);
    if (!clientCheck.valid) {
      setFieldErrors(clientCheck.errors);
      setServerError(
        'Veuillez vérifier et compléter les champs obligatoires signalés ci-dessous.'
      );
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/onboarding/agency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const payload = (await response.json().catch(() => null)) as
        | OnboardingApiResponse
        | null;

      if (!response.ok || !payload?.ok) {
        if (payload?.fieldErrors) {
          setFieldErrors(payload.fieldErrors);
        }
        setServerError(
          payload?.error ??
            'Une erreur est survenue lors de la création de votre agence. Veuillez réessayer.'
        );
        submittingRef.current = false;
        setIsSubmitting(false);
        return;
      }

      setCreatedAgencyName(payload.agency?.name ?? values.name.trim());
      router.replace(payload.redirectTo ?? '/');
      router.refresh();
    } catch {
      setServerError(
        'Impossible de joindre le serveur. Vérifiez votre connexion internet et réessayez.'
      );
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  const slugPreview = values.slug.trim() || 'votre-agence';

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5 sm:space-y-6">
      {serverError ? (
        <AuthAlert variant="error" title="Création impossible">
          {serverError}
        </AuthAlert>
      ) : null}

      {createdAgencyName ? (
        <AuthAlert variant="success" title="Agence créée avec succès">
          <p>
            L’agence <strong>{createdAgencyName}</strong> est prête et vous avez
            été désigné en tant que <strong>Propriétaire</strong>. Redirection
            vers votre tableau de bord…
          </p>
        </AuthAlert>
      ) : null}

      {/* Section 1: Agency identity */}
      <Surface padded className="space-y-5">
        <div className="flex items-start gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50/80 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/60 dark:text-blue-300">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Identité et coordonnées de l’agence
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Ces informations créent votre espace agence isolé dans Supabase et
              vous attribuent automatiquement le rôle de Propriétaire.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            id="agency-name"
            label="Nom de l’agence"
            required
            errorText={fieldErrors.name}
          >
            <input
              id="agency-name"
              name="name"
              type="text"
              autoComplete="organization"
              value={values.name}
              onChange={(e) => handleNameChange(e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="Ex. Atlas Mobility Tunis"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={
                fieldErrors.name ? 'agency-name-error' : undefined
              }
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.name))
              )}
            />
          </FormField>

          <FormField
            id="agency-legal-name"
            label="Nom légal / Raison sociale (optionnel)"
            errorText={fieldErrors.legalName}
          >
            <input
              id="agency-legal-name"
              name="legalName"
              type="text"
              value={values.legalName ?? ''}
              onChange={(e) => updateField('legalName', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="Ex. Atlas Mobility SARL"
              aria-invalid={Boolean(fieldErrors.legalName)}
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.legalName))
              )}
            />
          </FormField>

          <FormField
            id="agency-slug"
            label="Identifiant unique (slug)"
            required
            helperText={`Identifiant unique : ${slugPreview} (minuscules, chiffres et tirets uniquement).`}
            errorText={fieldErrors.slug}
          >
            <input
              id="agency-slug"
              name="slug"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={values.slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="ex. atlas-mobility-tunis"
              aria-invalid={Boolean(fieldErrors.slug)}
              aria-describedby={
                fieldErrors.slug ? 'agency-slug-error' : 'agency-slug-help'
              }
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono',
                getInputStateClasses(Boolean(fieldErrors.slug))
              )}
            />
          </FormField>

          <FormField
            id="agency-tax-id"
            label="Matricule fiscal (optionnel)"
            helperText="Ex. format tunisien 1234567/A/M/000."
            errorText={fieldErrors.taxId}
          >
            <input
              id="agency-tax-id"
              name="taxId"
              type="text"
              value={values.taxId ?? ''}
              onChange={(e) => updateField('taxId', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="Ex. 1234567/A/M/000"
              aria-invalid={Boolean(fieldErrors.taxId)}
              aria-describedby={
                fieldErrors.taxId ? 'agency-tax-id-error' : 'agency-tax-id-help'
              }
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono',
                getInputStateClasses(Boolean(fieldErrors.taxId))
              )}
            />
          </FormField>

          <FormField
            id="agency-email"
            label="E-mail professionnel"
            required
            errorText={fieldErrors.email}
          >
            <input
              id="agency-email"
              name="email"
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(e) => updateField('email', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="contact@agence.tn"
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={
                fieldErrors.email ? 'agency-email-error' : undefined
              }
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.email))
              )}
            />
          </FormField>

          <FormField
            id="agency-phone"
            label="Téléphone"
            required
            errorText={fieldErrors.phone}
          >
            <input
              id="agency-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              value={values.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="+216 71 000 000"
              aria-invalid={Boolean(fieldErrors.phone)}
              aria-describedby={
                fieldErrors.phone ? 'agency-phone-error' : undefined
              }
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono tabular-nums',
                getInputStateClasses(Boolean(fieldErrors.phone))
              )}
            />
          </FormField>

          <FormField
            id="agency-city"
            label="Ville"
            required
            errorText={fieldErrors.city}
          >
            <input
              id="agency-city"
              name="city"
              type="text"
              autoComplete="address-level2"
              value={values.city}
              onChange={(e) => updateField('city', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="Ex. Tunis"
              aria-invalid={Boolean(fieldErrors.city)}
              aria-describedby={
                fieldErrors.city ? 'agency-city-error' : undefined
              }
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.city))
              )}
            />
          </FormField>

          <FormField
            id="agency-country"
            label="Pays"
            required
            errorText={fieldErrors.countryCode}
          >
            <select
              id="agency-country"
              name="countryCode"
              value={values.countryCode}
              onChange={(e) => updateField('countryCode', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              aria-invalid={Boolean(fieldErrors.countryCode)}
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.countryCode))
              )}
            >
              {SUPPORTED_COUNTRIES.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.labelFr} ({country.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            id="agency-address"
            label="Adresse"
            required
            errorText={fieldErrors.address}
            className="md:col-span-2"
          >
            <input
              id="agency-address"
              name="address"
              type="text"
              autoComplete="street-address"
              value={values.address}
              onChange={(e) => updateField('address', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              placeholder="Ex. Avenue Habib Bourguiba, Immeuble B, Tunis"
              aria-invalid={Boolean(fieldErrors.address)}
              aria-describedby={
                fieldErrors.address ? 'agency-address-error' : undefined
              }
              className={cn(
                INPUT_BASE_CLASSES,
                getInputStateClasses(Boolean(fieldErrors.address))
              )}
            />
          </FormField>
        </div>
      </Surface>

      {/* Section 2: Regional defaults */}
      <Surface padded className="space-y-5">
        <div className="flex items-start gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Globe className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Paramètres régionaux par défaut
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Préconfigurés pour la Tunisie : dinar tunisien à 3 décimales,
              fuseau Africa/Tunis et interface en français.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="default-currency" label="Devise et précision">
            <input
              id="default-currency"
              type="text"
              value="TND — 3 décimales (millimes)"
              readOnly
              disabled
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono',
                getInputStateClasses(false)
              )}
            />
          </FormField>

          <FormField id="default-timezone" label="Fuseau horaire">
            <input
              id="default-timezone"
              type="text"
              value="Africa/Tunis"
              readOnly
              disabled
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono',
                getInputStateClasses(false)
              )}
            />
          </FormField>

          <FormField id="default-locale" label="Langue par défaut">
            <input
              id="default-locale"
              type="text"
              value="Français (fr)"
              readOnly
              disabled
              className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
            />
          </FormField>

          <FormField
            id="agency-vat"
            label="TVA par défaut (%)"
            helperText="Valeur par défaut configurable pour démonstration (non présentée comme règle légale universelle)."
            errorText={fieldErrors.vatRatePercent}
          >
            <input
              id="agency-vat"
              name="vatRatePercent"
              type="text"
              inputMode="decimal"
              value={values.vatRatePercent ?? '19'}
              onChange={(e) => updateField('vatRatePercent', e.target.value)}
              disabled={isSubmitting || Boolean(createdAgencyName)}
              aria-invalid={Boolean(fieldErrors.vatRatePercent)}
              aria-describedby={
                fieldErrors.vatRatePercent
                  ? 'agency-vat-error'
                  : 'agency-vat-help'
              }
              className={cn(
                INPUT_BASE_CLASSES,
                'font-mono tabular-nums',
                getInputStateClasses(Boolean(fieldErrors.vatRatePercent))
              )}
            />
          </FormField>
        </div>
      </Surface>

      {/* Footer actions */}
      <Surface
        variant="subtle"
        padded
        className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <ShieldCheck
            className="h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400"
            aria-hidden="true"
          />
          <span>
            Création atomique sécurisée par PostgreSQL RLS · Rôle attribué :
            Propriétaire
          </span>
        </div>

        <Button
          type="submit"
          variant="primary"
          disabled={isSubmitting || Boolean(createdAgencyName)}
          className="w-full sm:w-auto sm:min-w-[220px]"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Création de l’agence…</span>
            </>
          ) : createdAgencyName ? (
            <>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Redirection…</span>
            </>
          ) : (
            <span>
              {isFirstAgency
                ? 'Créer mon agence'
                : 'Créer cette nouvelle agence'}
            </span>
          )}
        </Button>
      </Surface>
    </form>
  );
}
