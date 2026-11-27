'use client';

import React from 'react';
import { Building2, Globe, ShieldCheck } from 'lucide-react';
import {
  formatAgencyRoleLabel,
  formatCountryLabel,
  formatVatRateFromBps,
  type AgencyRecord,
  type AgencyRole,
} from '@/lib/agency/types';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import {
  FormField,
  INPUT_BASE_CLASSES,
  getInputStateClasses,
} from '@/components/ui/form-field';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

export interface SettingsViewProps {
  agency: AgencyRecord;
  role: AgencyRole;
}

const LOCALE_NAMES: Record<'fr' | 'en' | 'ar', string> = {
  fr: 'Français (FR)',
  en: 'English (EN)',
  ar: 'العربية (AR)',
};

export function SettingsView({ agency, role }: SettingsViewProps) {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules.settings;
  const copy = dict.settings;
  const roleLabel = formatAgencyRoleLabel(role, locale);
  const countryLabel = formatCountryLabel(agency.country_code, locale);
  const vatFormatted = formatVatRateFromBps(agency.vat_rate_bps, locale);

  const createdDate = new Intl.DateTimeFormat('fr-TN', {
    dateStyle: 'long',
    timeZone: agency.timezone || 'Africa/Tunis',
  }).format(new Date(agency.created_at));

  const readOnlyInputClass = cn(
    INPUT_BASE_CLASSES,
    getInputStateClasses(false),
    'bg-slate-50/90 text-slate-900 dark:bg-slate-950/70 dark:text-slate-100'
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`${moduleCopy.title} — ${agency.name}`}
        description="Paramètres persistés de votre agence chargés en direct depuis Supabase PostgreSQL avec isolation par agence (RLS)."
        meta={`Agence active · Rôle : ${roleLabel} · Créée le ${createdDate}`}
      />

      <AlertBanner
        variant="success"
        title="Agence synchronisée avec Supabase PostgreSQL"
      >
        Les informations ci-dessous proviennent directement de votre fiche
        agence enregistrée lors de l’onboarding. L’édition avancée des
        paramètres et la gestion d’équipe seront ajoutées lors de la phase
        dédiée.
      </AlertBanner>

      {/* Identity section */}
      <Surface padded className="space-y-5">
        <div className="flex items-start gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50/80 text-blue-700 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {copy.identitySectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {copy.identitySectionDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="settings-agency-name" label={copy.fields.agencyName}>
            <input
              id="settings-agency-name"
              type="text"
              value={agency.name}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField id="settings-legal-name" label={copy.fields.legalName}>
            <input
              id="settings-legal-name"
              type="text"
              value={agency.legal_name ?? 'Non renseigné'}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField
            id="settings-slug"
            label="Identifiant unique (slug)"
            helperText="Identifiant unique de votre espace agence."
          >
            <input
              id="settings-slug"
              type="text"
              value={agency.slug}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono')}
            />
          </FormField>

          <FormField
            id="settings-tax-id"
            label={copy.fields.taxId}
            helperText={copy.fields.taxIdHelp}
          >
            <input
              id="settings-tax-id"
              type="text"
              value={agency.tax_id ?? 'Non renseigné'}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono')}
            />
          </FormField>

          <FormField id="settings-email" label={copy.fields.email}>
            <input
              id="settings-email"
              type="email"
              value={agency.email ?? 'Non renseigné'}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField id="settings-phone" label={copy.fields.phone}>
            <input
              id="settings-phone"
              type="tel"
              value={agency.phone ?? 'Non renseigné'}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono tabular-nums')}
            />
          </FormField>

          <FormField id="settings-city" label={copy.fields.city}>
            <input
              id="settings-city"
              type="text"
              value={agency.city ?? 'Non renseignée'}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField id="settings-country" label="Pays">
            <input
              id="settings-country"
              type="text"
              value={`${countryLabel} (${agency.country_code})`}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField
            id="settings-address"
            label={copy.fields.address}
            className="md:col-span-2"
          >
            <input
              id="settings-address"
              type="text"
              value={agency.address ?? 'Non renseignée'}
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>
        </div>
      </Surface>

      {/* Regional & tax defaults */}
      <Surface padded className="space-y-5">
        <div className="flex items-start gap-3 border-b border-slate-200/80 pb-4 dark:border-slate-800/80">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <Globe className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {copy.regionalSectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {copy.regionalSectionDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField id="settings-currency" label={copy.fields.currency}>
            <input
              id="settings-currency"
              type="text"
              value={`${agency.currency_code} (${agency.currency_minor_unit} décimales)`}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono tabular-nums')}
            />
          </FormField>

          <FormField id="settings-timezone" label={copy.fields.timezone}>
            <input
              id="settings-timezone"
              type="text"
              value={agency.timezone}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono')}
            />
          </FormField>

          <FormField
            id="settings-default-language"
            label={copy.fields.defaultLanguage}
          >
            <input
              id="settings-default-language"
              type="text"
              value={
                LOCALE_NAMES[agency.default_locale] ?? agency.default_locale
              }
              readOnly
              className={readOnlyInputClass}
            />
          </FormField>

          <FormField
            id="settings-vat"
            label={copy.fields.vatRatePercent}
            helperText="Valeur par défaut configurable pour démonstration (non présentée comme règle légale universelle)."
          >
            <input
              id="settings-vat"
              type="text"
              value={vatFormatted}
              readOnly
              className={cn(readOnlyInputClass, 'font-mono tabular-nums')}
            />
          </FormField>
        </div>
      </Surface>

      {/* Tenant Security Summary */}
      <Surface variant="subtle" padded className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-100/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="space-y-0.5 text-xs text-slate-600 dark:text-slate-400">
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Accès vérifié · Rôle {roleLabel}
          </p>
          <p className="leading-relaxed">
            Votre adhésion active à l’agence <strong>{agency.name}</strong> est
            vérifiée côté serveur à chaque requête via Supabase Auth et les
            politiques Row Level Security (RLS).
          </p>
        </div>
      </Surface>
    </div>
  );
}
