'use client';

import React from 'react';
import { Plus } from 'lucide-react';
import { formatTndFromMillimes } from '@/lib/currency';
import { NAV_ITEMS, type ModuleKey } from '@/lib/navigation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { ModuleDataTable, type TableColumnDef } from '@/components/ui/data-table';
import { ModuleNotice } from '@/components/ui/module-notice';
import { NavIcon } from '@/components/ui/nav-icon';
import { PageHeader } from '@/components/ui/page-header';
import { StatStrip } from '@/components/ui/stat-strip';

export type TableModuleKey =
  | 'vehicles'
  | 'customers'
  | 'reservations'
  | 'contracts'
  | 'payments'
  | 'maintenance';

const RIGHT_ALIGNED_COLUMNS: Record<TableModuleKey, readonly number[]> = {
  vehicles: [3, 4],
  customers: [4],
  reservations: [4],
  contracts: [3, 4],
  payments: [4],
  maintenance: [4],
};

export function TableModuleView({ moduleKey }: { moduleKey: TableModuleKey }) {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules[moduleKey];
  const tableCopy = dict.tables[moduleKey];
  const navMeta = NAV_ITEMS.find((item) => item.key === (moduleKey as ModuleKey))!;

  const filterOptions = Object.entries(tableCopy.filters).map(
    ([value, label]) => ({
      value,
      label,
    })
  );

  const rightIndices = RIGHT_ALIGNED_COLUMNS[moduleKey];
  const columns: TableColumnDef[] = tableCopy.columns.map((label, idx) => ({
    label,
    align: rightIndices.includes(idx) ? 'right' : 'left',
  }));

  const zeroTnd = formatTndFromMillimes(0, locale);

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase={navMeta.plannedPhase}
        action={
          <Button
            variant="primary"
            disabled
            title={dict.common.upcomingActionNote}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>{tableCopy.actionLabel}</span>
          </Button>
        }
      />

      <ModuleNotice
        title={dict.common.phase1NoticeTitle}
        body={`${dict.common.phase1NoticeBody} (${dict.common.plannedFor} ${navMeta.plannedPhase}).`}
      />

      {moduleKey === 'payments' ? (
        <StatStrip
          items={[
            {
              id: 'received',
              label: dict.tables.payments.summaryReceived,
              value: zeroTnd,
              note: dict.dashboard.kpiSubNoDb,
            },
            {
              id: 'deposits',
              label: dict.tables.payments.summaryDeposits,
              value: zeroTnd,
              note: dict.dashboard.kpiSubNoDb,
            },
            {
              id: 'outstanding',
              label: dict.tables.payments.summaryOutstanding,
              value: zeroTnd,
              note: dict.dashboard.kpiSubNoDb,
            },
          ]}
        />
      ) : null}

      <ModuleDataTable
        columns={columns}
        filterOptions={filterOptions}
        filterAriaLabel={moduleCopy.title}
        searchAriaLabel={`${dict.common.searchPlaceholder} ${moduleCopy.title}`}
        emptyIcon={<NavIcon name={navMeta.icon} className="h-5 w-5" />}
        emptyTitle={moduleCopy.emptyTitle}
        emptyDescription={moduleCopy.emptyDescription}
        plannedPhase={navMeta.plannedPhase}
      />
    </div>
  );
}
