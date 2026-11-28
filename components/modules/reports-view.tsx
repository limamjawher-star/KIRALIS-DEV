'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BarChart3, CalendarDays, CarFront, Clock3, FileText, Wallet } from 'lucide-react';
import type { AgencyRecord } from '@/lib/agency/types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import { agencyDateForInstant } from '@/lib/reservations/domain';
import {
  summarizeAgencyBookings, type ReportBookingRow,
  type ReportPeriod, type BookingReportStatus,
} from '@/lib/reports/analytics';
import { getOperationalReportCopy } from '@/lib/reports/copy';
import { formatTndFromMillimes } from '@/lib/currency';
import { getReservationCopy } from '@/lib/reservations/copy';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { cn } from '@/lib/utils';

interface ReportsViewProps {
  agency: AgencyRecord;
  bookings: ReportBookingRow[];
  vehicles: VehicleRecord[];
  partial: boolean;
  initialError: string | null;
}

const REPORT_STATUS_ORDER: readonly BookingReportStatus[] =
  ['confirmed', 'active', 'completed', 'pending', 'draft', 'cancelled'];

function formatAverage(value: number | null, locale: string) {
  return value == null ? '—'
    : new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
}

export function ReportsView({
  agency, bookings, vehicles, partial, initialError,
}: ReportsViewProps) {
  const { dict, locale } = useAppPreferences();
  const [period, setPeriod] = useState<ReportPeriod>('month');
  const copy = getOperationalReportCopy(locale);
  const bookingCopy = getReservationCopy(locale);
  const tz = agency.timezone || 'Africa/Tunis';
  const today = useMemo(
    () => agencyDateForInstant(new Date().toISOString(), tz) ??
      new Date().toISOString().slice(0,10), [tz]
  );
  const report = useMemo(
    () => summarizeAgencyBookings(period, today, tz, bookings, vehicles),
    [period, today, tz, bookings, vehicles]
  );
  const months = dict.tables.reports.periods;
  const periodOptions = [
    { value: 'month' as const, label: months.month },
    { value: 'quarter' as const, label: months.quarter },
    { value: 'year' as const, label: months.year },
  ];
  const numberLocale = locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-GB' : 'fr-TN';
  const fmtNumber = (n: number) => new Intl.NumberFormat(numberLocale).format(n);
  const remainingStatusCount = Math.max(1, report.allBookingCount);
  const vehicleName = new Map(vehicles.map(v => [v.id, `${v.brand} ${v.model} · ${v.plate_number}`]));
  const statusColor: Record<BookingReportStatus, string> = {
    draft: 'bg-slate-400',
    pending: 'bg-amber-500',
    confirmed: 'bg-blue-600',
    active: 'bg-emerald-600',
    completed: 'bg-slate-700 dark:bg-slate-300',
    cancelled: 'bg-rose-500',
  };
  const statCards = [
    { id: 'booking-count', label: copy.bookings, value: fmtNumber(report.allBookingCount),
      icon: FileText, note: copy.periodByPickup },
    { id: 'booked-value', label: copy.bookedValue,
      value: formatTndFromMillimes(report.bookedValueMinor, locale),
      icon: Wallet, note: copy.bookedValueInfo },
    { id: 'booked-days', label: copy.bookedDays,
      value: copy.daySuffix(report.bookedRentalDays),
      icon: CalendarDays, note: copy.committed },
    { id: 'average', label: copy.avgDays,
      value: report.averageBookedDays == null ? '—'
        : copy.daySuffix(Number(formatAverage(report.averageBookedDays, 'en-GB'))),
      icon: Clock3, note: `${fmtNumber(report.committedBookingCount)} · ${copy.committed}` },
  ];

  return (
    <main className="space-y-5 sm:space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={`${agency.name} · ${tz}`}
        action={<Link href="/reservations"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-blue-700 bg-[#1D4ED8] px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
          <BarChart3 className="h-4 w-4" aria-hidden="true"/>
          <span>{copy.openBookings}</span>
          <ArrowUpRight className="h-4 w-4" aria-hidden="true"/>
        </Link>}
      />
      {initialError ? <AlertBanner variant="error">{copy.errorPrefix} {initialError}</AlertBanner> : null}
      {partial ? <AlertBanner variant="warning">{copy.partialWarning}</AlertBanner> : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl options={periodOptions} value={period}
          onChange={setPeriod} ariaLabel={copy.title}/>
        <p className="font-mono text-xs font-semibold tabular-nums text-slate-600 dark:text-slate-300"
          dir="ltr">{report.startDate} — {report.endDateExclusive}</p>
      </div>
      <p className="max-w-3xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
        {copy.explanation}
      </p>
      <section aria-label={copy.title} className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {statCards.map(item => <div key={item.id}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_4px_rgba(11,18,32,.04)] dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.label}</p>
            <item.icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" aria-hidden="true"/>
          </div>
          <p className="mt-3 break-words font-display text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl" dir="auto">
            {item.value}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{item.note}</p>
        </div>)}
      </section>

      <div className="grid gap-5 lg:grid-cols-5">
        <Surface className="overflow-hidden lg:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              {copy.statusMix}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {copy.bookings} · {fmtNumber(report.allBookingCount)}
            </p>
          </div>
          <div className="space-y-4 px-5 py-5">
            {REPORT_STATUS_ORDER.map(status => {
              const count = report.counts[status];
              const ratio = Math.max(0, Math.min(100, count / remainingStatusCount * 100));
              return <div key={status} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-200">
                    {copy.status[status]}
                  </span>
                  <span className="font-mono font-semibold tabular-nums text-slate-950 dark:text-white">
                    {fmtNumber(count)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  role="meter" aria-label={copy.status[status]} aria-valuemin={0}
                  aria-valuemax={report.allBookingCount} aria-valuenow={count}>
                  <div className={cn('h-full rounded-full transition-[width] duration-200', statusColor[status])}
                    style={{ width: `${ratio}%` }}/>
                </div>
              </div>;
            })}
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3.5 py-3 dark:bg-slate-950/50">
              <CarFront className="h-5 w-5 shrink-0 text-slate-600 dark:text-slate-300"/>
              <div className="flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {copy.fleetSize}
              </div>
              <div className="font-mono text-lg font-bold text-slate-950 dark:text-white">
                {fmtNumber(report.activeFleetCount)}
              </div>
            </div>
          </div>
        </Surface>

        <Surface className="overflow-hidden lg:col-span-3">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-display text-base font-bold text-slate-950 dark:text-white">
              {copy.recentBookings}
            </h2>
          </div>
          {report.recent.length === 0 ? <div className="flex flex-col items-center justify-center gap-3 px-5 py-14 text-center">
            <CalendarDays className="h-8 w-8 text-slate-400" aria-hidden="true"/>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{copy.noBookings}</p>
          </div> : <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {report.recent.map(booking => <Link href="/reservations" key={booking.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800/30">
              <div className="min-w-0">
                <p className="font-mono text-xs font-bold text-slate-950 dark:text-white" dir="ltr">
                  {booking.reference_code}
                </p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {vehicleName.get(booking.vehicle_id) ?? '—'} · {booking.pickup_at.slice(0,10)}
                </p>
              </div>
              <div className="text-end">
                <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                  {bookingCopy.statuses[booking.status]}
                </p>
                <p className="mt-1 font-mono text-xs font-bold text-slate-950 dark:text-white" dir="ltr">
                  {formatTndFromMillimes(booking.total_minor, locale)}
                </p>
              </div>
            </Link>)}
          </div>}
        </Surface>
      </div>
    </main>
  );
}
