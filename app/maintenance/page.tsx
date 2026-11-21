import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Maintenance — KIRALIS',
};

export default function MaintenancePage() {
  return <TableModuleView moduleKey="maintenance" />;
}
