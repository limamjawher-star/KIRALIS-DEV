import type { Metadata } from 'next';
import { CalendarView } from '@/components/modules/calendar-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyReservations } from '@/lib/reservations/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';
import { listAgencyCustomers } from '@/lib/customers/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Calendrier — KIRALIS',
};

export default async function CalendarPage() {
  const { activeAgency } = await requireActiveAgencyContext();
  const [reservations, vehicles, customers] = await Promise.all([
    listAgencyReservations(activeAgency.id),
    listAgencyVehicles(activeAgency.id),
    listAgencyCustomers(activeAgency.id),
  ]);
  return (
    <CalendarView
      key={activeAgency.id}
      agency={activeAgency}
      reservations={reservations.reservations}
      vehicles={vehicles.vehicles}
      customers={customers.customers}
      initialError={reservations.error || vehicles.error || customers.error}
    />
  );
}
