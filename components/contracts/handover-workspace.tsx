'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, CarFront, ClipboardCheck, ClipboardPenLine, FileText,
  Gauge, LockKeyhole, RefreshCw, ShieldCheck,
} from 'lucide-react';
import type { AgencyRecord } from '@/lib/agency/types';
import type { ReservationRow } from '@/lib/supabase/database.types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import {
  eligibleHandover,
  type HandoverInspection, type InspectionKind, type VehicleCondition,
} from '@/lib/handovers/domain';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { cn } from '@/lib/utils';

type Copy = {
  title:string;sub:string;pickup:string;return:string;record:string;records:string;
  pending:string;missing:string;noInspections:string;choose:string;noEligible:string;
  mileage:string;fuel:string;exterior:string;interior:string;good:string;wear:string;
  damage:string;damageNotes:string;notes:string;keys:string;documents:string;
  attested:string;attestation:string;save:string;saving:string;
  saved:string;failed:string;date:string;vehicle:string;
  immutable:string;photoWarning:string;limit:string;
  refresh:string;preview:string;pickFirst:string;returnFirst:string;
};
const TEXT: Record<'fr'|'en'|'ar',Copy> = {
  fr:{
    title:'État des lieux',sub:'Consignez les départs et retours, sans modifier l’historique.',
    pickup:'Départ',return:'Retour',record:'Nouvel état des lieux',records:'Historique des contrôles',
    pending:'Aucune inspection disponible',missing:'La migration 0011 n’est pas installée : consultation uniquement.',
    noInspections:'Aucun contrôle enregistré pour cette agence.',choose:'Réservation éligible',
    noEligible:'Aucune réservation éligible pour cette étape.',
    mileage:'Kilométrage (km)',fuel:'Carburant (%)',exterior:'État extérieur',
    interior:'État intérieur',good:'Bon état',wear:'Usure normale',damage:'Dommage constaté',
    damageNotes:'Description des dommages',notes:'Notes complémentaires',keys:'Nombre de clés',
    documents:'Documents du véhicule présents',attested:'Je confirme personnellement ce contrôle.',
    attestation:'Attestation interne du membre du personnel, pas signature du client.',
    save:'Enregistrer définitivement',saving:'Enregistrement...',
    saved:'Contrôle enregistré et historisé.',failed:'Impossible d’enregistrer le contrôle.',
    date:'Enregistré le',vehicle:'Véhicule',immutable:'Enregistrement définitif : les modifications et suppressions sont désactivées.',
    photoWarning:'Photos de dommages indisponibles jusqu’à la mise en place d’un stockage privé sécurisé.',
    limit:'Historique limité aux 500 derniers contrôles.',
    refresh:'Actualiser',preview:'Fiche de location',pickFirst:'Contrôle de départ requis avant le retour.',
    returnFirst:'Le retour nécessite une réservation en cours ou terminée.',
  },
  en:{
    title:'Vehicle handover',sub:'Record pickup and return inspections with permanent history.',
    pickup:'Pickup',return:'Return',record:'New inspection',records:'Inspection history',
    pending:'No inspection data available',missing:'Migration 0011 is not installed. Read-only inspection view.',
    noInspections:'No inspection recorded for this agency.',choose:'Eligible booking',
    noEligible:'No eligible bookings for this step.',
    mileage:'Odometer (km)',fuel:'Fuel level (%)',exterior:'Exterior condition',
    interior:'Interior condition',good:'Good',wear:'Normal wear',damage:'Damage found',
    damageNotes:'Damage description',notes:'Additional notes',keys:'Number of keys',
    documents:'Vehicle documents present',attested:'I personally attest to this inspection.',
    attestation:'Internal staff attestation only, not a customer signature.',
    save:'Record permanently',saving:'Recording...',
    saved:'Inspection saved to permanent history.',failed:'Unable to record inspection.',
    date:'Recorded',vehicle:'Vehicle',immutable:'Permanent record: edits and deletion are disabled.',
    photoWarning:'Damage photo uploads are unavailable until private storage is securely configured.',
    limit:'Only the 500 most recent inspections are shown.',
    refresh:'Refresh',preview:'Rental preparation sheet',pickFirst:'A pickup inspection is required before the return.',
    returnFirst:'Return requires an active or completed booking.',
  },
  ar:{
    title:'معاينة السيارة',sub:'سجّل حالة السيارة عند التسليم والإرجاع مع تاريخ دائم.',
    pickup:'تسليم',return:'إرجاع',record:'معاينة جديدة',records:'سجل المعاينات',
    pending:'لا توجد بيانات معاينة',missing:'لم يتم تثبيت الترحيل 0011؛ المعاينة للقراءة فقط.',
    noInspections:'لا توجد معاينات مسجلة لهذه الوكالة.',choose:'حجز مؤهل',
    noEligible:'لا توجد حجوزات مؤهلة لهذه الخطوة.',
    mileage:'عداد الكيلومترات',fuel:'مستوى الوقود (%)',exterior:'الحالة الخارجية',
    interior:'الحالة الداخلية',good:'جيدة',wear:'استهلاك عادي',damage:'ضرر مسجل',
    damageNotes:'وصف الأضرار',notes:'ملاحظات إضافية',keys:'عدد المفاتيح',
    documents:'وثائق السيارة موجودة',attested:'أؤكد شخصياً إجراء هذه المعاينة.',
    attestation:'إقرار داخلي من الموظف، وليس توقيعاً من العميل.',
    save:'تسجيل نهائي',saving:'جارٍ التسجيل...',
    saved:'تم حفظ المعاينة في السجل الدائم.',failed:'تعذر تسجيل المعاينة.',
    date:'تاريخ التسجيل',vehicle:'السيارة',immutable:'سجل دائم: التعديل والحذف غير متاحين.',
    photoWarning:'رفع صور الأضرار غير متاح حتى إعداد تخزين خاص وآمن.',
    limit:'تظهر آخر 500 معاينة فقط.',
    refresh:'تحديث',preview:'ورقة تحضير الكراء',pickFirst:'يجب تسجيل معاينة التسليم قبل الإرجاع.',
    returnFirst:'يتطلب الإرجاع حجزاً جارياً أو مكتملاً.',
  },
};
const CONDITION_VALUES: readonly VehicleCondition[]=['good','minor_wear','damage'];
const PANEL='min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-[#111827]';
const FIELD='min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white';
const LABEL='mb-1.5 block text-[11px] font-semibold text-slate-700 dark:text-slate-300';

export interface HandoverWorkspaceProps {
  agency:AgencyRecord;
  reservations:ReservationRow[];
  vehicles:VehicleRecord[];
  initialInspections:HandoverInspection[];
  schemaReady:boolean;
  limited:boolean;
  initialError:string|null;
}

export function HandoverWorkspace({
  agency,reservations,vehicles,initialInspections,schemaReady,limited,initialError,
}:HandoverWorkspaceProps) {
  const {locale}=useAppPreferences();
  const copy=TEXT[locale];
  const [inspections,setInspections]=React.useState(initialInspections);
  const [ready,setReady]=React.useState(schemaReady);
  const [limitedNow,setLimited]=React.useState(limited);
  const [error,setError]=React.useState<string|null>(initialError);
  const [success,setSuccess]=React.useState('');
  const [kind,setKind]=React.useState<InspectionKind>('pickup');
  const [reservationId,setReservationId]=React.useState('');
  const [odometer,setOdometer]=React.useState('');
  const [fuel,setFuel]=React.useState('100');
  const [exterior,setExterior]=React.useState<VehicleCondition>('good');
  const [interior,setInterior]=React.useState<VehicleCondition>('good');
  const [damageNotes,setDamageNotes]=React.useState('');
  const [notes,setNotes]=React.useState('');
  const [keys,setKeys]=React.useState('2');
  const [documents,setDocuments]=React.useState(true);
  const [attested,setAttested]=React.useState(false);
  const [saving,setSaving]=React.useState(false);
  const [refreshing,setRefreshing]=React.useState(false);
  const savingRef=React.useRef(false);
  const vehicleById=React.useMemo(()=>new Map(vehicles.map(v=>[v.id,v])),[vehicles]);
  const bookingById=React.useMemo(()=>new Map(reservations.map(r=>[r.id,r])),[reservations]);
  const inspectionByReservation=React.useMemo(()=>{
    const map=new Map<string,{pickup?:HandoverInspection;return?:HandoverInspection}>();
    for(const inspection of inspections) {
      const row=map.get(inspection.reservation_id)??{};
      if(inspection.inspection_kind==='pickup')row.pickup=inspection;
      else row.return=inspection;
      map.set(inspection.reservation_id,row);
    }
    return map;
  },[inspections]);
  const candidates=reservations.filter(r=>{
    const prior=inspectionByReservation.get(r.id);
    return eligibleHandover(r.status,kind,!!prior?.pickup,!!prior?.return);
  });
  const selected=bookingById.get(reservationId);
  const pickup=inspectionByReservation.get(reservationId)?.pickup;
  const vehicleName=(id:string)=>{
    const v=vehicleById.get(id);
    return v?`${v.brand} ${v.model} · ${v.plate_number}`:'—';
  };
  const date=(s:string)=>{
    try {return new Intl.DateTimeFormat(locale==='ar'?'ar-TN':locale==='en'?'en-GB':'fr-FR',{
      dateStyle:'medium',timeStyle:'short',timeZone:agency.timezone||'Africa/Tunis',
    }).format(new Date(s));}catch{return s;}
  };
  const resetFields=()=>{
    setReservationId('');setOdometer('');setFuel('100');
    setExterior('good');setInterior('good');setDamageNotes('');
    setNotes('');setKeys('2');setDocuments(true);setAttested(false);
  };

  async function refresh(){
    if(refreshing)return;
    setRefreshing(true);setError(null);
    try{
      const response=await fetch('/api/handovers',{cache:'no-store'});
      const payload=await response.json().catch(()=>null) as {
        ok?:boolean;agencyId?:string;inspections?:HandoverInspection[];
        schemaReady?:boolean;limited?:boolean;error?:string;
      }|null;
      if(!response.ok||!payload?.ok||payload.agencyId!==agency.id||
        !Array.isArray(payload.inspections))setError(payload?.error||copy.failed);
      else {
        setInspections(payload.inspections);setReady(Boolean(payload.schemaReady));
        setLimited(Boolean(payload.limited));
      }
    }catch{setError(copy.failed);}
    finally{setRefreshing(false);}
  }

  async function submit(event:React.FormEvent){
    event.preventDefault();
    if(!ready||!reservationId||!attested||savingRef.current)return;
    savingRef.current=true;setSaving(true);setError(null);setSuccess('');
    try{
      const response=await fetch('/api/handovers',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({
          reservationId,kind,odometerKm:Number(odometer),fuelPercent:Number(fuel),
          exteriorCondition:exterior,interiorCondition:interior,
          damageNotes,notes,keysCount:Number(keys),documentsPresent:documents,attested:true,
        }),
      });
      const result=await response.json().catch(()=>null) as {
        ok?:boolean;inspection?:HandoverInspection;agencyId?:string;error?:string;
      }|null;
      if(!response.ok||!result?.ok||!result.inspection||result.agencyId!==agency.id)
        setError(result?.error||copy.failed);
      else{
        setInspections(old=>[result.inspection!,...old]);
        resetFields();setSuccess(copy.saved);
      }
    }catch{setError(copy.failed);}
    finally{savingRef.current=false;setSaving(false);}
  }

  return (
    <section aria-labelledby="handover-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#101827] text-indigo-300">
            <ClipboardCheck className="h-5 w-5"/>
          </span>
          <div>
            <h2 id="handover-title" className="font-display text-xl font-extrabold tracking-tight text-slate-950 dark:text-white">{copy.title}</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-600 dark:text-slate-300">{copy.sub}</p>
          </div>
        </div>
        <button type="button" disabled={refreshing} onClick={refresh}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
          <RefreshCw className={cn('h-4 w-4',refreshing?'animate-spin':'')}/>{copy.refresh}
        </button>
      </div>
      {error?<AlertBanner variant="error">{error}</AlertBanner>:null}
      {success?<AlertBanner variant="success">{success}</AlertBanner>:null}
      {!ready?<AlertBanner variant="warning">{copy.missing}</AlertBanner>:null}
      {limitedNow?<AlertBanner variant="warning">{copy.limit}</AlertBanner>:null}
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={PANEL}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">{copy.record}</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{copy.attestation}</p>
          </div>
          <form onSubmit={submit} className="space-y-4 p-5">
            <div role="group" aria-label={copy.title} className="grid grid-cols-2 gap-2">
              {(['pickup','return'] as InspectionKind[]).map(k=><button
                type="button" key={k} disabled={saving} aria-pressed={kind===k}
                onClick={()=>{setKind(k);resetFields();}}
                className={cn('min-h-11 rounded-xl border text-xs font-bold transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500',
                  kind===k?'border-indigo-600 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300'
                    :'border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300')}>
                {k==='pickup'?copy.pickup:copy.return}
              </button>)}
            </div>
            <div>
              <label className={LABEL} htmlFor="handover-booking">{copy.choose}</label>
              <select id="handover-booking" required disabled={!ready||saving}
                className={FIELD} value={reservationId}
                onChange={e=>{
                  const id=e.target.value;setReservationId(id);
                  const b=bookingById.get(id);
                  const v=b?vehicleById.get(b.vehicle_id):null;
                  const prior=inspectionByReservation.get(id)?.pickup;
                  setOdometer(prior?String(prior.odometer_km):v?String(v.odometer_km):'');
                }}>
                <option value="">{candidates.length?copy.choose:copy.noEligible}</option>
                {candidates.map(r=><option value={r.id} key={r.id}>
                  {r.reference_code} · {vehicleName(r.vehicle_id)}
                </option>)}
              </select>
              {selected?<div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-slate-600 dark:text-slate-300">{date(selected.pickup_at)}</span>
                <Link href={`/contracts/preview/${selected.id}`}
                  className="inline-flex items-center gap-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
                  {copy.preview}<ArrowUpRight className="h-3.5 w-3.5"/>
                </Link>
              </div>:null}
              {kind==='return'&&!pickup?<p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{copy.pickFirst}</p>:null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL} htmlFor="handover-odometer">{copy.mileage}</label>
                <input id="handover-odometer" name="odometer" type="number"
                  required min="0" max="3000000" step="1" value={odometer}
                  onChange={e=>setOdometer(e.target.value)}
                  disabled={!ready||saving} className={FIELD}/>
              </div>
              <div>
                <label className={LABEL} htmlFor="handover-fuel">{copy.fuel}</label>
                <input id="handover-fuel" name="fuel" type="number"
                  required min="0" max="100" step="1" value={fuel}
                  onChange={e=>setFuel(e.target.value)}
                  disabled={!ready||saving} className={FIELD}/>
              </div>
              <div>
                <label className={LABEL} htmlFor="handover-exterior">{copy.exterior}</label>
                <select id="handover-exterior" value={exterior} disabled={!ready||saving}
                  onChange={e=>setExterior(e.target.value as VehicleCondition)}
                  className={FIELD}>
                  {CONDITION_VALUES.map(k=><option key={k} value={k}>
                    {k==='good'?copy.good:k==='minor_wear'?copy.wear:copy.damage}
                  </option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="handover-interior">{copy.interior}</label>
                <select id="handover-interior" value={interior} disabled={!ready||saving}
                  onChange={e=>setInterior(e.target.value as VehicleCondition)} className={FIELD}>
                  {CONDITION_VALUES.map(k=><option key={k} value={k}>
                    {k==='good'?copy.good:k==='minor_wear'?copy.wear:copy.damage}
                  </option>)}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="handover-keys">{copy.keys}</label>
                <input type="number" id="handover-keys" min="0" max="10" step="1"
                  required value={keys} onChange={e=>setKeys(e.target.value)}
                  disabled={!ready||saving} className={FIELD}/>
              </div>
              <div className="flex items-end">
                <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={documents} onChange={e=>setDocuments(e.target.checked)}
                    disabled={!ready||saving} className="h-4 w-4 accent-indigo-600"/>
                  {copy.documents}
                </label>
              </div>
            </div>
            <div>
              <label className={LABEL} htmlFor="handover-damage">{copy.damageNotes}</label>
              <textarea id="handover-damage" rows={2} maxLength={1200}
                required={exterior==='damage'||interior==='damage'} disabled={!ready||saving}
                value={damageNotes} onChange={e=>setDamageNotes(e.target.value)}
                className={cn(FIELD,'resize-y py-3')}/>
            </div>
            <div>
              <label className={LABEL} htmlFor="handover-notes">{copy.notes}</label>
              <textarea id="handover-notes" rows={2} maxLength={1000}
                disabled={!ready||saving} value={notes}
                onChange={e=>setNotes(e.target.value)} className={cn(FIELD,'resize-y py-3')}/>
            </div>
            <label className="flex items-start gap-2 rounded-xl bg-indigo-50 p-3 text-xs font-medium text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200">
              <input type="checkbox" required checked={attested}
                onChange={e=>setAttested(e.target.checked)} disabled={!ready||saving}
                className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-600"/>
              {copy.attested}
            </label>
            <button type="submit" disabled={!ready||!reservationId||!attested||saving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-bold text-white transition-colors hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-40">
              <ShieldCheck className="h-4 w-4"/>{saving?copy.saving:copy.save}
            </button>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">{copy.immutable}</p>
          </form>
        </div>
        <div className={PANEL}>
          <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <h3 className="text-sm font-bold text-slate-950 dark:text-white">{copy.records}</h3>
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{copy.immutable}</p>
          </div>
          {inspections.length===0?<div className="flex flex-col items-center gap-3 p-10 text-center">
            <ClipboardPenLine className="h-8 w-8 text-slate-400" aria-hidden="true"/>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{copy.noInspections}</p>
          </div>:<div className="max-h-[700px] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
            {inspections.map(item=>{
              const reservation=bookingById.get(item.reservation_id);
              return <div key={item.id} className="space-y-2 px-5 py-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={cn('rounded-lg px-2.5 py-1 text-[11px] font-bold',
                    item.inspection_kind==='pickup'?'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300'
                      :'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>
                    {item.inspection_kind==='pickup'?copy.pickup:copy.return}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{date(item.created_at)}</span>
                </div>
                <p dir="ltr" className="font-mono font-semibold text-slate-950 dark:text-white">{reservation?.reference_code??item.reservation_id.slice(0,8)}</p>
                <p className="text-slate-600 dark:text-slate-300">{reservation?vehicleName(reservation.vehicle_id):'—'}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-2 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1"><Gauge className="h-3.5 w-3.5"/>{item.odometer_km} km</span>
                  <span>{item.fuel_percent}%</span>
                  <span>{copy.keys}: {item.keys_count}</span>
                </div>
                {item.damage_notes?<p className="break-words rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">{item.damage_notes}</p>:null}
                {item.notes?<p className="break-words text-[11px] text-slate-600 dark:text-slate-300">{item.notes}</p>:null}
                <div className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <LockKeyhole className="h-3.5 w-3.5"/>{copy.attestation}
                </div>
              </div>;
            })}
          </div>}
          <div className="flex items-start gap-2 border-t border-slate-100 bg-slate-50 p-4 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
            <FileText className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true"/>
            {copy.photoWarning}
          </div>
        </div>
      </div>
    </section>
  );
}
