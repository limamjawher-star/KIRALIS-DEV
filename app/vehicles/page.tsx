import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Véhicules — KIRALIS',
};

export default function VehiclesPage() {
  return <TableModuleView moduleKey="vehicles" />;
}
