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
import type { SupportedLocale } from '@/lib/currency';
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

const CONNECTED_MODULE_KEYS = new Set(['vehicles', 'customers', 'reservations', 'calendar', 'reports', 'settings']);

interface DashboardLocalizedCopy {
  headerDescription: (location: string) => string;
  headerMeta: (role: string, slug: string) => string;
  metricsLiveNote: string;
  countRecorded: (count: number) => string;
  noActiveRentals: string;
  activeRentalsCount: (count: number) => string;
  activeWorkspacesTitle: string;
  activeWorkspacesSubtitle: (agencyName: string) => string;
  activeCountBadge: (count: number) => string;
  vehicleCountLabel: (count: number) => string;
  customerCountLabel: (count: number) => string;
  statusActive: string;
  roadmapSubtitle: string;
  agencyProfileTitle: string;
  tradeNameLabel: string;
  legalNameLabel: string;
  roleLabel: string;
  locationLabel: string;
  emailLabel: string;
  phoneLabel: string;
  currencyLabel: string;
  decimalsShort: string;
  timezoneLabel: string;
  vatLabel: string;
  vatHelper: string;
  allSettingsLink: string;
}

const DASHBOARD_COPY: Record<SupportedLocale, DashboardLocalizedCopy> = {
  fr: {
    headerDescription: (location) =>
      `Centre de pilotage opérationnel de votre agence${location ? ` (${location})` : ''}. Suivez votre flotte, vos dossiers clients et vos paramètres en temps réel.`,
    headerMeta: (role, slug) => `Agence active · ${role} · ${slug}`,
    metricsLiveNote: 'Indicateurs en direct de votre espace agence',
    countRecorded: (count) =>
      count === 0
        ? 'Aucun dossier enregistré'
        : `${count} enregistré${count > 1 ? 's' : ''}`,
    noActiveRentals: 'Aucune location en cours',
    activeRentalsCount: (count) => `${count} en cours`,
    activeWorkspacesTitle: 'Espaces opérationnels actifs',
    activeWorkspacesSubtitle: (agencyName) =>
      `Modules disponibles pour l’exploitation quotidienne de ${agencyName}.`,
    activeCountBadge: (count) => `${count} actifs`,
    vehicleCountLabel: (count) => `${count} véhicule${count > 1 ? 's' : ''}`,
    customerCountLabel: (count) => `${count} client${count > 1 ? 's' : ''}`,
    statusActive: 'Actif',
    roadmapSubtitle:
      'Prochains modules opérationnels prévus dans votre espace agence.',
    agencyProfileTitle: 'Profil de l’agence',
    tradeNameLabel: 'Nom commercial',
    legalNameLabel: 'Nom légal',
    roleLabel: 'Votre rôle',
    locationLabel: 'Localisation',
    emailLabel: 'E-mail pro',
    phoneLabel: 'Téléphone',
    currencyLabel: 'Devise & précision',
    decimalsShort: 'déc.',
    timezoneLabel: 'Fuseau horaire',
    vatLabel: 'TVA configurable',
    vatHelper: 'Taux par défaut configurable selon votre régime fiscal.',
    allSettingsLink: 'Consulter tous les paramètres de l’agence',
  },
  en: {
    headerDescription: (location) =>
      `Operational control center for your agency${location ? ` (${location})` : ''}. Monitor fleet readiness, customer dossiers, and agency settings in real time.`,
    headerMeta: (role, slug) => `Active agency · ${role} · ${slug}`,
    metricsLiveNote: 'Live indicators scoped to your agency workspace',
    countRecorded: (count) =>
      count === 0 ? 'No records yet' : `${count} recorded`,
    noActiveRentals: 'No active rentals',
    activeRentalsCount: (count) => `${count} in progress`,
    activeWorkspacesTitle: 'Active operational workspaces',
    activeWorkspacesSubtitle: (agencyName) =>
      `Ready-to-use modules for daily operations at ${agencyName}.`,
    activeCountBadge: (count) => `${count} active`,
    vehicleCountLabel: (count) => `${count} vehicle${count === 1 ? '' : 's'}`,
    customerCountLabel: (count) => `${count} customer${count === 1 ? '' : 's'}`,
    statusActive: 'Active',
    roadmapSubtitle:
      'Upcoming operational modules scheduled within this agency workspace.',
    agencyProfileTitle: 'Agency profile',
    tradeNameLabel: 'Commercial name',
    legalNameLabel: 'Legal name',
    roleLabel: 'Your role',
    locationLabel: 'Location',
    emailLabel: 'Business email',
    phoneLabel: 'Phone',
    currencyLabel: 'Currency & precision',
    decimalsShort: 'dec.',
    timezoneLabel: 'Timezone',
    vatLabel: 'Configurable VAT',
    vatHelper: 'Configurable default tax rate for agency billing.',
    allSettingsLink: 'Manage all agency settings',
  },
  ar: {
    headerDescription: (location) =>
      `مركز القيادة التشغيلية لوكالتك${location ? ` (${location})` : ''}. تابع الأسطول وملفات العملاء والإعدادات بشكل مباشر.`,
    headerMeta: (role, slug) => `وكالة نشطة · ${role} · ${slug}`,
    metricsLiveNote: 'مؤشرات مباشرة خاصة بمساحة عمل وكالتك',
    countRecorded: (count) =>
      count === 0 ? 'لا توجد سجلات بعد' : `${count} مسجل`,
    noActiveRentals: 'لا توجد إيجارات نشطة',
    activeRentalsCount: (count) => `${count} قيد التنفيذ`,
    activeWorkspacesTitle: 'مساحات العمل التشغيلية النشطة',
    activeWorkspacesSubtitle: (agencyName) =>
      `الوحدات المتاحة حالياً للعمليات اليومية في ${agencyName}.`,
    activeCountBadge: (count) => `${count} نشطة`,
    vehicleCountLabel: (count) => `${count} مركبة`,
    customerCountLabel: (count) => `${count} عميل`,
    statusActive: 'نشط',
    roadmapSubtitle:
      'الوحدات التشغيلية القادمة ضمن خارطة تطوير مساحة الوكالة.',
    agencyProfileTitle: 'ملف الوكالة',
    tradeNameLabel: 'الاسم التجاري',
    legalNameLabel: 'الاسم القانوني',
    roleLabel: 'دورك',
    locationLabel: 'الموقع',
    emailLabel: 'البريد المهني',
    phoneLabel: 'الهاتف',
    currencyLabel: 'العملة والدقة',
    decimalsShort: 'أرقام عشرية',
    timezoneLabel: 'المنطقة الزمنية',
    vatLabel: 'ضريبة القيمة المضافة',
    vatHelper: 'نسبة افتراضية قابلة للتعديل حسب نظامك الضريبي.',
    allSettingsLink: 'عرض جميع إعدادات الوكالة',
  },
};

export function DashboardView({ agency, role, stats }: DashboardViewProps) {
  const { dict, locale } = useAppPreferences();
  const copy = DASHBOARD_COPY[locale];
  const roleLabel = formatAgencyRoleLabel(role, locale);
  const countryLabel = formatCountryLabel(agency.country_code, locale);
  const vatLabel = formatVatRateFromBps(agency.vat_rate_bps, locale);

  const kpis: StatStripItem[] = [
    {
      id: 'vehicles',
      label: dict.dashboard.kpiFleet,
      value: String(stats.vehicleCount),
      note: copy.countRecorded(stats.vehicleCount),
      tone: 'brand',
    },
    {
      id: 'customers',
      label: dict.modules.customers.title,
      value: String(stats.customerCount),
      note: copy.countRecorded(stats.customerCount),
      tone: stats.customerCount > 0 ? 'brand' : 'default',
    },
    {
      id: 'reservations',
      label: dict.modules.reservations.title,
      value: String(stats.reservationCount),
      note: copy.countRecorded(stats.reservationCount),
    },
    {
      id: 'active-rentals',
      label: dict.dashboard.kpiActiveRentals,
      value: String(stats.activeRentalCount),
      note:
        stats.activeRentalCount === 0
          ? copy.noActiveRentals
          : copy.activeRentalsCount(stats.activeRentalCount),
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
        description={copy.headerDescription(locationSummary)}
        meta={copy.headerMeta(roleLabel, agency.slug)}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/vehicles"
              className="inline-flex h-11 sm:h-10 items-center justify-center gap-2 rounded-xl bg-[#1D4ED8] px-4 text-sm font-semibold text-white whitespace-nowrap shrink-0 border border-[#1E40AF] shadow-[0_1px_2px_rgba(11,18,32,0.18)] transition-[background-color,transform] duration-150 hover:bg-[#1E40AF] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <Car className="h-4 w-4" aria-hidden="true" />
              <span>{dict.modules.vehicles.title}</span>
            </Link>
            <Link
              href="/customers"
              className="inline-flex h-11 sm:h-10 items-center justify-center gap-2 rounded-xl border border-slate-300/90 bg-white px-4 text-sm font-semibold text-slate-900 whitespace-nowrap shrink-0 shadow-[0_1px_2px_rgba(11,18,32,0.05)] transition-[background-color,border-color,transform] duration-150 hover:border-slate-400 hover:bg-slate-50 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <Users className="h-4 w-4" aria-hidden="true" />
              <span>{dict.modules.customers.title}</span>
            </Link>
            <Link
              href="/settings"
              className="inline-flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-slate-300/90 bg-white text-slate-700 shrink-0 shadow-[0_1px_2px_rgba(11,18,32,0.05)] transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {copy.metricsLiveNote}
          </p>
        </div>
        <StatStrip items={kpis} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left 2 cols: Active operational workspaces + compact roadmap */}
        <div className="space-y-6 xl:col-span-2">
          {/* Active connected modules */}
          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                  {copy.activeWorkspacesTitle}
                </h2>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                  {copy.activeWorkspacesSubtitle(agency.name)}
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-emerald-700 tabular-nums whitespace-nowrap dark:text-emerald-400">
                {copy.activeCountBadge(activeModules.length)}
              </span>
            </div>

            <div className="grid grid-cols-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0 dark:divide-slate-800">
              {activeModules.map((item) => {
                const modCopy = dict.modules[item.key];
                const metricText =
                  item.key === 'vehicles'
                    ? copy.vehicleCountLabel(stats.vehicleCount)
                    : item.key === 'customers'
                      ? copy.customerCountLabel(stats.customerCount)
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
                          <NavIcon
                            name={item.icon}
                            className="h-[18px] w-[18px]"
                          />
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1D4ED8] rtl:-scale-x-100 dark:text-slate-500 dark:group-hover:text-blue-400"
                          aria-hidden="true"
                        />
                      </div>
                      <div>
                        <h3 className="font-display text-sm font-bold text-slate-950 transition-colors group-hover:text-[#1D4ED8] dark:text-white dark:group-hover:text-blue-400">
                          {modCopy.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                          {modCopy.plannedFeatureSummary}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200/80 pt-3 text-xs dark:border-slate-800">
                      <span className="font-mono font-semibold text-slate-900 tabular-nums dark:text-slate-200">
                        {metricText}
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        {copy.statusActive}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </Surface>

          {/* Compact 2-column Upcoming Modules Roadmap */}
          <Surface className="overflow-hidden">
            <div className="border-b border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <h2 className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
                {dict.dashboard.modulesHeading}
              </h2>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                {copy.roadmapSubtitle}
              </p>
            </div>

            <ul className="grid grid-cols-1 gap-px bg-slate-200/80 sm:grid-cols-2 dark:bg-slate-800/80">
              {upcomingModules.map((item) => {
                const modCopy = dict.modules[item.key];
                return (
                  <li key={item.key} className="bg-white dark:bg-[#0F172A]">
                    <Link
                      href={item.href}
                      className="group flex h-full items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/45"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-[#F4F6FA] text-slate-600 transition-colors group-hover:border-slate-300 group-hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:group-hover:text-white">
                          <NavIcon name={item.icon} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-[13px] font-semibold text-slate-900 transition-colors group-hover:text-[#1D4ED8] dark:text-slate-100 dark:group-hover:text-blue-400">
                              {modCopy.title}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              · {item.plannedPhase}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[11px] text-slate-600 dark:text-slate-400">
                            {modCopy.plannedFeatureSummary}
                          </p>
                        </div>
                      </div>

                      <ArrowUpRight
                        className="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1D4ED8] rtl:-scale-x-100 dark:text-slate-500 dark:group-hover:text-blue-400"
                        aria-hidden="true"
                      />
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
                    {copy.agencyProfileTitle}
                  </h2>
                  <p
                    dir="ltr"
                    className="truncate font-mono text-[11px] text-slate-400 rtl:text-right"
                  >
                    {agency.slug}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 whitespace-nowrap">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                {copy.statusActive}
              </span>
            </div>
          </div>

          <dl className="divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.tradeNameLabel}
              </dt>
              <dd className="text-end text-xs font-semibold text-slate-950 dark:text-white">
                {agency.name}
              </dd>
            </div>

            {agency.legal_name ? (
              <div className="flex items-baseline justify-between gap-3 px-5 py-3">
                <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {copy.legalNameLabel}
                </dt>
                <dd className="text-end text-xs font-medium text-slate-800 dark:text-slate-200">
                  {agency.legal_name}
                </dd>
              </div>
            ) : null}

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.roleLabel}
              </dt>
              <dd className="text-xs font-bold text-[#1D4ED8] dark:text-blue-400">
                {roleLabel}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.locationLabel}
              </dt>
              <dd className="text-end text-xs font-medium text-slate-800 dark:text-slate-200">
                {locationSummary || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.emailLabel}
              </dt>
              <dd
                dir="ltr"
                className="truncate text-end text-xs text-slate-800 dark:text-slate-200"
              >
                {agency.email || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.phoneLabel}
              </dt>
              <dd
                dir="ltr"
                className="font-mono text-xs tabular-nums text-slate-800 dark:text-slate-200"
              >
                {agency.phone || '—'}
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.currencyLabel}
              </dt>
              <dd className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {agency.currency_code} ({agency.currency_minor_unit}{' '}
                {copy.decimalsShort})
              </dd>
            </div>

            <div className="flex items-baseline justify-between gap-3 px-5 py-3">
              <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                {copy.timezoneLabel}
              </dt>
              <dd
                dir="ltr"
                className="font-mono text-xs text-slate-800 dark:text-slate-200"
              >
                {agency.timezone}
              </dd>
            </div>

            <div className="space-y-1 px-5 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  {copy.vatLabel}
                </dt>
                <dd className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                  {vatLabel}
                </dd>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {copy.vatHelper}
              </p>
            </div>
          </dl>

          <div className="border-t border-slate-200 bg-[#F4F6FA] px-5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
            <Link
              href="/settings"
              className="inline-flex min-h-[36px] items-center gap-1.5 text-xs font-semibold text-[#1D4ED8] hover:text-[#1E40AF] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>{copy.allSettingsLink}</span>
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
