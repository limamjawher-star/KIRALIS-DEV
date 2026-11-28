'use client';

import React, { useMemo, useState } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from './button';
import { EmptyState } from './empty-state';
import { SegmentedControl, type SegmentedOption } from './segmented-control';
import { Surface } from './surface';
import { cn } from '@/lib/utils';

export interface TableColumnDef {
  label: string;
  align?: 'left' | 'right';
}

export interface ModuleDataTableProps {
  columns: readonly TableColumnDef[];
  filterOptions: readonly SegmentedOption<string>[];
  filterAriaLabel: string;
  searchAriaLabel: string;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyDescription: string;
  plannedPhase: string;
}

export function ModuleDataTable({
  columns,
  filterOptions,
  filterAriaLabel,
  searchAriaLabel,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  plannedPhase,
}: ModuleDataTableProps) {
  const { dict } = useAppPreferences();
  const defaultFilter = filterOptions[0]?.value ?? 'all';
  const [selectedFilter, setSelectedFilter] = useState<string>(defaultFilter);
  const [searchQuery, setSearchQuery] = useState('');

  const isFiltered =
    selectedFilter !== defaultFilter || searchQuery.trim().length > 0;

  const activeFilterLabel = useMemo(() => {
    const match = filterOptions.find((o) => o.value === selectedFilter);
    return match?.label ?? '';
  }, [filterOptions, selectedFilter]);

  const handleReset = () => {
    setSelectedFilter(defaultFilter);
    setSearchQuery('');
  };

  return (
    <Surface className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#F4F6FA] px-4 py-3.5 sm:px-5 lg:flex-row lg:items-center lg:justify-between dark:border-slate-800 dark:bg-slate-950/60">
        <SegmentedControl
          options={filterOptions}
          value={selectedFilter}
          onChange={setSelectedFilter}
          ariaLabel={filterAriaLabel}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 sm:flex-initial">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={dict.common.searchPlaceholder}
              aria-label={searchAriaLabel}
              className="h-10 sm:h-9 w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 text-sm text-slate-950 placeholder:text-slate-400 transition-colors focus:border-[#1D4ED8] focus:outline-none focus:ring-3 focus:ring-blue-600/15 sm:w-64 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
            />
          </div>

          {isFiltered ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleReset}
              aria-label={dict.common.resetFilters}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{dict.common.resetFilters}</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table schema header */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-start">
          <thead>
            <tr className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#0F172A]">
              {columns.map((col) => (
                <th
                  key={col.label}
                  scope="col"
                  className={cn(
                    'h-10 px-4 text-xs font-semibold text-slate-600 whitespace-nowrap dark:text-slate-400',
                    col.align === 'right' ? 'text-end' : 'text-start'
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={columns.length} className="p-0">
                <EmptyState
                  icon={emptyIcon}
                  title={emptyTitle}
                  description={
                    isFiltered ? dict.common.noFilterMatch : emptyDescription
                  }
                  meta={`${dict.common.zeroRecords} · ${dict.common.plannedFor} ${plannedPhase}${
                    isFiltered && activeFilterLabel
                      ? ` · ${activeFilterLabel}`
                      : ''
                  }`}
                  action={
                    isFiltered ? (
                      <Button variant="secondary" size="sm" onClick={handleReset}>
                        {dict.common.resetFilters}
                      </Button>
                    ) : undefined
                  }
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Quiet count footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-[#F4F6FA] px-4 py-2.5 text-xs text-slate-600 sm:px-5 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
        <span className="font-mono font-medium tabular-nums">
          {dict.common.zeroRecords}
        </span>
        <span>{dict.common.noDatabaseConnected}</span>
      </div>
    </Surface>
  );
}
