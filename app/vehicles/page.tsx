import type { Metadata } from 'next';
import { VehiclesWorkspace } from '@/components/vehicles/vehicles-workspace';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Véhicules — KIRALIS',
};

export default async function VehiclesPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const { vehicles, error } = await listAgencyVehicles(activeAgency.id);

  return (
    <VehiclesWorkspace
      agency={activeAgency}
      role={activeMembership.role}
      initialVehicles={vehicles}
      initialError={error}
    />
  );
}
