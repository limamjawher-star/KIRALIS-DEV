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
    'bg-[#F4F6FA] text-slate-950 dark:bg-slate-950/75 dark:text-slate-100'
  );

  return (
    <div className="space-y-6">
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
      <Surface className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-200 bg-[#F4F6FA] px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/60">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0B1220] text-blue-400 dark:bg-slate-800">
            <Building2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">
              {copy.identitySectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {copy.identitySectionDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2">
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
      <Surface className="overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-200 bg-[#F4F6FA] px-5 py-4 sm:px-6 dark:border-slate-800 dark:bg-slate-950/60">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Globe className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">
              {copy.regionalSectionTitle}
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              {copy.regionalSectionDesc}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:p-6 md:grid-cols-2">
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
      <Surface variant="dark" padded className="flex items-start gap-3.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-blue-400"
        >
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="space-y-1 text-xs text-slate-300">
          <p className="font-display text-sm font-bold text-white">
            Accès vérifié · Rôle {roleLabel}
          </p>
          <p className="leading-relaxed text-slate-400">
            Votre adhésion active à l’agence{' '}
            <strong className="font-semibold text-white">{agency.name}</strong>{' '}
            est vérifiée côté serveur à chaque requête via Supabase Auth et les
            politiques Row Level Security (RLS).
          </p>
        </div>
      </Surface>
    </div>
  );
}
