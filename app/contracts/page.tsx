import type { Metadata } from 'next';
import { ContractsWorkspace } from '@/components/contracts/contracts-workspace';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyContractDrafts } from '@/lib/contracts/server';
import { listAgencyReservations } from '@/lib/reservations/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';
import { listAgencyCustomers } from '@/lib/customers/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Contrats — KIRALIS' };

export default async function ContractsPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const [registry, reservations, fleet, customers] = await Promise.all([
    listAgencyContractDrafts(activeAgency.id),
    listAgencyReservations(activeAgency.id),
    listAgencyVehicles(activeAgency.id),
    listAgencyCustomers(activeAgency.id),
  ]);
  return (
    <ContractsWorkspace
      key={activeAgency.id}
      agency={activeAgency}
      role={activeMembership.role}
      initialContracts={registry.contracts}
      schemaReady={registry.schemaReady}
      limited={registry.limited}
      initialError={registry.error || reservations.error || fleet.error || customers.error}
      reservations={reservations.reservations}
      vehicles={fleet.vehicles}
      customers={customers.customers}
    />
  );
}
