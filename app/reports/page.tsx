import type { Metadata } from 'next';
import { ReportsView } from '@/components/modules/reports-view';

export const metadata: Metadata = {
  title: 'Rapports — KIRALIS',
};

export default function ReportsPage() {
  return <ReportsView />;
}
