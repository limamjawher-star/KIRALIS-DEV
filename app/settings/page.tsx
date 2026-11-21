import type { Metadata } from 'next';
import { SettingsView } from '@/components/modules/settings-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Paramètres de l’agence — KIRALIS',
};

export default async function SettingsPage() {
  const { activeAgency, activeMembership } = await requireActiveAgencyContext();

  return (
    <SettingsView agency={activeAgency} role={activeMembership.role} />
  );
}
