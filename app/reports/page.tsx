import type { Metadata } from 'next';
import { ReportsView } from '@/components/modules/reports-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyReportBookings } from '@/lib/reports/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Rapports — KIRALIS' };

export default async function ReportsPage() {
  const { activeAgency } = await requireActiveAgencyContext();
  const [report, fleet] = await Promise.all([
    listAgencyReportBookings(activeAgency.id),
    listAgencyVehicles(activeAgency.id),
  ]);
  return (
    <ReportsView
      key={activeAgency.id}
      agency={activeAgency}
      bookings={report.bookings}
      vehicles={fleet.vehicles}
      partial={report.limited}
      initialError={report.error || fleet.error}
    />
  );
}
