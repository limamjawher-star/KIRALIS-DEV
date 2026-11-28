'use client';

import React, { useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  buildMonthGrid,
  formatMonthHeading,
  getTodayIsoInTunis,
  shiftMonth,
  type MonthCoordinates,
} from '@/lib/calendar';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModuleNotice } from '@/components/ui/module-notice';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

type CalendarViewMode = 'month' | 'list';

function parseIsoToMonth(isoDate: string): MonthCoordinates {
  const [y, m] = isoDate.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function CalendarView() {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules.calendar;

  const todayIso = useMemo(() => getTodayIsoInTunis(new Date()), []);
  const [coords, setCoords] = useState<MonthCoordinates>(() =>
    parseIsoToMonth(todayIso)
  );
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  const cells = useMemo(
    () => buildMonthGrid(coords, todayIso),
    [coords, todayIso]
  );

  const monthHeading = useMemo(
    () => formatMonthHeading(coords, locale),
    [coords, locale]
  );

  const handleToday = () => {
    setCoords(parseIsoToMonth(todayIso));
    setSelectedDate(todayIso);
  };

  const viewOptions = [
    { value: 'month' as const, label: dict.calendar.viewMonth },
    { value: 'list' as const, label: dict.calendar.viewList },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase="Phase 3"
      />

      <ModuleNotice
        title={dict.common.phase1NoticeTitle}
        body={dict.common.phase1NoticeBody}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Main dispatch calendar surface */}
        <Surface className="xl:col-span-2 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#F4F6FA] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setCoords((c) => shiftMonth(c, -1))}
                  aria-label={dict.calendar.previousMonth}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-s-xl text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                >
                  <ChevronLeft
                    className="h-4 w-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setCoords((c) => shiftMonth(c, 1))}
                  aria-label={dict.calendar.nextMonth}
                  className="inline-flex h-9 w-9 items-center justify-center border-s border-slate-300 rounded-e-xl text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
                >
                  <ChevronRight
                    className="h-4 w-4 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </button>
              </div>

              <Button variant="secondary" size="sm" onClick={handleToday}>
                {dict.calendar.today}
              </Button>

              <h2 className="ms-1 font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">
                {monthHeading}
              </h2>
            </div>

            <SegmentedControl
              options={viewOptions}
              value={viewMode}
              onChange={setViewMode}
              ariaLabel={moduleCopy.title}
            />
          </div>

          {viewMode === 'month' ? (
            <div className="p-4 sm:p-5">
              {/* Weekday headings */}
              <div className="grid grid-cols-7 border-b border-slate-200 pb-2.5 dark:border-slate-800">
                {dict.calendar.weekdays.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-slate-600 dark:text-slate-400"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* 42-day grid */}
              <div className="mt-3 grid grid-cols-7 gap-1.5">
                {cells.map((cell) => {
                  const isSelected = cell.isoDate === selectedDate;
                  return (
                    <button
                      key={cell.isoDate}
                      type="button"
                      onClick={() => setSelectedDate(cell.isoDate)}
                      aria-pressed={isSelected}
                      aria-label={cell.isoDate}
                      className={cn(
                        'flex h-14 flex-col items-start justify-between rounded-xl border p-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 sm:h-[68px] dark:focus-visible:ring-blue-400 cursor-pointer',
                        isSelected
                          ? 'border-[#1D4ED8] bg-blue-50/85 ring-1 ring-[#1D4ED8]/20 dark:border-blue-500 dark:bg-blue-950/50'
                          : 'border-slate-300/75 bg-white hover:border-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#0F172A] dark:hover:border-slate-700 dark:hover:bg-slate-800/70',
                        !cell.inCurrentMonth &&
                          !isSelected &&
                          'bg-[#F4F6FA] text-slate-400 dark:bg-slate-950/50 dark:text-slate-600'
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-6 min-w-6 items-center justify-center rounded-lg px-1.5 font-mono text-xs tabular-nums',
                          cell.isToday
                            ? 'bg-[#1D4ED8] font-bold text-white dark:bg-blue-600'
                            : cell.inCurrentMonth
                              ? 'font-semibold text-slate-900 dark:text-slate-100'
                              : 'text-slate-400 dark:text-slate-600'
                        )}
                      >
                        {cell.dayOfMonth}
                      </span>
                      <span className="sr-only">0</span>
                    </button>
                  );
                })}
              </div>

              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                {dict.calendar.legendHint}
              </p>
            </div>
          ) : (
            <EmptyState
              icon={<CalendarRange className="h-5 w-5" aria-hidden="true" />}
              title={moduleCopy.emptyTitle}
              description={moduleCopy.emptyDescription}
              meta={`${monthHeading} · ${dict.common.zeroRecords}`}
            />
          )}
        </Surface>

        {/* Selected day detail panel */}
        <Surface className="overflow-hidden self-start">
          <div className="bg-[#0B1220] px-5 py-4 text-white">
            <p className="text-xs font-medium text-slate-400">
              {dict.calendar.selectedDateLabel}
            </p>
            <p className="mt-1 font-mono text-lg font-bold text-white tabular-nums">
              {selectedDate}
            </p>
          </div>
          <EmptyState
            icon={<CalendarRange className="h-5 w-5" aria-hidden="true" />}
            title={moduleCopy.emptyTitle}
            description={dict.calendar.noScheduledEvents}
            meta={`${dict.common.zeroRecords} · Africa/Tunis`}
            className="py-10"
          />
        </Surface>
      </div>
    </div>
  );
}
