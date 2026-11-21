import type { Metadata } from 'next';
import { DashboardView } from '@/components/modules/dashboard-view';

export const metadata: Metadata = {
  title: 'Tableau de bord — KIRALIS',
};

export default function DashboardPage() {
  return <DashboardView />;
}
