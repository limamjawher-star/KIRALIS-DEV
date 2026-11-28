import type { Metadata } from 'next';
import { ReservationsWorkspace } from '@/components/reservations/reservations-workspace';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyCustomers } from '@/lib/customers/server';
import { listAgencyReservations } from '@/lib/reservations/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Réservations — KIRALIS',
};

/** Real RLS-scoped agency reservations. Nothing synthetic or hardcoded. */
export default async function ReservationsPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const [reservations, vehicles, customers] = await Promise.all([
    listAgencyReservations(activeAgency.id),
    listAgencyVehicles(activeAgency.id),
    listAgencyCustomers(activeAgency.id),
  ]);
  return (
    <ReservationsWorkspace
      key={activeAgency.id}
      agency={activeAgency}
      role={activeMembership.role}
      initialReservations={reservations.reservations}
      initialVehicles={vehicles.vehicles}
      initialCustomers={customers.customers}
      initialError={reservations.error || vehicles.error || customers.error}
    />
  );
}
