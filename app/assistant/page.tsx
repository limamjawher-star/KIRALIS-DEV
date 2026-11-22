import type { Metadata } from 'next';
import { AssistantView } from '@/components/modules/assistant-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Assistant IA — KIRALIS',
};

export default async function AssistantPage() {
  await requireActiveAgencyContext();
  return <AssistantView />;
}
