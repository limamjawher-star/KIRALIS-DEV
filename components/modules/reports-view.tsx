'use client';

import React, { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { formatTndFromMillimes } from '@/lib/currency';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModuleNotice } from '@/components/ui/module-notice';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatStrip } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

type ReportPeriod = 'month' | 'quarter' | 'year';

export function ReportsView() {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules.reports;
  const reportCopy = dict.tables.reports;
  const [period, setPeriod] = useState<ReportPeriod>('month');

  const zeroTnd = formatTndFromMillimes(0, locale);

  const periodOptions = [
    { value: 'month' as const, label: reportCopy.periods.month },
    { value: 'quarter' as const, label: reportCopy.periods.quarter },
    { value: 'year' as const, label: reportCopy.periods.year },
  ];

  const kpis = [
    {
      id: 'utilization',
      label: reportCopy.kpiUtilization,
      value: '—',
      note: dict.dashboard.kpiSubNoDb,
    },
    {
      id: 'revenue',
      label: reportCopy.kpiRevenue,
      value: zeroTnd,
      note: dict.dashboard.kpiSubNoDb,
    },
    {
      id: 'avg-duration',
      label: reportCopy.kpiAvgDuration,
      value: '—',
      note: dict.dashboard.kpiSubNoDb,
    },
    {
      id: 'maintenance-cost',
      label: reportCopy.kpiMaintenanceCost,
      value: zeroTnd,
      note: dict.dashboard.kpiSubNoDb,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase="Phase 5"
        action={
          <Button
            variant="secondary"
            disabled
            title={dict.common.upcomingActionNote}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>{reportCopy.exportLabel}</span>
          </Button>
        }
      />

      <ModuleNotice
        title={dict.common.phase1NoticeTitle}
        body={dict.common.phase1NoticeBody}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={periodOptions}
          value={period}
          onChange={setPeriod}
          ariaLabel={moduleCopy.title}
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {dict.dashboard.metricsFootnote}
        </p>
      </div>

      <StatStrip items={kpis} />

      <Surface className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] border-collapse text-start">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-950/60">
                {reportCopy.columns.map((col, idx) => (
                  <th
                    key={col}
                    scope="col"
                    className={cn(
                      'h-10 px-4 text-xs font-medium text-slate-500 whitespace-nowrap dark:text-slate-400',
                      idx >= 1 ? 'text-end' : 'text-start'
                    )}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={reportCopy.columns.length} className="p-0">
                  <EmptyState
                    icon={<BarChart3 className="h-5 w-5" aria-hidden="true" />}
                    title={moduleCopy.emptyTitle}
                    description={moduleCopy.emptyDescription}
                    meta={`${reportCopy.periods[period]} · ${dict.common.zeroRecords}`}
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}
