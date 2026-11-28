'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays, Check, Clock3, CarFront, Plus, RefreshCw,
  Search, Users, X, ArrowRight, AlertCircle, Loader2,
} from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Surface } from '@/components/ui/surface';
import { EmptyState } from '@/components/ui/empty-state';
import { AlertBanner } from '@/components/ui/alert-banner';
import type { AgencyRecord, AgencyRole } from '@/lib/agency/types';
import type { CustomerRecord } from '@/lib/customers/types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { ReservationRow, ReservationStatus } from '@/lib/supabase/database.types';
import { formatTndFromMillimes } from '@/lib/currency';
import { agencyLocalTimeToUtc, canTransitionReservation, RESERVATION_STATUSES } from '@/lib/reservations/domain';
import { getReservationCopy } from '@/lib/reservations/copy';

export interface ReservationsWorkspaceProps {
  agency: AgencyRecord;
  role: AgencyRole;
  initialReservations: ReservationRow[];
  initialVehicles: VehicleRecord[];
  initialCustomers: CustomerRecord[];
  initialError: string | null;
}

interface FormState {
  vehicleId: string; customerId: string;
  pickupAt: string; returnAt: string;
  pickupLocation: string; returnLocation: string; notes: string;
}
interface Quote {
  chargedDays: number;
  subtotalMinor: number;
  depositMinor: number;
  currencyCode: string;
  standardDays: number;
  seasonalDays: number;
}
const EMPTY_FORM: FormState = {
  vehicleId: '', customerId: '', pickupAt: '', returnAt: '',
  pickupLocation: '', returnLocation: '', notes: '',
};

const fieldClass = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-950 outline-none transition-colors focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-blue-400';
const labelClass = 'mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300';

export function ReservationsWorkspace({
  agency, role, initialReservations, initialVehicles, initialCustomers, initialError,
}: ReservationsWorkspaceProps) {
  const router = useRouter();
  const { locale } = useAppPreferences();
  const copy = getReservationCopy(locale);
  const [reservations, setReservations] = useState(initialReservations);
  const [loadError, setLoadError] = useState(initialError);
  const [feedback, setFeedback] = useState('');
  const [filter, setFilter] = useState<'all' | ReservationStatus>('all');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [quote, setQuote] = useState<{ key: string; value: Quote } | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalError, setModalError] = useState('');
  const [changingId, setChangingId] = useState<string | null>(null);
  const requestId = useRef(0);
  const creatingRef = useRef(false);
  const firstField = useRef<HTMLSelectElement>(null);

  const eligibleVehicles = useMemo(
    () => initialVehicles.filter(v => v.status !== 'maintenance' && v.status !== 'retired'),
    [initialVehicles]
  );
  const vehiclesById = useMemo(() => new Map(initialVehicles.map(v => [v.id, v])), [initialVehicles]);
  const customersById = useMemo(() => new Map(initialCustomers.map(c => [c.id, c])), [initialCustomers]);
  const customerName = (id: string) => {
    const c = customersById.get(id);
    return c ? c.customer_type === 'corporate' ? c.company_name || c.full_name : c.full_name : '—';
  };
  const vehicleName = (id: string) => {
    const v = vehiclesById.get(id);
    return v ? `${v.brand} ${v.model} · ${v.plate_number}` : '—';
  };

  const visible = useMemo(() => reservations.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLocaleLowerCase();
    const v = vehiclesById.get(r.vehicle_id);
    const c = customersById.get(r.customer_id);
    return [
      r.reference_code, v?.plate_number, v?.brand, v?.model,
      c?.full_name, c?.company_name,
    ].some(s => typeof s === 'string' && s.toLocaleLowerCase().includes(term));
  }), [reservations, filter, search, vehiclesById, customersById]);
  const summary = {
    total: reservations.length,
    pending: reservations.filter(r => r.status === 'pending' || r.status === 'draft').length,
    confirmed: reservations.filter(r => r.status === 'confirmed').length,
    active: reservations.filter(r => r.status === 'active').length,
  };
  const intlLocale = locale === 'en' ? 'en-GB' : locale === 'ar' ? 'ar-TN' : 'fr-TN';
  function formatDate(iso: string) {
    try {
      return new Intl.DateTimeFormat(intlLocale, {
        dateStyle: 'medium', timeStyle: 'short', timeZone: agency.timezone || 'Africa/Tunis',
      }).format(new Date(iso));
    } catch { return iso; }
  }
  const quoteKey = JSON.stringify(form);
  const canBook = eligibleVehicles.length > 0 && initialCustomers.length > 0 && agency.currency_code === 'TND';

  function editForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    requestId.current += 1;
    setForm(prev => ({ ...prev, [key]: value }));
    setQuote(null);
    setModalError('');
  }
  function buildPayload(): Record<string, string | null> | null {
    if (!form.vehicleId || !form.customerId || !form.pickupAt || !form.returnAt) return null;
    const pickupAt = agencyLocalTimeToUtc(form.pickupAt, agency.timezone);
    const returnAt = agencyLocalTimeToUtc(form.returnAt, agency.timezone);
    if (!pickupAt || !returnAt) return null;
    return {
      vehicleId: form.vehicleId, customerId: form.customerId, pickupAt, returnAt,
      pickupLocation: form.pickupLocation.trim() || null,
      returnLocation: form.returnLocation.trim() || null,
      notes: form.notes.trim() || null,
    };
  }
  async function calculateQuote() {
    const payload = buildPayload();
    if (!payload) { setModalError(copy.fromNow); return; }
    const myId = ++requestId.current;
    const key = quoteKey;
    setQuote(null);
    setModalError('');
    setQuoteBusy(true);
    try {
      const response = await fetch('/api/reservations/quote', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean; quote?: Quote; error?: string;
      } | null;
      if (myId !== requestId.current) return;
      if (!response.ok || !data?.ok || !data.quote) {
        setModalError(data?.error || copy.actionError);
        return;
      }
      setQuote({ key, value: data.quote });
    } catch {
      if (myId === requestId.current) setModalError(copy.actionError);
    } finally {
      if (myId === requestId.current) setQuoteBusy(false);
    }
  }
  async function createBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (creatingRef.current || saving || !quote || quote.key !== quoteKey) { setModalError(copy.quoteFirst); return; }
    const payload = buildPayload();
    if (!payload) { setModalError(copy.fromNow); return; }
    creatingRef.current = true;
    setSaving(true);
    setModalError('');
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          expectedSubtotalMinor: quote.value.subtotalMinor,
          expectedDepositMinor: quote.value.depositMinor,
        }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean; reservation?: ReservationRow; error?: string;
      } | null;
      if (!response.ok || !data?.ok || !data.reservation) {
        setModalError(data?.error || copy.actionError);
        setQuote(null); // A fresh availability check is required.
        return;
      }
      setReservations(prev => [data.reservation!, ...prev]);
      setFeedback(copy.createSuccess);
      setOpen(false);
      setForm({ ...EMPTY_FORM });
      setQuote(null);
      router.refresh();
    } catch { setModalError(copy.actionError); setQuote(null); }
    finally { creatingRef.current = false; setSaving(false); }
  }
  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const response = await fetch('/api/reservations', { cache: 'no-store' });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean; reservations?: ReservationRow[]; error?: string; agencyId?: string;
      } | null;
      if (!response.ok || !data?.ok || data.agencyId !== agency.id || !Array.isArray(data.reservations))
        setLoadError(data?.error || copy.actionError);
      else { setReservations(data.reservations); setLoadError(null); }
    } catch { setLoadError(copy.actionError); }
    finally { setRefreshing(false); }
  }
  async function changeStatus(reservation: ReservationRow, next: ReservationStatus) {
    if (changingId) return;
    if (next === 'cancelled' && !window.confirm(`${copy.cancel} ${reservation.reference_code}?`)) return;
    setChangingId(reservation.id);
    setLoadError(null);
    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = (await response.json().catch(() => null)) as {
        ok?: boolean; reservation?: ReservationRow; error?: string;
      } | null;
      if (!response.ok || !data?.ok || !data.reservation) {
        setLoadError(data?.error || copy.actionError);
      } else {
        setReservations(prev => prev.map(r => r.id === reservation.id ? data.reservation! : r));
        setFeedback(copy.statusSuccess);
        router.refresh();
      }
    } catch { setLoadError(copy.actionError); }
    finally { setChangingId(null); }
  }

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dismiss = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) setOpen(false);
    };
    document.addEventListener('keydown', dismiss);
    firstField.current?.focus();
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener('keydown', dismiss);
    };
  }, [open, saving]);

  function renderActions(reservation: ReservationRow) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {RESERVATION_STATUSES.filter(next => canTransitionReservation(reservation.status, next, role)).map(next => (
          <Button key={next} variant={next === 'cancelled' ? 'ghost' : 'secondary'}
            size="xs" disabled={Boolean(changingId)} onClick={() => changeStatus(reservation, next)}
            aria-label={`${copy.actions[next] || copy.statuses[next]} · ${reservation.reference_code}`}>
            {changingId === reservation.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              : next === 'cancelled' ? <X className="h-3.5 w-3.5" aria-hidden="true" />
              : <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />}
            {copy.actions[next] || copy.statuses[next]}
          </Button>
        ))}
      </div>
    );
  }
  const statusColors: Record<ReservationStatus, string> = {
    draft: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    pending: 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
    confirmed: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300',
    active: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    completed: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
    cancelled: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300',
  };
  const badge = (status: ReservationStatus) => (
    <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-semibold ${statusColors[status]}`}>
      {copy.statuses[status]}
    </span>
  );
  return (
    <main className="space-y-5 sm:space-y-6">
      <PageHeader title={copy.title} description={copy.description}
        meta={`${agency.name} · ${agency.timezone}`}
        action={<div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={refresh} disabled={refreshing} aria-label={copy.refresh}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span className="hidden sm:inline">{copy.refresh}</span>
          </Button>
          <Button variant="primary" onClick={() => { setForm({ ...EMPTY_FORM }); setModalError(''); setQuote(null); setOpen(true); }}
            disabled={!canBook} title={!canBook ? copy.createDisabled : undefined}>
            <Plus className="h-4 w-4" aria-hidden="true" /> {copy.newBooking}
          </Button>
        </div>} />
      {feedback ? <AlertBanner variant="success" onDismiss={() => setFeedback('')} dismissLabel={copy.close}>{feedback}</AlertBanner> : null}
      {loadError ? <AlertBanner variant="error">{loadError}</AlertBanner> : null}
      {!canBook ? <AlertBanner variant="warning">
        {eligibleVehicles.length === 0 ? copy.noVehicle : initialCustomers.length === 0 ? copy.noCustomer : copy.noRates}
      </AlertBanner> : null}

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 sm:gap-3" aria-label={copy.title}>
        {[
          { label: copy.all, value: summary.total, icon: CalendarDays, border: 'border-slate-200 dark:border-slate-800' },
          { label: copy.pending, value: summary.pending, icon: Clock3, border: 'border-amber-200 dark:border-amber-900/50' },
          { label: copy.upcoming, value: summary.confirmed, icon: Check, border: 'border-blue-200 dark:border-blue-900/50' },
          { label: copy.ongoing, value: summary.active, icon: CarFront, border: 'border-emerald-200 dark:border-emerald-900/50' },
        ].map(item => <div key={item.label}
          className={`rounded-2xl border ${item.border} bg-white p-4 shadow-[0_1px_3px_rgba(11,18,32,.04)] dark:bg-slate-900`}>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
            <item.icon className="h-4 w-4 text-slate-500 dark:text-slate-400" aria-hidden="true" />
          </div>
          <p className="mt-3 font-mono text-3xl font-bold tabular-nums tracking-tight text-slate-950 dark:text-white">{item.value}</p>
        </div>)}
      </section>

      <Surface className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-[#F4F6FA] px-4 py-4 dark:border-slate-800 dark:bg-slate-950/50 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute start-3 top-3.5 h-4 w-4 text-slate-500" aria-hidden="true" />
            <input aria-label={copy.search} placeholder={copy.search} value={search}
              onChange={event => setSearch(event.target.value)}
              className={`${fieldClass} ps-10`} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="reservation-filter" className="text-xs font-semibold text-slate-600 dark:text-slate-300">{copy.filters}</label>
            <select id="reservation-filter" value={filter}
              onChange={e => setFilter(e.target.value as typeof filter)}
              className={fieldClass}>
              <option value="all">{copy.all}</option>
              {RESERVATION_STATUSES.map(status => <option key={status} value={status}>{copy.statuses[status]}</option>)}
            </select>
          </div>
        </div>
        {visible.length === 0 ? <EmptyState
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          title={reservations.length === 0 ? copy.empty : copy.noResults}
          description={reservations.length === 0 ? copy.emptyHint : copy.noResults}
          action={canBook && reservations.length === 0
            ? <Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />{copy.newBooking}</Button>
            : undefined}
        /> : <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full border-collapse text-start text-sm">
              <thead className="bg-slate-50 text-start text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                <tr>{[copy.reference,copy.vehicle,copy.customer,copy.pickup,copy.return,copy.total,copy.status,copy.filters].map((col,i) =>
                  <th key={i} className="px-4 py-3 text-start font-semibold">{col}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {visible.map(r => <tr key={r.id} className="transition-colors hover:bg-slate-50/75 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-4 font-mono text-xs font-bold text-slate-900 dark:text-white" dir="ltr">{r.reference_code}</td>
                  <td className="max-w-52 px-4 py-4 text-xs font-semibold text-slate-900 dark:text-white">{vehicleName(r.vehicle_id)}</td>
                  <td className="max-w-48 px-4 py-4 text-xs text-slate-700 dark:text-slate-200">{customerName(r.customer_id)}</td>
                  <td className="px-4 py-4 text-xs text-slate-700 dark:text-slate-200">{formatDate(r.pickup_at)}</td>
                  <td className="px-4 py-4 text-xs text-slate-700 dark:text-slate-200">{formatDate(r.return_at)}</td>
                  <td className="px-4 py-4 whitespace-nowrap font-mono text-xs font-semibold tabular-nums text-slate-950 dark:text-white" dir="ltr">{formatTndFromMillimes(r.total_minor, locale)}</td>
                  <td className="px-4 py-4">{badge(r.status)}</td>
                  <td className="px-4 py-4">{renderActions(r)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-1 gap-3 bg-[#F4F6FA] p-3 md:grid-cols-2 lg:hidden dark:bg-slate-950/50">
            {visible.map(r => <article key={r.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_2px_6px_rgba(11,18,32,.04)] dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-mono text-sm font-bold text-slate-950 dark:text-white" dir="ltr">{r.reference_code}</p>
                {badge(r.status)}
              </div>
              <div className="mt-3 flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <CarFront className="h-5 w-5" aria-hidden="true"/>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950 dark:text-white">{vehicleName(r.vehicle_id)}</p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{customerName(r.customer_id)}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3 text-xs dark:border-slate-800">
                <div><span className="text-slate-500 dark:text-slate-400">{copy.pickup}</span>
                  <p className="mt-1 font-semibold text-slate-800 dark:text-white">{formatDate(r.pickup_at)}</p></div>
                <div><span className="text-slate-500 dark:text-slate-400">{copy.return}</span>
                  <p className="mt-1 font-semibold text-slate-800 dark:text-white">{formatDate(r.return_at)}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span dir="ltr" className="font-mono text-sm font-bold tabular-nums text-slate-950 dark:text-white">{formatTndFromMillimes(r.total_minor, locale)}</span>
                {renderActions(r)}
              </div>
            </article>)}
          </div>
        </>}
        <p className="border-t border-slate-200 bg-slate-50/80 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
          {copy.count(visible.length)} · {agency.name}
        </p>
      </Surface>

      {open ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
        onMouseDown={event => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="reservation-create-title"
          className="flex max-h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-slate-700 bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:bg-slate-900">
          <div className="flex items-start justify-between gap-4 bg-[#0B1220] px-5 py-4 text-white sm:px-6">
            <div className="min-w-0">
              <h2 id="reservation-create-title" className="font-display text-xl font-bold tracking-tight text-white">{copy.formTitle}</h2>
              <p className="mt-1 text-xs text-slate-300">{copy.formSubtitle}</p>
            </div>
            <button type="button" disabled={saving} onClick={() => setOpen(false)}
              aria-label={copy.close} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:ring-2 focus-visible:ring-blue-400">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <form onSubmit={createBooking} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
              {modalError ? <AlertBanner variant="error">{modalError}</AlertBanner> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="booking-vehicle">{copy.vehicle} *</label>
                  <select id="booking-vehicle" ref={firstField} required value={form.vehicleId}
                    onChange={e => editForm('vehicleId', e.target.value)} className={fieldClass}>
                    <option value="">—</option>
                    {eligibleVehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="booking-customer">{copy.customer} *</label>
                  <select id="booking-customer" required value={form.customerId}
                    onChange={e => editForm('customerId', e.target.value)} className={fieldClass}>
                    <option value="">—</option>
                    {initialCustomers.map(c => <option key={c.id} value={c.id}>
                      {c.customer_type === 'corporate' ? c.company_name || c.full_name : c.full_name}
                    </option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass} htmlFor="booking-pickup">{copy.pickup} *</label>
                  <input id="booking-pickup" type="datetime-local" dir="ltr" required
                    className={fieldClass} value={form.pickupAt}
                    onChange={e => editForm('pickupAt', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="booking-return">{copy.return} *</label>
                  <input id="booking-return" type="datetime-local" dir="ltr" required
                    className={fieldClass} value={form.returnAt}
                    onChange={e => editForm('returnAt', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
                <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {copy.fromNow}: <span dir="ltr" className="font-mono font-semibold">{agency.timezone || 'Africa/Tunis'}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelClass} htmlFor="booking-pickup-place">{copy.pickupPlace}</label>
                  <input id="booking-pickup-place" maxLength={160} value={form.pickupLocation}
                    onChange={e => editForm('pickupLocation', e.target.value)} className={fieldClass} />
                </div>
                <div>
                  <label className={labelClass} htmlFor="booking-return-place">{copy.returnPlace}</label>
                  <input id="booking-return-place" maxLength={160} value={form.returnLocation}
                    onChange={e => editForm('returnLocation', e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={labelClass} htmlFor="booking-notes">{copy.notes}</label>
                <textarea id="booking-notes" maxLength={1200} rows={2}
                  value={form.notes} onChange={e => editForm('notes', e.target.value)}
                  className={fieldClass} />
              </div>
              {quote?.key === quoteKey ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <Check className="h-4 w-4" aria-hidden="true"/>{copy.quoteSuccess} · {copy.days(quote.value.chargedDays)}
                </p>
                <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
                  <div><p className="text-xs text-slate-600 dark:text-slate-300">{copy.total}</p>
                    <p dir="ltr" className="font-mono text-2xl font-bold tabular-nums text-slate-950 dark:text-white">
                      {formatTndFromMillimes(quote.value.subtotalMinor, locale)}
                    </p></div>
                  <div><p className="text-xs text-slate-600 dark:text-slate-300">{copy.deposit}</p>
                    <p dir="ltr" className="font-mono text-base font-semibold text-slate-900 dark:text-white">
                      {formatTndFromMillimes(quote.value.depositMinor, locale)}
                    </p></div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{copy.taxNotice}</p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{copy.pendingNotice}</p>
              </div> : <p className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <AlertCircle className="h-4 w-4" aria-hidden="true"/>{copy.quoteFirst}
              </p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-[#F4F6FA] px-5 py-4 dark:border-slate-800 dark:bg-slate-950/70 sm:px-6">
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>{copy.cancel}</Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="secondary" onClick={calculateQuote} disabled={quoteBusy || saving}>
                  {quoteBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    : <Search className="h-4 w-4" aria-hidden="true" />}
                  {quoteBusy ? copy.calculating : copy.quote}
                </Button>
                <Button variant="primary" type="submit" disabled={saving || quoteBusy || quote?.key !== quoteKey}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    : <Plus className="h-4 w-4" aria-hidden="true" />}
                  {saving ? copy.creating : copy.create}
                </Button>
              </div>
            </div>
          </form>
        </section>
      </div> : null}
    </main>
  );
}
