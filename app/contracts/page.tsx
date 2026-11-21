import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Contrats — KIRALIS',
};

export default function ContractsPage() {
  return <TableModuleView moduleKey="contracts" />;
}
