'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarRange, ChevronLeft, ChevronRight, ArrowUpRight, CarFront, Clock3 } from 'lucide-react';
import type { AgencyRecord } from '@/lib/agency/types';
import type { ReservationRow } from '@/lib/supabase/database.types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { CustomerRecord } from '@/lib/customers/types';
import {
  buildMonthGrid, formatMonthHeading, shiftMonth, type MonthCoordinates,
} from '@/lib/calendar';
import { agencyDateForInstant } from '@/lib/reservations/domain';
import { buildDispatchEventIndex, getMonthReservations, type DispatchEventKind } from '@/lib/reservations/calendar';
import { getReservationCopy } from '@/lib/reservations/copy';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertBanner } from '@/components/ui/alert-banner';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Surface } from '@/components/ui/surface';
import { formatTndFromMillimes, type SupportedLocale } from '@/lib/currency';
import { cn } from '@/lib/utils';

type CalendarViewMode = 'month' | 'list';
type DispatchCopy = {
  pickup: string; return: string; in_use: string; tentative: string;
  openBookings: string; eventCount: (n: number) => string;
  noBookings: string;
};
const DISPATCH_COPY: Record<SupportedLocale, DispatchCopy> = {
  fr: {
    pickup: 'Départ', return: 'Retour', in_use: 'En location', tentative: 'À confirmer',
    openBookings: 'Ouvrir les réservations', eventCount: n => `${n} activité${n > 1 ? 's' : ''}`,
    noBookings: 'Aucune réservation prévue pour ce jour.',
  },
  en: {
    pickup: 'Pickup', return: 'Return', in_use: 'In use', tentative: 'Tentative',
    openBookings: 'Open reservations', eventCount: n => `${n} activit${n === 1 ? 'y' : 'ies'}`,
    noBookings: 'No reservations scheduled for this day.',
  },
  ar: {
    pickup: 'تسليم', return: 'إرجاع', in_use: 'قيد الكراء', tentative: 'بانتظار التأكيد',
    openBookings: 'فتح الحجوزات', eventCount: n => `${n} نشاط`,
    noBookings: 'لا توجد حجوزات مبرمجة لهذا اليوم.',
  },
};

function parseIsoToMonth(isoDate: string): MonthCoordinates {
  const [year, month] = isoDate.split('-').map(Number);
  return { year, month: month - 1 };
}

export interface CalendarViewProps {
  agency: AgencyRecord;
  reservations: ReservationRow[];
  vehicles: VehicleRecord[];
  customers: CustomerRecord[];
  initialError: string | null;
}

export function CalendarView({
  agency, reservations, vehicles, customers, initialError,
}: CalendarViewProps) {
  const { dict, locale } = useAppPreferences();
  const moduleCopy = dict.modules.calendar;
  const bookingCopy = getReservationCopy(locale);
  const copy = DISPATCH_COPY[locale];
  const agencyTimeZone = agency.timezone || 'Africa/Tunis';

  const todayIso = useMemo(() =>
    agencyDateForInstant(new Date().toISOString(), agencyTimeZone) ??
    new Date().toISOString().slice(0, 10), [agencyTimeZone]);
  const [coords, setCoords] = useState<MonthCoordinates>(() => parseIsoToMonth(todayIso));
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');

  const cells = useMemo(() => buildMonthGrid(coords, todayIso), [coords, todayIso]);
  const indexed = useMemo(
    () => buildDispatchEventIndex(reservations, cells.map(cell => cell.isoDate), agencyTimeZone),
    [reservations, cells, agencyTimeZone]
  );
  const selectedEvents = indexed.get(selectedDate) ?? [];
  const monthReservations = useMemo(
    () => getMonthReservations(reservations, coords.year, coords.month, agencyTimeZone),
    [reservations, coords, agencyTimeZone]
  );
  const monthHeading = useMemo(() => formatMonthHeading(coords, locale), [coords, locale]);
  const vehiclesById = useMemo(() => new Map(vehicles.map(v => [v.id, v])), [vehicles]);
  const customersById = useMemo(() => new Map(customers.map(c => [c.id, c])), [customers]);
  const vehicleName = (id: string) => {
    const v = vehiclesById.get(id);
    return v ? `${v.brand} ${v.model} · ${v.plate_number}` : '—';
  };
  const customerName = (id: string) => {
    const c = customersById.get(id);
    return c ? c.customer_type === 'corporate' ? c.company_name || c.full_name : c.full_name : '—';
  };
  const intlLocale = locale === 'en' ? 'en-GB' : locale === 'ar' ? 'ar-TN' : 'fr-TN';
  const formatDate = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: agencyTimeZone,
      }).format(new Date(iso));
    } catch { return iso; }
  };
  const viewOptions = [
    { value: 'month' as const, label: dict.calendar.viewMonth },
    { value: 'list' as const, label: dict.calendar.viewList },
  ];
  const handleToday = () => {
    setCoords(parseIsoToMonth(todayIso));
    setSelectedDate(todayIso);
  };
  const moveMonth = (delta: number) => {
    const next = shiftMonth(coords, delta);
    setCoords(next);
    setSelectedDate(`${next.year}-${String(next.month + 1).padStart(2, '0')}-01`);
  };
  const kindClasses: Record<DispatchEventKind, string> = {
    pickup: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
    return: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    in_use: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    tentative: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        meta={`${agency.name} · ${agencyTimeZone}`}
        action={<Link href="/reservations"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-700 bg-[#1D4ED8] px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
          <CalendarRange className="h-4 w-4" aria-hidden="true"/>
          {copy.openBookings}
          <ArrowUpRight className="h-3.5 w-3.5 rtl:-rotate-90" aria-hidden="true"/>
        </Link>}
      />
      {initialError ? <AlertBanner variant="error">{initialError}</AlertBanner> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Surface className="overflow-hidden xl:col-span-2">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#F4F6FA] px-4 py-3.5 dark:border-slate-800 dark:bg-slate-950/60 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900">
                <button type="button" onClick={() => moveMonth(-1)}
                  aria-label={dict.calendar.previousMonth}
                  className="inline-flex h-10 w-10 items-center justify-center text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800">
                  <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/>
                </button>
                <button type="button" onClick={() => moveMonth(1)}
                  aria-label={dict.calendar.nextMonth}
                  className="inline-flex h-10 w-10 items-center justify-center border-s border-slate-300 text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  <ChevronRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true"/>
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={handleToday}>{dict.calendar.today}</Button>
              <h2 className="ms-1 font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">
                {monthHeading}
              </h2>
            </div>
            <SegmentedControl options={viewOptions} value={viewMode}
              onChange={setViewMode} ariaLabel={moduleCopy.title}/>
          </div>

          {viewMode === 'month' ? <div className="p-3 sm:p-5">
            <div className="grid grid-cols-7 border-b border-slate-200 pb-2.5 dark:border-slate-800">
              {dict.calendar.weekdays.map((day, index) => (
                <div key={index} className="text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {day}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 sm:gap-1.5">
              {cells.map(cell => {
                const isSelected = selectedDate === cell.isoDate;
                const events = indexed.get(cell.isoDate) ?? [];
                const hasPickup = events.some(e => e.kind === 'pickup');
                const hasReturn = events.some(e => e.kind === 'return');
                return (
                  <button key={cell.isoDate} type="button"
                    onClick={() => setSelectedDate(cell.isoDate)}
                    aria-pressed={isSelected}
                    aria-label={`${cell.isoDate}: ${copy.eventCount(events.length)}`}
                    className={cn(
                      'flex min-h-14 min-w-0 flex-col items-start justify-between rounded-xl border px-1.5 py-2 text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 sm:min-h-[72px] sm:p-2',
                      isSelected
                        ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600/20 dark:border-blue-500 dark:bg-blue-950/40'
                        : 'border-slate-200 bg-white hover:border-slate-400 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800',
                      !cell.inCurrentMonth && !isSelected && 'bg-slate-50/80 dark:bg-slate-950/50'
                    )}
                  >
                    <span className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-md font-mono text-xs tabular-nums',
                      cell.isToday
                        ? 'bg-blue-600 font-bold text-white'
                        : cell.inCurrentMonth ? 'font-semibold text-slate-900 dark:text-white'
                          : 'text-slate-400 dark:text-slate-500'
                    )}>{cell.dayOfMonth}</span>
                    {events.length > 0 ? <span className="flex w-full flex-wrap items-center justify-start gap-1">
                      <span className={cn('inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-[10px] font-bold tabular-nums',
                        isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-white')}>
                        {events.length}
                      </span>
                      {hasPickup ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-blue-600"/> : null}
                      {hasReturn ? <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-600"/> : null}
                    </span> : <span aria-hidden="true" className="h-5"/>}
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] font-medium text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-blue-600"/>{copy.pickup}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600"/>{copy.return}</span>
              <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-slate-200 px-1 text-[9px] font-bold text-slate-800 dark:bg-slate-700 dark:text-white">N</span>{copy.eventCount(2)}</span>
            </div>
          </div> : monthReservations.length === 0
            ? <EmptyState icon={<CalendarRange className="h-5 w-5" aria-hidden="true"/>}
                title={moduleCopy.emptyTitle} description={dict.calendar.noScheduledEvents}/>
            : <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {monthReservations.map(res => <Link href="/reservations" key={res.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800/30 sm:px-5">
                <div className="min-w-0">
                  <p dir="ltr" className="font-mono text-xs font-bold text-slate-950 dark:text-white">{res.reference_code}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">{vehicleName(res.vehicle_id)}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{formatDate(res.pickup_at)} → {formatDate(res.return_at)}</p>
                </div>
                <div className="text-end">
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">{bookingCopy.statuses[res.status]}</p>
                  <p dir="ltr" className="mt-1 font-mono text-xs font-bold tabular-nums text-slate-900 dark:text-white">{formatTndFromMillimes(res.total_minor, locale)}</p>
                </div>
              </Link>)}
            </div>
          }
        </Surface>

        <Surface className="overflow-hidden self-start">
          <div className="bg-[#0B1220] px-5 py-4 text-white">
            <p className="text-xs font-medium text-slate-400">{dict.calendar.selectedDateLabel}</p>
            <p dir="ltr" className="mt-1 font-mono text-lg font-bold text-white tabular-nums">{selectedDate}</p>
            <p className="mt-1 text-xs text-slate-300">{copy.eventCount(selectedEvents.length)} · {agencyTimeZone}</p>
          </div>
          {selectedEvents.length === 0 ? <EmptyState
            icon={<CalendarRange className="h-5 w-5" aria-hidden="true"/>}
            title={moduleCopy.emptyTitle} description={copy.noBookings} className="py-9"/>
          : <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {selectedEvents.map((event, index) => <Link
              href="/reservations"
              key={`${event.reservation.id}-${event.kind}-${index}`}
              className="block px-4 py-3.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-slate-800/40 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn(
                  'inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold',
                  kindClasses[event.kind]
                )}>{copy[event.kind]}</span>
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {bookingCopy.statuses[event.reservation.status]}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <CarFront className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true"/>
                {vehicleName(event.reservation.vehicle_id)}
              </p>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{customerName(event.reservation.customer_id)}</p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true"/>
                {event.kind === 'pickup' ? formatDate(event.reservation.pickup_at) :
                  event.kind === 'return' ? formatDate(event.reservation.return_at) :
                  `${formatDate(event.reservation.pickup_at)} → ${formatDate(event.reservation.return_at)}`}
              </div>
            </Link>)}
          </div>}
        </Surface>
      </div>
    </div>
  );
}
