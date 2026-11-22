import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Contrats — KIRALIS',
};

export default async function ContractsPage() {
  await requireActiveAgencyContext();
  return <TableModuleView moduleKey="contracts" />;
}
