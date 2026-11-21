import type { Metadata } from 'next';
import { TableModuleView } from '@/components/modules/table-module-view';

export const metadata: Metadata = {
  title: 'Réservations — KIRALIS',
};

export default function ReservationsPage() {
  return <TableModuleView moduleKey="reservations" />;
}
