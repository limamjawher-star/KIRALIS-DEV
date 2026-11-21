import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Clients — KIRALIS',
};

export default function CustomersPage() {
  return <TableModuleView moduleKey="customers" />;
}
