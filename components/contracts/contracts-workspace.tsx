'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, CalendarCheck2, CarFront, CheckCircle2,
  ClipboardList, FileText, LockKeyhole, Plus, RefreshCw, ShieldCheck,
} from 'lucide-react';
import type { AgencyRecord, AgencyRole } from '@/lib/agency/types';
import type { ReservationRow } from '@/lib/supabase/database.types';
import type { CustomerRecord } from '@/lib/customers/types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { RentalContractDraft } from '@/lib/contracts/server';
import type { HandoverInspection } from '@/lib/handovers/domain';
import { HandoverWorkspace } from '@/components/contracts/handover-workspace';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { cn } from '@/lib/utils';

type ContractCopy = {
  title: string; subtitle: string; privateDraft: string; newDraft: string;
  created: string; potential: string; blocked: string;
  ready: string; existing: string; noExisting: string;
  noReady: string; noReadyHint: string; intro: string; vehicle: string;
  client: string; reference: string; pickup: string; status: string;
  register: string; registerNote: string; migrationMissing: string;
  migrationNote: string; incomplete: string; errorPrefix: string;
  confirmOnly: string; legalNotice: string; refresh: string;
  create: string; saving: string; cancel: string; selectReservation: string;
  existingDraft: string; success: string; agentDenied: string;
  openBookings: string; openFleet: string; empty: string;
};
const TEXT: Record<'fr'|'en'|'ar',ContractCopy> = {
  fr: {
    title: 'Contrats', subtitle: 'Registre interne des dossiers prêts pour un contrat de location.',
    privateDraft: 'Brouillons internes', newDraft: 'Préparer un brouillon',
    created: 'Brouillons enregistrés', potential: 'Dossiers éligibles', blocked: 'En attente',
    ready: 'Réservations prêtes', existing: 'Registre des brouillons', noExisting: 'Aucun brouillon enregistré',
    noReady: 'Aucune réservation prête', noReadyHint: 'Confirmez une réservation dans le module Réservations avant de préparer un brouillon.',
    intro: 'Les brouillons sont liés aux réservations confirmées, en cours ou terminées de votre agence.',
    vehicle: 'Véhicule', client: 'Client', reference: 'Référence', pickup: 'Départ',
    status: 'Statut', register: 'Nouveau brouillon privé', registerNote: 'Un seul brouillon interne par réservation.',
    migrationMissing: 'Registre des contrats non installé', migrationNote: 'La migration SQL 0010 doit être vérifiée et appliquée avant toute création. Les réservations restent consultables.',
    incomplete: 'Seules les 500 dernières entrées du registre sont affichées.',
    errorPrefix: 'Lecture indisponible.', confirmOnly: 'Les réservations doivent être confirmées avant la création du brouillon.',
    legalNotice: 'Brouillon de suivi uniquement : aucun contrat légalement émis, aucune signature et aucun encaissement.',
    refresh: 'Actualiser', create: 'Créer le brouillon', saving: 'Enregistrement...', cancel: 'Annuler',
    selectReservation: 'Sélectionner une réservation', existingDraft: 'Déjà préparé',
    success: 'Brouillon interne enregistré.', agentDenied: 'Seuls les Propriétaires et Gestionnaires peuvent créer des brouillons.',
    openBookings: 'Réservations', openFleet: 'Flotte', empty: 'Aucun dossier sur cette période.',
  },
  en: {
    title: 'Contracts', subtitle: 'Internal register of rental bookings ready for agreement preparation.',
    privateDraft: 'Internal drafts', newDraft: 'Prepare a draft',
    created: 'Drafts saved', potential: 'Eligible bookings', blocked: 'Pending',
    ready: 'Ready reservations', existing: 'Draft registry', noExisting: 'No saved drafts',
    noReady: 'No eligible reservations', noReadyHint: 'Confirm a reservation first, then return here to prepare its draft.',
    intro: 'Drafts are linked to confirmed, active, or completed bookings in your agency.',
    vehicle: 'Vehicle', client: 'Customer', reference: 'Reference', pickup: 'Pickup',
    status: 'Status', register: 'New private draft', registerNote: 'Only one internal draft is allowed per booking.',
    migrationMissing: 'Contract registry not installed', migrationNote: 'SQL migration 0010 must be reviewed and installed before draft creation. Booking readiness remains available.',
    incomplete: 'Only the latest 500 contract drafts are currently displayed.',
    errorPrefix: 'Unable to read the contract registry.',
    confirmOnly: 'Bookings must be confirmed before a contract draft can be created.',
    legalNotice: 'Internal tracking draft only: no legal agreement has been issued or signed and no payment has been collected.',
    refresh: 'Refresh', create: 'Create draft', saving: 'Saving...', cancel: 'Cancel',
    selectReservation: 'Select reservation', existingDraft: 'Already prepared',
    success: 'Internal draft saved.', agentDenied: 'Only Owners and Managers can create drafts.',
    openBookings: 'Reservations', openFleet: 'Fleet', empty: 'No bookings in this period.',
  },
  ar: {
    title: 'العقود', subtitle: 'سجل داخلي للحجوزات الجاهزة لتحضير عقود الكراء.',
    privateDraft: 'مسودات داخلية', newDraft: 'تحضير مسودة',
    created: 'مسودات محفوظة', potential: 'حجوزات مؤهلة', blocked: 'في الانتظار',
    ready: 'حجوزات جاهزة', existing: 'سجل المسودات', noExisting: 'لا توجد مسودات محفوظة',
    noReady: 'لا توجد حجوزات مؤهلة', noReadyHint: 'أكّد حجزاً أولاً قبل إنشاء المسودة.',
    intro: 'ترتبط المسودات بالحجوزات المؤكدة والجارية والمكتملة داخل وكالتك.',
    vehicle: 'السيارة', client: 'العميل', reference: 'المرجع', pickup: 'التسليم',
    status: 'الحالة', register: 'مسودة داخلية جديدة', registerNote: 'مسودة واحدة لكل حجز.',
    migrationMissing: 'سجل العقود غير مثبت', migrationNote: 'يجب مراجعة وتثبيت SQL 0010 قبل إنشاء المسودات. يمكنك الاطلاع على الحجوزات.',
    incomplete: 'يتم عرض آخر 500 مسودة فقط.', errorPrefix: 'تعذر قراءة سجل العقود.',
    confirmOnly: 'يجب تأكيد الحجز قبل إنشاء مسودته.',
    legalNotice: 'مسودة إدارية فقط: لا توجد عقود قانونية موقعة ولا عمليات دفع.',
    refresh: 'تحديث', create: 'إنشاء المسودة', saving: 'جارٍ الحفظ...', cancel: 'إلغاء',
    selectReservation: 'اختر حجزاً', existingDraft: 'مسودة موجودة',
    success: 'تم حفظ المسودة الداخلية.', agentDenied: 'يمكن للمالك أو المدير فقط إنشاء المسودات.',
    openBookings: 'الحجوزات', openFleet: 'الأسطول', empty: 'لا توجد حجوزات خلال هذه الفترة.',
  },
};

export interface ContractsWorkspaceProps {
  agency: AgencyRecord;
  role: AgencyRole;
  reservations: ReservationRow[];
  vehicles: VehicleRecord[];
  customers: CustomerRecord[];
  initialContracts: RentalContractDraft[];
  schemaReady: boolean;
  limited: boolean;
  initialError: string | null;
  initialInspections: HandoverInspection[];
  inspectionSchemaReady: boolean;
  inspectionLimited: boolean;
  inspectionError: string | null;
}
const PANEL = 'min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_2px_12px_-7px_rgba(15,23,42,.15)] dark:border-slate-800 dark:bg-[#111827]';

export function ContractsWorkspace({
  agency, role, reservations, vehicles, customers,
  initialContracts, schemaReady, limited, initialError,
  initialInspections, inspectionSchemaReady, inspectionLimited, inspectionError,
}: ContractsWorkspaceProps) {
  const { locale } = useAppPreferences();
  const copy = TEXT[locale];
  const [contracts, setContracts] = React.useState(initialContracts);
  const [ready, setReady] = React.useState(schemaReady);
  const [limitedNow, setLimitedNow] = React.useState(limited);
  const [error, setError] = React.useState(initialError);
  const [success, setSuccess] = React.useState('');
  const [refreshing, setRefreshing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const [open, setOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState('');
  const canCreate = ready && (role === 'owner' || role === 'manager');
  const byVehicle = React.useMemo(() => new Map(vehicles.map(v=>[v.id,v])),[vehicles]);
  const byCustomer = React.useMemo(() => new Map(customers.map(c=>[c.id,c])),[customers]);
  const existing = new Set(contracts.map(c=>c.reservation_id));
  const eligible = reservations.filter(r =>
    ['confirmed','active','completed'].includes(r.status));
  const candidates = eligible.filter(r=>!existing.has(r.id));
  const pending = reservations.filter(r=>r.status==='pending'||r.status==='draft');
  const byReservation = React.useMemo(() => new Map(reservations.map(r=>[r.id,r])),[reservations]);
  const vehicleName = (id: string) => {
    const v=byVehicle.get(id);
    return v ? `${v.brand} ${v.model} · ${v.plate_number}` : '—';
  };
  const customerName = (id: string) => {
    const c=byCustomer.get(id);
    return c ? (c.customer_type==='corporate' ? c.company_name||c.full_name : c.full_name) : '—';
  };
  const intlLocale = locale==='ar'?'ar-TN':locale==='en'?'en-GB':'fr-TN';
  const fmtDate = (iso:string) => {
    try {
      return new Intl.DateTimeFormat(intlLocale,{
        day:'2-digit',month:'short',year:'numeric',
        timeZone:agency.timezone||'Africa/Tunis',
      }).format(new Date(iso));
    } catch { return iso; }
  };

  async function refresh() {
    if(refreshing)return;
    setRefreshing(true);setError(null);
    try {
      const res=await fetch('/api/contracts',{cache:'no-store'});
      const data=await res.json().catch(()=>null) as {
        ok?:boolean;agencyId?:string;contracts?:RentalContractDraft[];
        schemaReady?:boolean;limited?:boolean;error?:string;
      }|null;
      if(!res.ok||!data?.ok||data.agencyId!==agency.id||!Array.isArray(data.contracts))
        setError(data?.error||copy.errorPrefix);
      else {
        setContracts(data.contracts);
        setReady(Boolean(data.schemaReady));
        setLimitedNow(Boolean(data.limited));
      }
    }catch {setError(copy.errorPrefix);}
    finally{setRefreshing(false);}
  }
  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if(!canCreate||!selectedId||savingRef.current)return;
    savingRef.current=true;setSaving(true);setError(null);setSuccess('');
    try{
      const response=await fetch('/api/contracts',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({reservationId:selectedId}),
      });
      const data=await response.json().catch(()=>null) as {
        ok?:boolean;contract?:RentalContractDraft;error?:string;
      }|null;
      if(!response.ok||!data?.ok||!data.contract) {
        setError(data?.error||copy.errorPrefix);
        return;
      }
      setContracts(prev=>[data.contract!,...prev]);
      setSelectedId('');setOpen(false);setSuccess(copy.success);
    }catch{setError(copy.errorPrefix);}
    finally{savingRef.current=false;setSaving(false);}
  }

  return (
    <main className="min-w-0 space-y-4 pb-8 sm:space-y-5">
      <section className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-indigo-50/60 p-5 dark:border-slate-800 dark:from-[#101827] dark:to-[#17213e]">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/20">
            <FileText className="h-5 w-5" aria-hidden="true"/>
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-indigo-600 dark:text-indigo-300">
              {agency.name} · {copy.privateDraft}
            </p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
              {copy.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
              {copy.subtitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={refresh} disabled={refreshing}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <RefreshCw className={cn('h-4 w-4',refreshing?'animate-spin':'')}/>{copy.refresh}
          </button>
          <Link href="/reservations" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-indigo-600 px-3.5 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500">
            <CalendarCheck2 className="h-4 w-4"/>{copy.openBookings}<ArrowUpRight className="h-3.5 w-3.5"/>
          </Link>
        </div>
      </section>

      {error?<AlertBanner variant="error">{error}</AlertBanner>:null}
      {success?<AlertBanner variant="success">{success}</AlertBanner>:null}
      {!ready?<AlertBanner variant="warning">
        <strong>{copy.migrationMissing}.</strong> {copy.migrationNote}
      </AlertBanner>:null}
      {limitedNow?<AlertBanner variant="warning">{copy.incomplete}</AlertBanner>:null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {[
          {id:'drafts',label:copy.created,value:contracts.length,icon:FileText},
          {id:'eligible',label:copy.potential,value:candidates.length,icon:CheckCircle2},
          {id:'pending',label:copy.blocked,value:pending.length,icon:ClipboardList},
        ].map(item=><div key={item.id} className={cn(PANEL,'p-4')}>
          <div className="flex justify-between gap-2">
            <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{item.label}</p>
            <item.icon className="h-4 w-4 text-indigo-500"/>
          </div>
          <p className="mt-3 font-display text-3xl font-bold text-slate-950 dark:text-white">
            {new Intl.NumberFormat(intlLocale).format(item.value)}
          </p>
        </div>)}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className={PANEL}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-950 dark:text-white">{copy.existing}</h2>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{copy.intro}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[10.5px] font-semibold text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
              <ShieldCheck className="h-3.5 w-3.5"/>{copy.privateDraft}
            </span>
          </div>
          {contracts.length===0?<div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
            <FileText className="h-8 w-8 text-slate-300 dark:text-slate-600" aria-hidden="true"/>
            <p className="text-sm font-semibold text-slate-700 dark:text-white">{copy.noExisting}</p>
            <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">{ready?copy.registerNote:copy.migrationNote}</p>
          </div>:<div className="divide-y divide-slate-100 dark:divide-slate-800">
            {contracts.map(contract=>{
              const booking=byReservation.get(contract.reservation_id);
              return <div key={contract.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="min-w-0">
                  <p dir="ltr" className="font-mono text-xs font-bold text-slate-950 dark:text-white">{contract.contract_number}</p>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {booking?vehicleName(booking.vehicle_id):'—'} · {booking?customerName(booking.customer_id):'—'}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {booking?.reference_code||contract.reservation_id.slice(0,8)} · {fmtDate(contract.created_at)}
                  </p>
                </div>
                {booking && ['confirmed','active','completed'].includes(booking.status) ? <Link
                  href={`/contracts/preview/${booking.id}`}
                  className="inline-flex min-h-9 items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300">
                  {locale === 'fr' ? 'Fiche à imprimer' : locale === 'ar' ? 'ورقة للطباعة' : 'Print preparation sheet'}
                </Link> : null}
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true"/>{contract.status==='draft'?copy.privateDraft:contract.status}
                </span>
              </div>;
            })}
          </div>}
        </section>
        <section className={PANEL}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h2 className="text-sm font-bold text-slate-950 dark:text-white">{copy.ready}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{copy.intro}</p>
          </div>
          <div className="max-h-[380px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {candidates.length===0?<div className="p-5 text-center">
              <CheckCircle2 className="mx-auto h-6 w-6 text-slate-400"/>
              <p className="mt-2 text-xs font-semibold text-slate-700 dark:text-white">{copy.noReady}</p>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{copy.noReadyHint}</p>
            </div> : candidates.slice(0,20).map(booking=><div key={booking.id} className="px-5 py-3">
              <p dir="ltr" className="font-mono text-xs font-semibold text-slate-900 dark:text-white">{booking.reference_code}</p>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                <CarFront className="h-3.5 w-3.5" aria-hidden="true"/>
                {vehicleName(booking.vehicle_id)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{customerName(booking.customer_id)}</p>
            </div>)}
          </div>
          {!ready?<div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">{copy.migrationMissing}</p>
          </div>:!canCreate?<div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
            <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{copy.agentDenied}</p>
          </div>:<div className="border-t border-slate-100 p-4 dark:border-slate-800">
            {!open?<button type="button" disabled={candidates.length===0} onClick={()=>setOpen(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40">
              <Plus className="h-4 w-4"/>{copy.newDraft}
            </button>:<form className="space-y-3" onSubmit={createDraft}>
              <label htmlFor="contract-reservation" className="block text-xs font-semibold text-slate-700 dark:text-slate-200">
                {copy.selectReservation}
              </label>
              <select id="contract-reservation" required value={selectedId}
                onChange={e=>setSelectedId(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-xs text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                <option value="">—</option>
                {candidates.map(r=><option key={r.id} value={r.id}>
                  {r.reference_code} · {vehicleName(r.vehicle_id)}
                </option>)}
              </select>
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{copy.registerNote}</p>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" disabled={saving} onClick={()=>{setOpen(false);setSelectedId('');}}
                  className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">{copy.cancel}</button>
                <button type="submit" disabled={!selectedId||saving}
                  className="min-h-9 rounded-lg bg-indigo-600 px-3 text-xs font-semibold text-white disabled:opacity-40">
                  {saving?copy.saving:copy.create}
                </button>
              </div>
            </form>}
          </div>}
        </section>
      </div>
      <HandoverWorkspace
        key={agency.id}
        agency={agency}
        reservations={reservations}
        vehicles={vehicles}
        initialInspections={initialInspections}
        schemaReady={inspectionSchemaReady}
        limited={inspectionLimited}
        initialError={inspectionError}
      />
      <div className="flex flex-wrap items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
        <LockKeyhole className="h-4 w-4 shrink-0" aria-hidden="true"/>
        <p className="flex-1 leading-relaxed">{copy.legalNotice}</p>
        <Link href="/reservations" className="inline-flex shrink-0 items-center gap-1 font-semibold underline underline-offset-2">{copy.openBookings}<ArrowRight className="h-3 w-3 rtl:rotate-180"/></Link>
      </div>
    </main>
  );
}
