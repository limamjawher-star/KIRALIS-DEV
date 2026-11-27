import type { Metadata } from 'next';
import { CustomersDirectory } from '@/components/customers/customers-directory';
import { requireActiveAgencyContext } from '@/lib/agency/server';
import { listAgencyCustomers } from '@/lib/customers/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Clients — KIRALIS',
};

export default async function CustomersPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();
  const { customers, error } = await listAgencyCustomers(activeAgency.id);

  return (
    <CustomersDirectory
      agency={activeAgency}
      role={activeMembership.role}
      initialCustomers={customers}
      initialError={error}
    />
  );
}
