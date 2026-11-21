import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Paiements — KIRALIS',
};

export default function PaymentsPage() {
  return <TableModuleView moduleKey="payments" />;
}
