import type { Metadata } from 'next';
import { ReportsView } from '@/components/modules/reports-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Rapports — KIRALIS',
};

export default async function ReportsPage() {
  await requireActiveAgencyContext();
  return <ReportsView />;
}
