'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, Building2, CheckCircle2, Settings } from 'lucide-react';
import {
  formatAgencyRoleLabel,
  formatCountryLabel,
  formatVatRateFromBps,
  type AgencyDashboardStats,
  type AgencyRecord,
  type AgencyRole,
} from '@/lib/agency/types';
import { NAV_ITEMS } from '@/lib/navigation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { NavIcon } from '@/components/ui/nav-icon';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip, type StatStripItem } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';

export interface DashboardViewProps {
  agency: AgencyRecord;
  role: AgencyRole;
  stats: AgencyDashboardStats;
}

const CONNECTED_MODULE_KEYS = new Set(['vehicles', 'customers', 'settings']);

export function DashboardView({ agency, role, stats }: DashboardViewProps) {
  const { dict, locale } = useAppPreferences();
  const roleLabel = formatAgencyRoleLabel(role, locale);
  const countryLabel = formatCountryLabel(agency.country_code, locale);
  const vatLabel = formatVatRateFromBps(agency.vat_rate_bps, locale);

  const countNote = (count: number) =>
    count === 0
      ? '0 enregistré · Supabase'
      : `${count} enregistré${count > 1 ? 's' : ''} · Supabase`;

  const kpis: StatStripItem[] = [
    {
      id: 'vehicles',
      label: dict.dashboard.kpiFleet,
      value: String(stats.vehicleCount),
      note: countNote(stats.vehicleCount),
      tone: stats.vehicleCount > 0 ? 'brand' : 'default',
    },
    {
      id: 'customers',
      label: dict.modules.customers.title,
      value: String(stats.customerCount),
      note: countNote(stats.customerCount),
    },
    {
      id: 'reservations',
      label: dict.modules.reservations.title,
      value: String(stats.reservationCount),
      note: countNote(stats.reservationCount),
    },
    {
      id: 'active-rentals',
      label: dict.dashboard.kpiActiveRentals,
      value: String(stats.activeRentalCount),
      note:
        stats.activeRentalCount === 0
          ? 'Aucune location active'
          : `${stats.activeRentalCount} en cours`,
      tone: stats.activeRentalCount > 0 ? 'success' : 'default',
    },
  ];

  const operationalModules = NAV_ITEMS.filter(
    (item) => item.key !== 'dashboard'
  );

  const locationSummary = [agency.city, countryLabel]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={agency.name}
        description={`Tableau de bord opérationnel de votre agence${locationSummary ? ` (${locationSummary})` : ''}. Les compteurs ci-dessous reflètent uniquement vos enregistrements réels dans Supabase.`}
        meta={`Agence active · Rôle : ${roleLabel} · Identifiant : ${agency.slug}`}
        action={
          <Link
            href="/settings"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-medium text-white whitespace-nowrap shrink-0 shadow-[0_1px_2px_rgba(29,78,216,0.28)] transition-[background-color,transform] duration-150 hover:bg-blue-800 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 focus-visible:ring-offset-2 sm:h-10 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus-visible:ring-blue-400/50 dark:focus-visible:ring-offset-slate-950"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            <span>{dict.modules.settings.title}</span>
          </Link>
        }
      />

      <section
        aria-labelledby="dashboard-metrics-heading"
        className="space-y-2.5"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="dashboard-metrics-heading"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {dict.dashboard.metricsHeading}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Données en direct isolées par agence via PostgreSQL RLS (aucune
            statistique simulée).
          </p>
        </div>
        <StatStrip items={kpis} />
      </section>

      <div className="grid grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-3">
        {/* Modules directory */}
        <Surface className="xl:col-span-2 overflow-hidden">
          <div className="border-b border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
            <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              {dict.dashboard.modulesHeading}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Espace multi-agences actif. Les modules métier sont activés
              progressivement au fil des phases.
            </p>
          </div>

          <ul className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
            {operationalModules.map((item) => {
              const copy = dict.modules[item.key];
              const isConnected = CONNECTED_MODULE_KEYS.has(item.key);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-start justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50/90 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/45 dark:focus-visible:bg-slate-800/45"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={
                          isConnected
                            ? 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200/80 bg-blue-50/80 text-blue-700 transition-colors group-hover:bg-blue-100/80 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-400'
                            : 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-slate-50 text-slate-500 transition-colors group-hover:border-slate-300 group-hover:text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:group-hover:border-slate-700 dark:group-hover:text-slate-200'
                        }
                      >
                        <NavIcon name={item.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-950 transition-colors group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-400">
                            {copy.title}
                          </span>
                          <span
                            className={
                              isConnected
                                ? 'text-xs font-medium text-emerald-700 dark:text-emerald-400'
                                : 'text-xs text-slate-400 dark:text-slate-500'
                            }
                          >
                            {isConnected
                              ? '· Connecté à Supabase'
                              : `· À venir (${item.plannedPhase})`}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {copy.plannedFeatureSummary}
                        </p>
                      </div>
                    </div>

                    <span className="mt-1.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-400 transition-colors group-hover:text-blue-700 dark:text-slate-500 dark:group-hover:text-blue-400">
                      <span className="hidden sm:inline">
                        {dict.dashboard.openModule}
                      </span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 rtl:-scale-x-100"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Surface>

        {/* Real Supabase Agency Profile & Settings Summary */}
        <Surface className="overflow-hidden self-start">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 px-5 py-4 dark:border-slate-800/80">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400"
              >
                <Building2 className="h-4 w-4" />
              </span>
              <h2 className="truncate font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                Profil de l’agence
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200/90 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 whitespace-nowrap dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              Actif
            </span>
          </div>

          <dl className="divide-y divide-slate-200/80 text-sm dark:divide-slate-800/80">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Nom commercial
              </dt>
              <dd className="text-end font-semibold text-slate-900 dark:text-slate-100">
                {agency.name}
              </dd>
            </div>

            {agency.legal_name ? (
              <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  Nom légal
                </dt>
                <dd className="text-end text-xs font-medium text-slate-800 dark:text-slate-200">
                  {agency.legal_name}
                </dd>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Identifiant (slug)
              </dt>
              <dd className="font-mono text-xs text-slate-800 dark:text-slate-200">
                {agency.slug}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Votre rôle
              </dt>
              <dd className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {roleLabel}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Localisation
              </dt>
              <dd className="text-end text-xs text-slate-800 dark:text-slate-200">
                {locationSummary || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                E-mail pro
              </dt>
              <dd className="truncate text-end text-xs text-slate-800 dark:text-slate-200">
                {agency.email || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Téléphone
              </dt>
              <dd className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                {agency.phone || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Devise & précision
              </dt>
              <dd className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                {agency.currency_code} ({agency.currency_minor_unit} déc.)
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs text-slate-500 dark:text-slate-400">
                Fuseau horaire
              </dt>
              <dd className="font-mono text-xs text-slate-800 dark:text-slate-200">
                {agency.timezone}
              </dd>
            </div>

            <div className="space-y-1 px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs text-slate-500 dark:text-slate-400">
                  TVA configurable
                </dt>
                <dd className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                  {vatLabel}
                </dd>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Paramètre par défaut configurable (non universel).
              </p>
            </div>
          </dl>

          <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-3 dark:border-slate-800/80 dark:bg-slate-950/50">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>Consulter tous les paramètres de l’agence</span>
              <ArrowUpRight
                className="h-3.5 w-3.5 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </Link>
          </div>
        </Surface>
      </div>
    </div>
  );
}
