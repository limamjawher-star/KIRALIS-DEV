import type { Metadata } from 'next';
import { DashboardView } from '@/components/modules/dashboard-view';
import {
  getAgencyDashboardStats,
  requireActiveAgencyContext,
} from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tableau de bord — KIRALIS',
};

export default async function DashboardPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const stats = await getAgencyDashboardStats(activeAgency.id);

  return (
    <DashboardView
      agency={activeAgency}
      role={activeMembership.role}
      stats={stats}
    />
  );
}
