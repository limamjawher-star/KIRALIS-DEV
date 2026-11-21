import type { Metadata } from 'next';
import { SettingsView } from '@/components/modules/settings-view';

export const metadata: Metadata = {
  title: 'Paramètres de l’agence — KIRALIS',
};

export default function SettingsPage() {
  return <SettingsView />;
}
