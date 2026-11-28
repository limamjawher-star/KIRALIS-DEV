'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, CarFront,
  CheckCircle2, ChevronDown, Clock3, FileBarChart2, FilterX, Gauge, LayoutDashboard,
  Layers3, Settings2, Users2, Wallet, Wrench, type LucideIcon,
} from 'lucide-react';
import type { AgencyDashboardStats, AgencyRecord, AgencyRole } from '@/lib/agency/types';
import { formatAgencyRoleLabel } from '@/lib/agency/types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { ReportBookingRow } from '@/lib/reports/analytics';
import type { ReservationStatus } from '@/lib/supabase/database.types';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { AlertBanner } from '@/components/ui/alert-banner';
import {
  analyzeCommandCenter, percentChange, DASHBOARD_RANGES,
  DASHBOARD_STATUSES, type CommandCenterAnalytics, type DashboardMetric,
  type DashboardRange, type FleetPerformance,
} from '@/lib/dashboard/analytics';
import { getCommandCenterCopy, type CommandCenterCopy } from '@/lib/dashboard/copy';
import { formatTndFromMillimes, type SupportedLocale } from '@/lib/currency';
import { cn } from '@/lib/utils';

export interface DashboardViewProps {
  agency: AgencyRecord;
  role: AgencyRole;
  stats: AgencyDashboardStats;
  bookings: ReportBookingRow[];
  vehicles: VehicleRecord[];
  partial: boolean;
  initialError: string | null;
  today: string;
}

const PANEL =
  'min-w-0 overflow-hidden rounded-2xl border border-slate-200/85 bg-white shadow-[0_2px_12px_-7px_rgba(15,23,42,.15)] dark:border-slate-800 dark:bg-[#111827] dark:shadow-[0_8px_28px_-15px_rgba(0,0,0,.7)]';

const STATUS_TONES: Record<ReservationStatus, string> = {
  draft: 'bg-slate-400',
  pending: 'bg-amber-500',
  confirmed: 'bg-indigo-500',
  active: 'bg-emerald-500',
  completed: 'bg-blue-700',
  cancelled: 'bg-rose-500',
};

function StatDelta({ current, previous, label }: {
  current: number; previous: number; label: string;
}) {
  const diff = percentChange(current, previous);
  if (diff === null) return <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">—</p>;
  const positive = diff >= 0;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
      <span className={cn(
        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums',
        positive
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
      )}>
        {positive ? <ArrowUpRight className="h-3 w-3"/> : <ArrowDownRight className="h-3 w-3"/>}
        {Math.abs(diff).toFixed(1)}%
      </span>
      <span className="text-[10px] text-slate-500 dark:text-slate-400">{label}</span>
    </div>
  );
}
function Sparkline({ values }: { values: readonly number[] }) {
  const last = values.slice(-15);
  const max = Math.max(1, ...last);
  const pts = last.map((n, i) =>
    `${(i / Math.max(1, last.length - 1) * 92).toFixed(1)},${(28 - n / max * 24).toFixed(1)}`).join(' ');
  return (
    <svg aria-hidden="true" viewBox="0 0 96 32" className="h-8 w-24 shrink-0 opacity-70">
      <polyline points={pts} fill="none" stroke="#4f46e5" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TrendChart({ summary, metric, compare, locale, money }: {
  summary: CommandCenterAnalytics; metric: DashboardMetric;
  compare: boolean; locale: SupportedLocale; money: boolean;
}) {
  const [hover, setHover] = React.useState<number | null>(null);
  const current = summary.current[metric];
  const previous = summary.previous[metric];
  const all = compare ? current.concat(previous) : current;
  const high = Math.max(1, ...all);
  const maxValue = Math.ceil(high / Math.max(1, 10 ** Math.floor(Math.log10(high)) / 2))
    * Math.max(1, 10 ** Math.floor(Math.log10(high)) / 2);
  const n = current.length;
  const width = 760, height = 238;
  const padX = 47, padR = 16, padY = 18, padB = 32;
  const chartW = width - padX - padR;
  const chartH = height - padY - padB;
  const X = (i: number) => padX + i * chartW / Math.max(1, n - 1);
  const Y = (v: number) => padY + chartH - v / maxValue * chartH;
  const points = (values: number[]) => values.map((v, i) => [X(i), Y(v)] as const);
  const toPath = (values: number[]) => {
    const pts = points(values);
    if (!pts.length) return '';
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  };
  const chartPath = toPath(current);
  const previousPath = compare ? toPath(previous) : '';
  const selected = hover === null ? null : Math.max(0, Math.min(n - 1, hover));
  const formatValue = (value: number) =>
    money ? formatTndFromMillimes(value, locale)
      : new Intl.NumberFormat(locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-GB' : 'fr-TN').format(value);
  const formatDate = (date: string) => new Intl.DateTimeFormat(
    locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-GB' : 'fr-FR',
    { day: 'numeric', month: 'short', timeZone: 'UTC' }
  ).format(new Date(date + 'T00:00:00Z'));
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const normalized = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const x = (normalized * width - padX) / chartW;
    setHover(Math.max(0, Math.min(n - 1, Math.round(x * Math.max(1, n - 1)))));
  };
  const xLabels = [0, 0.25, 0.5, 0.75, 1]
    .map(t => Math.round(t * Math.max(0, n - 1)))
    .filter((value, index, arr) => arr.indexOf(value) === index);

  return (
    <div className="relative w-full">
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`${formatValue(summary.totals[metric])} · ${summary.startDate} – ${summary.endDate}`}
        className="block h-auto w-full touch-pan-y"
        onPointerMove={onPointerMove} onPointerLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="kiralis-trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity=".23"/>
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0,.25,.5,.75,1].map((scale, i) => {
          const v = maxValue * scale;
          return <g key={i}>
            <line x1={padX} x2={width-padR} y1={Y(v)} y2={Y(v)}
              stroke="currentColor" strokeOpacity=".11" strokeDasharray="3 5"/>
            <text x={padX - 9} y={Y(v)+4} textAnchor="end" fill="currentColor"
              className="text-slate-500 dark:text-slate-400" fontSize="11">{money ? (v / 1000).toFixed(0) : v.toFixed(0)}</text>
          </g>;
        })}
        {xLabels.map(i => <text key={i} x={X(i)} y={height-7}
          textAnchor={i===0?'start':i===n-1?'end':'middle'}
          fontSize="11" fill="currentColor" className="text-slate-500 dark:text-slate-400">
          {formatDate(summary.labels[i])}
        </text>)}
        {compare ? <path d={previousPath} fill="none" stroke="#94a3b8"
          strokeDasharray="6 5" strokeWidth="1.7" strokeLinecap="round"/> : null}
        <path d={`${chartPath} L${X(n-1)},${height-padB} L${X(0)},${height-padB} Z`}
          fill="url(#kiralis-trend-fill)"/>
        <path d={chartPath} fill="none" stroke="#6366f1" strokeWidth="2.6"
          strokeLinecap="round" strokeLinejoin="round"/>
        {selected !== null ? <g>
          <line x1={X(selected)} x2={X(selected)} y1={padY} y2={height-padB}
            stroke="#818cf8" strokeOpacity=".65" strokeDasharray="4 5"/>
          <circle cx={X(selected)} cy={Y(current[selected])} r="5"
            stroke="#6366f1" strokeWidth="3" fill="white"/>
          {compare ? <circle cx={X(selected)} cy={Y(previous[selected])} r="3"
            fill="#94a3b8" stroke="white" strokeWidth="1.5"/> : null}
        </g> : <circle cx={X(n-1)} cy={Y(current[n-1])} r="4.5" fill="#6366f1" stroke="white" strokeWidth="2"/>}
      </svg>
      {selected !== null ? <div
        className="pointer-events-none absolute top-1 z-10 max-w-[calc(100%-16px)] rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-xl dark:border-slate-700 dark:bg-[#101829]/95"
        style={{ left: `${Math.min(68, Math.max(0, (X(selected) / width) * 100))}%` }}>
        <p className="mb-1 text-[11px] font-medium text-slate-500 dark:text-slate-300">{formatDate(summary.labels[selected])}</p>
        <p dir="ltr" className="font-mono text-xs font-bold text-indigo-600 dark:text-indigo-300">
          {formatValue(current[selected])}
        </p>
        {compare ? <p dir="ltr" className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-300">
          {formatValue(previous[selected])} ↔
        </p> : null}
      </div> : null}
    </div>
  );
}

function SectionHeading({ title, subtitle, action }: {
  title: string; subtitle: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <div className="min-w-0">
        <h2 className="font-display text-[13px] font-bold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function QuickLink({ href, icon: Icon, children }: {
  href: string; icon: LucideIcon; children: React.ReactNode;
}) {
  return <Link href={href}
    className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:-translate-y-px hover:border-indigo-300 hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-indigo-300">
    <Icon className="h-4 w-4" aria-hidden="true"/>
    {children}
    <ArrowUpRight className="h-3 w-3 text-slate-400 transition group-hover:text-indigo-600" aria-hidden="true"/>
  </Link>;
}

export function DashboardView({
  agency, role, stats, bookings, vehicles, partial, initialError, today,
}: DashboardViewProps) {
  const { locale } = useAppPreferences();
  const copy = getCommandCenterCopy(locale);
  const [range, setRange] = React.useState<DashboardRange>('30d');
  const [metric, setMetric] = React.useState<DashboardMetric>('bookings');
  const [compare, setCompare] = React.useState(true);
  const [focused, setFocused] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<'bookings' | 'bookedValue' | 'rentalDays'>('bookings');
  const [expanded, setExpanded] = React.useState(false);
  const timeZone = agency.timezone || 'Africa/Tunis';
  const moneySupported = agency.currency_code === 'TND';
  const analysis = React.useMemo(() => analyzeCommandCenter({
    bookings, vehicles, today, timeZone, range, vehicleId: focused,
  }), [bookings, vehicles, today, timeZone, range, focused]);

  const nf = new Intl.NumberFormat(locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-GB' : 'fr-TN');
  const money = (value: number) => moneySupported
    ? formatTndFromMillimes(value, locale) : '—';
  const fleetById = React.useMemo(() => new Map(vehicles.map(v => [v.id,v])), [vehicles]);
  const focusedVehicle = focused ? fleetById.get(focused) : null;
  const sorted = React.useMemo(() => analysis.performance.slice().sort(
    (a,b) => b[sort] - a[sort] || a.vehicle.plate_number.localeCompare(b.vehicle.plate_number)
  ), [analysis.performance, sort]);
  const statusTotal = DASHBOARD_STATUSES.reduce((t,s) => t + analysis.statusCounts[s], 0);
  const fleetTotal = Math.max(1, vehicles.length);
  const kpis: {
    id: string; label: string; value: string; icon: LucideIcon;
    series?: number[]; current?: number; previous?: number; note: string;
  }[] = [
    { id: 'fleet', label: copy.fleet, value: nf.format(stats.vehicleCount), icon: CarFront, note: copy.liveFromDb },
    { id: 'bookings', label: copy.bookings, value: nf.format(analysis.totals.bookings),
      icon: CalendarDays, current: analysis.totals.bookings,
      previous: analysis.previousTotals.bookings, series: analysis.current.bookings, note: copy.bookingsInfo },
    { id: 'value', label: copy.bookedValue, value: money(analysis.totals.bookedValue),
      icon: Wallet, current: moneySupported ? analysis.totals.bookedValue : undefined,
      previous: moneySupported ? analysis.previousTotals.bookedValue : undefined,
      series: analysis.current.bookedValue, note: copy.valueInfo },
    { id: 'active', label: copy.activeRentals, value: nf.format(stats.activeRentalCount),
      icon: Activity, note: copy.liveFromDb },
    { id: 'days', label: copy.bookedDays, value: nf.format(analysis.totals.rentalDays),
      icon: Clock3, current: analysis.totals.rentalDays,
      previous: analysis.previousTotals.rentalDays,
      series: analysis.current.rentalDays, note: copy.periodCompare },
  ];
  const lang = locale === 'ar' ? 'ar-TN' : locale === 'en' ? 'en-GB' : 'fr-FR';
  const displayDate = (iso: string) => new Intl.DateTimeFormat(lang,
    { day: 'numeric', month: 'short', timeZone }).format(new Date(iso));

  return (
    <main className="min-w-0 space-y-4 pb-7 sm:space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-white to-indigo-50/60 p-4 shadow-sm dark:border-slate-800 dark:from-[#101827] dark:via-[#111827] dark:to-[#17213e] sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-gradient-to-br from-indigo-700 via-blue-600 to-cyan-600 text-lg font-black text-white shadow-[0_7px_20px_-9px_rgba(67,56,202,.9)]">
            {agency.name.trim().slice(0,1).toLocaleUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-indigo-600 dark:text-indigo-300">
              {copy.workspace} · {agency.name}
            </p>
            <h1 className="mt-0.5 font-display text-[22px] font-extrabold tracking-[-.035em] text-slate-950 dark:text-white sm:text-[26px]">
              {copy.heading}
            </h1>
            <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">{copy.subtitle}</p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10.5px] font-semibold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true"/>
            {copy.liveFromDb}
          </span>
          <span className="rounded-full border border-slate-200 px-2.5 py-1.5 text-[10.5px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {formatAgencyRoleLabel(role, locale)}
          </span>
          <Link href="/settings" title={copy.workspace}
            aria-label={copy.workspace}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
            <Settings2 className="h-4 w-4"/>
          </Link>
        </div>
      </section>

      {initialError ? <AlertBanner variant="error">{copy.missing} {initialError}</AlertBanner> : null}
      {partial ? <AlertBanner variant="warning">{copy.incomplete}</AlertBanner> : null}
      {!moneySupported ? <AlertBanner variant="warning">{copy.moneyLimited}</AlertBanner> : null}
      {focusedVehicle ? <div className="flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-900 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200">
        <Layers3 className="h-4 w-4" aria-hidden="true"/>
        {copy.filterActive}: <span className="font-semibold">{focusedVehicle.brand} {focusedVehicle.model} · {focusedVehicle.plate_number}</span>
        <button type="button" onClick={() => setFocused(null)}
          className="ms-auto inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-indigo-900">
          <FilterX className="h-3.5 w-3.5"/>{copy.reset}
        </button>
      </div> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={copy.workspace} className="flex flex-wrap gap-2">
          <QuickLink href="/reservations" icon={CalendarDays}>{copy.openBookings}</QuickLink>
          <QuickLink href="/vehicles" icon={CarFront}>{copy.openFleet}</QuickLink>
          <QuickLink href="/calendar" icon={LayoutDashboard}>{copy.openCalendar}</QuickLink>
          <QuickLink href="/reports" icon={FileBarChart2}>{copy.openReports}</QuickLink>
        </nav>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">{copy.period}</span>
          <SegmentedControl<DashboardRange>
            options={DASHBOARD_RANGES.map(r => ({ value: r.id, label: r.id.toUpperCase() }))}
            value={range} onChange={setRange} ariaLabel={copy.period}/>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label={copy.heading}>
        {kpis.map(item => <div key={item.id} className={cn(PANEL, 'relative flex min-h-[145px] flex-col justify-between p-4 sm:p-[18px]')}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{item.label}</p>
            <item.icon className="h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden="true"/>
          </div>
          <div className="mt-2 flex items-end justify-between gap-1.5">
            <p dir="auto" className="min-w-0 break-words font-display text-[24px] font-extrabold tracking-[-.04em] text-slate-950 dark:text-white sm:text-[27px]">
              {item.value}
            </p>
            {item.series && (item.id !== 'value' || moneySupported) ? <Sparkline values={item.series}/> : null}
          </div>
          {item.current !== undefined && item.previous !== undefined
            ? <StatDelta current={item.current} previous={item.previous} label={copy.periodCompare}/>
            : <p className="mt-3 line-clamp-2 text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">{item.note}</p>}
        </div>)}
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_315px]">
        <section className={PANEL}>
          <SectionHeading title={copy.chartHeading} subtitle={copy.chartSub}
            action={<div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={compare} onChange={event => setCompare(event.target.checked)}
                  className="h-4 w-4 accent-indigo-600"/>
                {copy.compareOn}
              </label>
            </div>}/>
          <div className="px-4 pt-4 pb-3 sm:px-5">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={copy.chartHeading}>
              {(['bookings','bookedValue','rentalDays'] as DashboardMetric[]).map(key => <button key={key}
                type="button" disabled={key==='bookedValue' && !moneySupported}
                onClick={() => setMetric(key)} aria-pressed={metric===key}
                className={cn('rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-40',
                  metric===key ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900/50 dark:text-indigo-200'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                {copy.metricLabels[key]}
              </button>)}
            </div>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">{copy.metricLabels[metric]}</p>
                <p dir="auto" className="mt-0.5 font-display text-[26px] font-extrabold tracking-tight text-slate-950 dark:text-white">
                  {metric === 'bookedValue' ? money(analysis.totals[metric]) : nf.format(analysis.totals[metric])}
                </p>
              </div>
              <p dir="ltr" className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                {analysis.startDate} — {analysis.endDate}
              </p>
            </div>
            <div className="mt-3">
              <TrendChart key={metric+range+String(focused)} summary={analysis} metric={metric}
                compare={compare} locale={locale} money={metric==='bookedValue'}/>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-end gap-4 text-[10.5px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded bg-indigo-500"/>{copy.current}</span>
              {compare ? <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 border-t-2 border-dashed border-slate-400"/>{copy.previous}</span> : null}
            </div>
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeading title={copy.upcoming} subtitle={copy.upcomingSub}
            action={<Link href="/calendar" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-300" aria-label={copy.openCalendar}>
              <ArrowUpRight className="h-4 w-4"/>
            </Link>}/>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {analysis.upcoming.length === 0 ? <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
              <Clock3 className="h-7 w-7 text-slate-400"/>
              <p className="text-xs text-slate-500 dark:text-slate-400">{copy.noUpcoming}</p>
            </div> : analysis.upcoming.map(booking => {
              const vehicle = fleetById.get(booking.vehicle_id);
              return <Link key={booking.id} href="/reservations"
                className="group flex items-start gap-3 px-4 py-3.5 transition hover:bg-indigo-50/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800/50">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-indigo-600 dark:bg-slate-800 dark:text-indigo-300">
                  <CarFront className="h-4 w-4"/>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-slate-900 dark:text-white">
                    {vehicle ? `${vehicle.brand} ${vehicle.model}` : booking.reference_code}
                  </span>
                  <span dir="ltr" className="mt-0.5 block font-mono text-[10.5px] text-slate-500 dark:text-slate-400">{booking.reference_code}</span>
                  <span className="mt-1 block text-[10.5px] font-medium text-slate-500 dark:text-slate-400">
                    {displayDate(booking.pickup_at)}
                  </span>
                </span>
                <span className={cn('mt-1 shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold',
                  booking.status==='confirmed'
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300')}>
                  {copy.statuses[booking.status]}
                </span>
              </Link>;
            })}
          </div>
          <Link href="/reservations" className="flex min-h-11 items-center justify-center gap-2 border-t border-slate-100 px-4 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-950/25">
            {copy.openBookings}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180"/>
          </Link>
        </section>
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
        <section className={PANEL}>
          <SectionHeading title={copy.pipeline} subtitle={copy.pipelineSub}/>
          <div className="space-y-3 px-5 py-4">
            {DASHBOARD_STATUSES.map(status => {
              const count = analysis.statusCounts[status];
              const ratio = statusTotal ? count / statusTotal : 0;
              return <div key={status}>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-600 dark:text-slate-300">{copy.statuses[status]}</span>
                  <span className="font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{nf.format(count)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className={cn('h-full rounded-full',STATUS_TONES[status])} style={{ width: `${Math.max(0,ratio*100)}%` }}/>
                </div>
              </div>;
            })}
            {statusTotal===0?<p className="pt-2 text-[11px] text-slate-500 dark:text-slate-400">{copy.noBookings}</p>:null}
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeading title={copy.heat} subtitle={copy.heatSub}/>
          <div className="px-4 py-5 sm:px-5">
            <div role="img" aria-label={copy.heatSub}
              className="grid grid-cols-[repeat(26,minmax(0,1fr))] gap-[3px]">
              {Array.from({length:26},(_,week) =>
                <div key={week} className="flex flex-col gap-[3px]">
                  {analysis.heatmap.slice(week*7, week*7+7).map(day => {
                    const intensity = Math.min(4,day.count);
                    return <span key={day.date} title={`${day.date}: ${day.count}`}
                      className={cn('aspect-square min-w-0 rounded-[3px]',
                        intensity===0?'bg-slate-100 dark:bg-slate-800':
                        intensity===1?'bg-indigo-200 dark:bg-indigo-900':
                        intensity===2?'bg-indigo-400 dark:bg-indigo-700':
                        intensity===3?'bg-indigo-600 dark:bg-indigo-500':'bg-indigo-800 dark:bg-indigo-300')}/>;
                  })}
                </div>
              )}
            </div>
            <div className="mt-4 flex items-center justify-end gap-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="me-1">{copy.less}</span>
              {['bg-slate-100 dark:bg-slate-800','bg-indigo-200 dark:bg-indigo-900',
                'bg-indigo-400 dark:bg-indigo-700','bg-indigo-600 dark:bg-indigo-500',
                'bg-indigo-800 dark:bg-indigo-300'].map((color,i) => <span key={i}
                  className={cn('h-2.5 w-2.5 rounded-[2px]',color)}/>)}
              <span className="ms-1">{copy.more}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{copy.bookings}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-950 dark:text-white">
                  {nf.format(analysis.heatmap.reduce((n,d) => n+d.count,0))}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                <p className="text-[10px] text-slate-500 dark:text-slate-400">{copy.period}</p>
                <p className="mt-1 font-mono text-lg font-bold text-slate-950 dark:text-white">182d</p>
              </div>
            </div>
          </div>
        </section>

        <section className={PANEL}>
          <SectionHeading title={copy.fleetStatus} subtitle={copy.fleetStatusSub}/>
          <div className="space-y-4 px-5 py-5">
            <div className="flex items-center justify-between gap-4 rounded-xl bg-indigo-50/60 px-4 py-4 dark:bg-indigo-950/25">
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{copy.fleet}</p>
                <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">{nf.format(vehicles.length)}</p>
              </div>
              <div className="relative h-20 w-20 shrink-0 rounded-full p-[9px]"
                style={{ background: `conic-gradient(#6366f1 0 ${analysis.fleetStatuses.available/fleetTotal*100}%, #0ea5e9 ${analysis.fleetStatuses.available/fleetTotal*100}% ${(analysis.fleetStatuses.available+analysis.fleetStatuses.rented)/fleetTotal*100}%, #f59e0b ${(analysis.fleetStatuses.available+analysis.fleetStatuses.rented)/fleetTotal*100}% ${(analysis.fleetStatuses.available+analysis.fleetStatuses.rented+analysis.fleetStatuses.maintenance)/fleetTotal*100}%, #94a3b8 0)` }}>
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-[#111827]">
                  <Gauge className="h-6 w-6 text-indigo-500" aria-hidden="true"/>
                </div>
              </div>
            </div>
            {(['available','rented','maintenance','retired'] as const).map((status,i) =>
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <span className={cn('h-2.5 w-2.5 rounded-[3px]',
                    ['bg-indigo-500','bg-sky-500','bg-amber-500','bg-slate-400'][i])}/>
                  {copy.fleetStatuses[status]}
                </span>
                <span className="font-mono font-semibold text-slate-950 dark:text-white">
                  {nf.format(analysis.fleetStatuses[status])}
                </span>
              </div>
            )}
            <Link href="/vehicles"
              className="mt-2 flex min-h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-slate-700 dark:bg-slate-900 dark:text-indigo-300">
              {copy.openFleet}<ArrowRight className="h-3.5 w-3.5 rtl:rotate-180"/>
            </Link>
          </div>
        </section>
      </div>

      <section className={PANEL}>
        <SectionHeading title={copy.performance} subtitle={copy.performanceSub}
          action={<div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">{copy.top}</span>
            <select aria-label={copy.top} value={sort} onChange={e=>setSort(e.target.value as typeof sort)}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="bookings">{copy.bookings}</option>
              <option value="bookedValue">{copy.bookedValue}</option>
              <option value="rentalDays">{copy.bookedDays}</option>
            </select>
          </div>}/>
        {sorted.length===0?<div className="flex flex-col items-center gap-3 p-10 text-center">
          <Wrench className="h-6 w-6 text-slate-400"/>
          <p className="text-sm text-slate-500 dark:text-slate-400">{copy.noVehicles}</p>
        </div>:<>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[660px] border-collapse text-start text-xs">
              <thead className="bg-slate-50/80 dark:bg-slate-900/70">
                <tr>
                  {[copy.vehicle,copy.status,copy.bookings,copy.bookedDays,copy.bookedValue].map((label,i)=>
                    <th key={i} scope="col" className={cn(
                      'px-5 py-3 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                      i>1?'text-end':'text-start'
                    )}>{label}</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {(expanded?sorted:sorted.slice(0,8)).map(row=>
                  <tr key={row.id} className={cn('transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20',focused===row.id?'bg-indigo-50/80 dark:bg-indigo-950/30':'')}>
                    <td className="px-5 py-3">
                      <button type="button" onClick={()=>setFocused(focused===row.id?null:row.id)}
                        aria-pressed={focused===row.id}
                        className="flex max-w-[260px] items-center gap-2.5 rounded-lg text-start outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
                          <CarFront className="h-4 w-4"/>
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-slate-900 dark:text-white">{row.vehicle.brand} {row.vehicle.model}</span>
                          <span dir="ltr" className="mt-0.5 block truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">{row.vehicle.plate_number}</span>
                        </span>
                      </button>
                    </td>
                    <td className="px-5 py-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">{copy.fleetStatuses[row.vehicle.status]}</td>
                    <td dir="ltr" className="px-5 py-3 text-end font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{nf.format(row.bookings)}</td>
                    <td dir="ltr" className="px-5 py-3 text-end font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{nf.format(row.rentalDays)}</td>
                    <td dir="ltr" className="px-5 py-3 text-end font-mono font-semibold tabular-nums text-slate-900 dark:text-white">{money(row.bookedValue)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-slate-100 sm:hidden dark:divide-slate-800">
            {(expanded?sorted:sorted.slice(0,8)).map(row=><button
              key={row.id} type="button" aria-pressed={focused===row.id}
              onClick={()=>setFocused(focused===row.id?null:row.id)}
              className={cn('w-full space-y-2 p-4 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                focused===row.id?'bg-indigo-50 dark:bg-indigo-950/30':'')}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-white">{row.vehicle.brand} {row.vehicle.model}</span>
                <span dir="ltr" className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{row.vehicle.plate_number}</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                <span>{copy.bookings}: <strong>{nf.format(row.bookings)}</strong></span>
                <span>{copy.bookedDays}: <strong>{nf.format(row.rentalDays)}</strong></span>
                <span>{copy.bookedValue}: <strong>{money(row.bookedValue)}</strong></span>
              </div>
            </button>)}
          </div>
          {sorted.length>8?<button type="button" onClick={()=>setExpanded(!expanded)}
            className="flex min-h-11 w-full items-center justify-center gap-2 border-t border-slate-100 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50 dark:border-slate-800 dark:text-indigo-300 dark:hover:bg-indigo-950/25">
            {expanded?copy.reset:copy.showAll}<ChevronDown className={cn('h-4 w-4 transition-transform',expanded?'rotate-180':'')}/>
          </button>:null}
        </>}
      </section>
      <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
        {copy.valueInfo} · {agency.timezone}
      </p>
    </main>
  );
}
