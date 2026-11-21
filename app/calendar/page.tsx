import type { Metadata } from 'next';
import { CalendarView } from '@/components/modules/calendar-view';

export const metadata: Metadata = {
  title: 'Calendrier — KIRALIS',
};

export default function CalendarPage() {
  return <CalendarView />;
}
