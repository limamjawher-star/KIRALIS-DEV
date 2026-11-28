'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Building2,
  Car,
  CheckCircle2,
  Settings,
  Users,
} from 'lucide-react';
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
      tone: 'brand',
    },
    {
      id: 'customers',
      label: dict.modules.customers.title,
      value: String(stats.customerCount),
      note: countNote(stats.customerCount),
      tone: stats.customerCount > 0 ? 'brand' : 'default',
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
  const activeModules = operationalModules.filter((item) =>
    CONNECTED_MODULE_KEYS.has(item.key)
  );
  const upcomingModules = operationalModules.filter(
    (item) => !CONNECTED_MODULE_KEYS.has(item.key)
  );

  const locationSummary = [agency.city, countryLabel]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <PageHeader
        title={agency.name}
        description={`Centre de pilotage opérationnel de votre agence${locationSummary ? ` (${locationSummary})` : ''}. Tous les compteurs proviennent directement de vos tables Supabase isolées par RLS.`}
        meta={`Agence active · Rôle : ${roleLabel} · Identifiant : ${agency.slug}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/vehicles"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 text-sm font-semibold text-white whitespace-nowrap shrink-0 border border-[#1E40AF] shadow-[0_1px_2px_rgba(11,18,32,0.18)] transition-[background-color,transform] duration-150 hover:bg-[#1E40AF] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Car className="h-4 w-4" aria-hidden="true" />
              <span>{dict.modules.vehicles.title}</span>
            </Link>
            <Link
              href="/customers"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300/90 bg-white px-4 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0 shadow-[0_1px_2px_rgba(11,18,32,0.05)] transition-[background-color,border-color,transform] duration-150 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>{dict.modules.customers.title}</span>
            </Link>
            <Link
              href="/settings"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300/90 bg-white text-slate-700 shrink-0 shadow-[0_1px_2px_rgba(11,18,32,0.05)] transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              aria-label={dict.modules.settings.title}
              title={dict.modules.settings.title}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        }
      />

      <section
        aria-labelledby="dashboard-metrics-heading"
        className="space-y-3"
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="dashboard-metrics-heading"
            className="font-display text-sm font-bold text-slate-950 dark:text-white"
          >
            {dict.dashboard.metricsHeading}
          </h2>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Données en direct isolées par agence via PostgreSQL RLS
          </p>
        </div>
        <StatStrip items={kpis} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 cols: Active operational workspaces + upcoming roadmap */}
        <div className="space-y-6 xl:col-span-2">
          {/* Active connected modules */}
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div>
                <h2 className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                  Espaces opérationnels actifs
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  Connectés en temps réel à Supabase PostgreSQL pour {agency.name}.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap dark:text-emerald-400">
                {activeModules.length} actifs
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800">
              {activeModules.map((item) => {
                const copy = dict.modules[item.key];
                const metricText =
                  item.key === 'vehicles'
                    ? `${stats.vehicleCount} véhicule${stats.vehicleCount > 1 ? 's' : ''}`
                    : item.key === 'customers'
                      ? `${stats.customerCount} client${stats.customerCount > 1 ? 's' : ''}`
                      : roleLabel;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="group flex flex-col justify-between gap-4 p-5 transition-colors hover:bg-blue-50/45 focus-visible:bg-blue-50/45 focus-visible:outline-none dark:hover:bg-slate-800/50"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0B1220] text-blue-400 transition-colors group-hover:bg-[#1D4ED8] group-hover:text-white dark:bg-slate-800 dark:text-blue-400 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                          <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1D4ED8] rtl:-scale-x-100 dark:text-slate-500 dark:group-hover:text-blue-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-950 transition-colors group-hover:text-[#1D4ED8] dark:text-white dark:group-hover:text-blue-400">
                          {copy.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {copy.plannedFeatureSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs dark:border-slate-800">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-200">
                        {metricText}
                      </span>
                      <span className="font-medium text-emerald-700 dark:text-emerald-400">
                        Actif
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Surface>

          {/* Upcoming operational modules */}
          <Surface className="overflow-hidden">
            <div className="border-b border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <h2 className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                {dict.dashboard.modulesHeading}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                Modules en préparation progressive dans le même espace agence.
              </p>
            </div>

            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {upcomingModules.map((item) => {
                const copy = dict.modules[item.key];
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="group flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/45"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-[#F4F6FA] text-slate-600 transition-colors group-hover:border-slate-400 group-hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:text-white">
                          <NavIcon name={item.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-sm font-semibold text-slate-950 transition-colors group-hover:text-[#1D4ED8] dark:text-slate-100 dark:group-hover:text-blue-400">
                              {copy.title}
                            </span>
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                              · {item.plannedPhase}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
                            {copy.plannedFeatureSummary}
                          </p>
                        </div>
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500 transition-colors group-hover:text-[#1D4ED8] dark:text-slate-400 dark:group-hover:text-blue-400">
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
        </div>

        {/* Right column: Executive Agency Profile Card */}
        <Surface className="overflow-hidden self-start">
          <div className="bg-[#0B1220] px-5 py-4 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-blue-400"
                >
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate font-display text-sm font-bold tracking-tight text-white">
                    Profil de l’agence
                  </h2>
                  <p className="truncate font-mono text-[11px] text-slate-400">
                    {agency.slug}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 whitespace-nowrap">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Actif
              </span>
            </div>
          </div>

          <dl className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Nom commercial
              </dt>
              <dd className="text-end text-xs font-semibold text-slate-950 dark:text-white">
                {agency.name}
              </dd>
            </div>

            {agency.legal_name ? (
              <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Nom légal
                </dt>
                <dd className="text-end text-xs font-medium text-slate-800 dark:text-slate-200">
                  {agency.legal_name}
                </dd>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Votre rôle
              </dt>
              <dd className="text-xs font-bold text-[#1D4ED8] dark:text-blue-400">
                {roleLabel}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Localisation
              </dt>
              <dd className="text-end text-xs font-medium text-slate-800 dark:text-slate-200">
                {locationSummary || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                E-mail pro
              </dt>
              <dd className="truncate text-end text-xs text-slate-800 dark:text-slate-200">
                {agency.email || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Téléphone
              </dt>
              <dd className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200">
                {agency.phone || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Devise & précision
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {agency.currency_code} ({agency.currency_minor_unit} déc.)
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Fuseau horaire
              </dt>
              <dd className="font-mono text-xs text-slate-800 dark:text-slate-200">
                {agency.timezone}
              </dd>
            </div>

            <div className="space-y-1 px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  TVA configurable
                </dt>
                <dd className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {vatLabel}
                </dd>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Paramètre par défaut configurable (non universel).
              </p>
            </div>
          </dl>

          <div className="border-t border-slate-200 bg-[#F4F6FA] px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
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
