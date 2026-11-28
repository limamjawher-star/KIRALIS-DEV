'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileText, Printer, ShieldAlert } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import type { AgencyRecord } from '@/lib/agency/types';
import type { ReservationRow } from '@/lib/supabase/database.types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { CustomerRecord } from '@/lib/customers/types';
import { formatTndFromMillimes } from '@/lib/currency';

type PreviewCopy = {
  overline: string; title: string; draft: string; disclaimer: string;
  liveRecords: string; agency: string; renter: string; vehicle: string;
  rentalDetails: string; summary: string; bookedValue: string; deposit: string;
  currencyNote: string; pickup: string; return: string; plate: string; model: string;
  odometer: string; insurance: string; bookingRef: string; customerPhone: string;
  priceNote: string; print: string; back: string; notSigned: string; notPaid: string;
  pickupPlace: string; returnPlace: string;
};
const COPY: Record<'fr'|'en'|'ar',PreviewCopy> = {
  fr: {
    overline:'KIRALIS · fiche de préparation',title:'Fiche de location',draft:'DOCUMENT DE TRAVAIL',
    disclaimer:'Aperçu non contractuel tiré des données actuelles. Aucune clause juridique, signature électronique ou émission de contrat n’est fournie.',
    liveRecords:'Données actuelles · aucune version juridique figée',
    agency:'Agence',renter:'Locataire',vehicle:'Véhicule',rentalDetails:'Période de location',
    summary:'Réservations et montants',bookedValue:'Montant réservé',deposit:'Caution prévue',
    currencyNote:'Montants réservés, pas nécessairement encaissés.',
    pickup:'Départ prévu',return:'Retour prévu',plate:'Immatriculation',model:'Modèle',
    odometer:'Kilométrage enregistré',insurance:'Échéance assurance',
    bookingRef:'Référence réservation',customerPhone:'Téléphone client',
    priceNote:'Les taxes et conditions de paiement doivent être validées selon le pays et le contrat réel.',
    print:'Imprimer / enregistrer en PDF',back:'Retour aux contrats',
    notSigned:'Non signé',notPaid:'Aucun paiement attesté par ce document',
    pickupPlace:'Lieu de départ',returnPlace:'Lieu de retour',
  },
  en: {
    overline:'KIRALIS · preparation sheet',title:'Rental summary',draft:'WORKING DOCUMENT',
    disclaimer:'Non-binding preview from current live records. No approved legal terms, electronic signatures or contract issuance are provided.',
    liveRecords:'Current data · no immutable legal snapshot',
    agency:'Agency',renter:'Renter',vehicle:'Vehicle',rentalDetails:'Rental period',
    summary:'Booking and amounts',bookedValue:'Booked total',deposit:'Planned deposit',
    currencyNote:'Booked amounts, not necessarily collected.',
    pickup:'Planned pickup',return:'Planned return',plate:'Registration',model:'Model',
    odometer:'Recorded odometer',insurance:'Insurance expiry',
    bookingRef:'Reservation reference',customerPhone:'Customer phone',
    priceNote:'Taxes and payment terms must be validated against applicable local rules and the eventual legal agreement.',
    print:'Print / save as PDF',back:'Back to contracts',
    notSigned:'Not signed',notPaid:'No payment is certified by this sheet',
    pickupPlace:'Pickup location',returnPlace:'Return location',
  },
  ar: {
    overline:'KIRALIS · ورقة تحضير',title:'ملخص الكراء',draft:'وثيقة عمل داخلية',
    disclaimer:'معاينة غير ملزمة مستخرجة من البيانات الحالية. لا تتضمن شروطاً قانونية معتمدة أو توقيعاً إلكترونياً أو إصدار عقد.',
    liveRecords:'بيانات حالية · ليست نسخة قانونية ثابتة',
    agency:'الوكالة',renter:'المكتري',vehicle:'السيارة',rentalDetails:'مدة الكراء',
    summary:'الحجز والمبالغ',bookedValue:'المبلغ المحجوز',deposit:'الضمان المتوقع',
    currencyNote:'مبالغ الحجز وليست بالضرورة مبالغ مقبوضة.',
    pickup:'موعد التسليم',return:'موعد الإرجاع',plate:'الترقيم',model:'الطراز',
    odometer:'عداد الكيلومترات',insurance:'انتهاء التأمين',
    bookingRef:'مرجع الحجز',customerPhone:'هاتف العميل',
    priceNote:'تُراجع الضرائب وشروط الدفع حسب القوانين المحلية والعقد القانوني النهائي.',
    print:'طباعة / حفظ PDF',back:'الرجوع إلى العقود',
    notSigned:'غير موقّع',notPaid:'هذه الورقة لا تثبت قبض أي دفعة',
    pickupPlace:'مكان التسليم',returnPlace:'مكان الإرجاع',
  }
};

type Props = { agency:AgencyRecord; booking:ReservationRow;
  vehicle:VehicleRecord; customer:CustomerRecord; };
export function RentalAgreementPreview({agency,booking,vehicle,customer}:Props) {
  const {locale}=useAppPreferences();
  const c=COPY[locale];
  const loc=locale==='ar'?'ar-TN':locale==='en'?'en-GB':'fr-TN';
  const date=(value:string)=>new Intl.DateTimeFormat(loc,{
    dateStyle:'full',timeStyle:'short',timeZone:agency.timezone||'Africa/Tunis',
  }).format(new Date(value));
  const currency=(minor:number)=>agency.currency_code==='TND'
    ?formatTndFromMillimes(minor,locale):'—';
  const recipient=customer.customer_type==='corporate'
    ? customer.company_name||customer.full_name : customer.full_name;
  const row=(label:string,value:React.ReactNode,technical=false)=>(
    <div key={label} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-slate-100 py-2.5 text-sm last:border-b-0">
      <span className="text-slate-500">{label}</span>
      <span dir={technical?'ltr':undefined} className="max-w-[65%] break-words text-end font-semibold text-slate-900">{value||'—'}</span>
    </div>
  );
  return (
    <main className="mx-auto w-full max-w-[950px] space-y-5 pb-12">
      <style>{`@media print {
        .kiralis-no-print {display:none!important}
        .kiralis-print-area {border:0!important;box-shadow:none!important;margin:0!important;padding:0!important;max-width:none!important}
        body {background:white!important;color:#111827!important}
        .kiralis-print-area * {print-color-adjust:exact;-webkit-print-color-adjust:exact}
        @page {size:A4;margin:15mm}
      }`}</style>
      <div className="kiralis-no-print flex flex-wrap items-center justify-between gap-3">
        <Link href="/contracts" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-4 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-200">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180"/>{c.back}
        </Link>
        <button type="button" onClick={()=>window.print()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-400">
          <Printer className="h-4 w-4"/>{c.print}
        </button>
      </div>
      <article className="kiralis-print-area overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-slate-950 shadow-[0_12px_40px_-22px_rgba(10,16,32,.4)] sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-slate-900 pb-6">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.18em] text-indigo-700">KIRALIS</p>
            <p className="mt-1 text-[11px] text-slate-500">{c.overline}</p>
            <h1 className="mt-5 font-display text-3xl font-extrabold tracking-tight text-slate-950">{c.title}</h1>
            <p className="mt-2 font-mono text-xs text-slate-600" dir="ltr">{booking.reference_code}</p>
          </div>
          <div className="rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 text-center">
            <ShieldAlert className="mx-auto h-5 w-5 text-amber-700"/>
            <p className="mt-1 text-xs font-extrabold uppercase tracking-wider text-amber-900">{c.draft}</p>
            <p className="mt-1 text-[10px] font-semibold text-amber-800">{c.notSigned}</p>
          </div>
        </header>
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-xs leading-relaxed text-amber-900">
          {c.disclaimer}
        </div>
        <div className="mt-7 grid gap-x-9 gap-y-7 sm:grid-cols-2">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-extrabold text-slate-900">
              <FileText className="h-4 w-4 text-indigo-700"/>{c.agency}
            </h2>
            {row(c.agency,agency.legal_name||agency.name)}
            {row('Email',agency.email)}
            {row('Phone',agency.phone,true)}
            {row('Address', [agency.address,agency.city,agency.country_code].filter(Boolean).join(', '))}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">{c.renter}</h2>
            {row(c.renter,recipient)}
            {row(c.customerPhone,customer.phone,true)}
            {row('Email',customer.email,true)}
            {row('Country',customer.country_code,true)}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">{c.vehicle}</h2>
            {row(c.model,`${vehicle.brand} ${vehicle.model}`)}
            {row(c.plate,vehicle.plate_number,true)}
            {row(c.odometer,`${vehicle.odometer_km} km`,true)}
            {row(c.insurance,vehicle.insurance_expires_on,true)}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-extrabold text-slate-900">{c.rentalDetails}</h2>
            {row(c.pickup,date(booking.pickup_at))}
            {row(c.return,date(booking.return_at))}
            {row(c.pickupPlace,booking.pickup_location)}
            {row(c.returnPlace,booking.return_location)}
          </section>
        </div>
        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200">
          <h2 className="border-b border-slate-200 bg-slate-50 px-5 py-4 text-sm font-extrabold text-slate-900">{c.summary}</h2>
          <div className="px-5 py-2">
            {row(c.bookingRef,booking.reference_code,true)}
            {row(c.bookedValue,currency(booking.total_minor),true)}
            {row(c.deposit,currency(booking.deposit_minor),true)}
          </div>
          <p className="px-5 pb-4 text-xs text-slate-500">{c.currencyNote}</p>
        </section>
        <footer className="mt-9 border-t border-slate-200 pt-5 text-[11px] leading-relaxed text-slate-500">
          <p>{c.liveRecords}</p><p className="mt-1">{c.priceNote}</p>
          <p className="mt-3 font-semibold text-slate-700">{c.notPaid}</p>
        </footer>
      </article>
    </main>
  );
}
