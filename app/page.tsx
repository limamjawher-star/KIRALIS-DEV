import type { Metadata } from 'next';
import { DashboardView } from '@/components/modules/dashboard-view';
import { getAgencyDashboardStats, requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyReportBookings } from '@/lib/reports/server';
import { listAgencyVehicles } from '@/lib/vehicles/server';
import { agencyDateForInstant } from '@/lib/reservations/domain';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Tableau de bord — KIRALIS' };

export default async function DashboardPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const [stats, report, fleet] = await Promise.all([
    getAgencyDashboardStats(activeAgency.id),
    listAgencyReportBookings(activeAgency.id),
    listAgencyVehicles(activeAgency.id),
  ]);
  const today = agencyDateForInstant(new Date().toISOString(), activeAgency.timezone || 'Africa/Tunis')
    ?? new Date().toISOString().slice(0, 10);
  return <DashboardView
    key={activeAgency.id}
    agency={activeAgency}
    role={activeMembership.role}
    stats={stats}
    bookings={report.bookings}
    vehicles={fleet.vehicles}
    partial={report.limited}
    initialError={report.error || fleet.error}
    today={today}
  />;
}
