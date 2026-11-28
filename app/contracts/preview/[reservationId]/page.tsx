import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RentalAgreementPreview } from '@/components/contracts/rental-agreement-preview';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { isValidUuid } from '@/lib/agency/types';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ReservationRow } from '@/lib/supabase/database.types';
import type { VehicleRecord } from '@/lib/vehicles/types';
import type { CustomerRecord } from '@/lib/customers/types';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Fiche de préparation de location — KIRALIS',
};

export default async function RentalPreparationPage({
  params,
}: {params:Promise<{reservationId:string}>}) {
  const {activeAgency}=await requireActiveAgencyContext();
  const {reservationId}=await params;
  if(!isValidUuid(reservationId))notFound();
  const supabase=await createSupabaseServerClient();
  const {data:reservation,error:resError}=await supabase.from('reservations')
    .select('*')
    .eq('agency_id',activeAgency.id)
    .eq('id',reservationId)
    .maybeSingle();
  if(resError||!reservation||!['confirmed','active','completed'].includes(reservation.status))notFound();

  const [vehicleResult,customerResult]=await Promise.all([
    supabase.from('vehicles').select('*')
      .eq('agency_id',activeAgency.id).eq('id',reservation.vehicle_id).maybeSingle(),
    supabase.from('customers').select('*')
      .eq('agency_id',activeAgency.id).eq('id',reservation.customer_id).maybeSingle(),
  ]);
  if(vehicleResult.error||customerResult.error||!vehicleResult.data||!customerResult.data)notFound();
  return (
    <RentalAgreementPreview
      agency={activeAgency}
      booking={reservation as ReservationRow}
      vehicle={vehicleResult.data as VehicleRecord}
      customer={customerResult.data as CustomerRecord}
    />
  );
}
