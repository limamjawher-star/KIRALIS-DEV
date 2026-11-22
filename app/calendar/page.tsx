import type { Metadata } from 'next';
import { CalendarView } from '@/components/modules/calendar-view';
import { requireActiveAgencyContext } from '@/lib/agency/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Calendrier — KIRALIS',
};

export default async function CalendarPage() {
  await requireActiveAgencyContext();
  return <CalendarView />;
}
