'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatTndFromMillimes } from '@/lib/currency';
import { NAV_ITEMS } from '@/lib/navigation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { PageHeader } from '@/components/ui/page-header';
import { ModuleNotice } from '@/components/ui/module-notice';
import { StatStrip } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';
import { NavIcon } from '@/components/ui/nav-icon';

export function DashboardView() {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules.dashboard;
  const zeroTnd = formatTndFromMillimes(0, locale);

  const kpis = [
    {
      id: 'fleet',
      label: dict.dashboard.kpiFleet,
      value: '0',
      note: dict.dashboard.kpiSubZero,
    },
    {
      id: 'active-rentals',
      label: dict.dashboard.kpiActiveRentals,
      value: '0',
      note: dict.dashboard.kpiSubNoDb,
    },
    {
      id: 'returns-today',
      label: dict.dashboard.kpiPendingReturns,
      value: '0',
      note: dict.dashboard.kpiSubNoDb,
    },
    {
      id: 'monthly-revenue',
      label: dict.dashboard.kpiMonthlyRevenue,
      value: zeroTnd,
      note: dict.dashboard.kpiSubNoDb,
    },
  ];

  const operationalModules = NAV_ITEMS.filter((item) => item.key !== 'dashboard');

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase="Phase 2"
        action={
          <Link
            href="/settings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-medium text-white whitespace-nowrap shrink-0 transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 dark:bg-blue-600 dark:hover:bg-blue-500 dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950"
          >
            <span>{dict.modules.settings.title}</span>
          </Link>
        }
      />

      <ModuleNotice
        title={dict.common.phase1NoticeTitle}
        body={dict.common.phase1NoticeBody}
      />

      <section aria-labelledby="dashboard-metrics-heading" className="space-y-2.5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h2
            id="dashboard-metrics-heading"
            className="text-sm font-semibold text-slate-900 dark:text-slate-100"
          >
            {dict.dashboard.metricsHeading}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {dict.dashboard.metricsFootnote}
          </p>
        </div>
        <StatStrip items={kpis} />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Modules directory */}
        <Surface className="xl:col-span-2 overflow-hidden">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {dict.dashboard.modulesHeading}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {dict.dashboard.modulesSubheading}
            </p>
          </div>

          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {operationalModules.map((item) => {
              const copy = dict.modules[item.key];
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-start justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none dark:hover:bg-slate-800/50 dark:focus-visible:bg-slate-800/50"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600 transition-colors group-hover:border-blue-200 group-hover:text-blue-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400 dark:group-hover:border-blue-900 dark:group-hover:text-blue-400">
                        <NavIcon name={item.icon} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <span className="text-sm font-medium text-slate-950 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-400">
                            {copy.title}
                          </span>
                          <span className="text-xs text-slate-400 dark:text-slate-500">
                            · {dict.dashboard.statusFoundation} · {item.plannedPhase}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
                          {copy.plannedFeatureSummary}
                        </p>
                      </div>
                    </div>

                    <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-slate-500 group-hover:text-blue-700 dark:text-slate-400 dark:group-hover:text-blue-400">
                      <span className="hidden sm:inline">
                        {dict.dashboard.openModule}
                      </span>
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Surface>

        {/* Foundation readiness column */}
        <Surface className="overflow-hidden self-start">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {dict.dashboard.quickReadinessHeading}
            </h2>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {dict.dashboard.readinessItems.map((entry) => (
              <li key={entry.title} className="px-5 py-4 space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {entry.title}
                  </p>
                  <span className="font-mono text-xs text-slate-500 whitespace-nowrap dark:text-slate-400">
                    {entry.status}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {entry.detail}
                </p>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </div>
  );
}
