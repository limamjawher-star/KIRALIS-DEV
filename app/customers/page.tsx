import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clients — KIRALIS',
};

export default async function CustomersPage() {
  await requireActiveAgencyContext();
  return <TableModuleView moduleKey="customers" />;
}
