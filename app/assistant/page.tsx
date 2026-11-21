import type { Metadata } from 'next';
import { AssistantView } from '@/components/modules/assistant-view';

export const metadata: Metadata = {
  title: 'Assistant IA — KIRALIS',
};

export default function AssistantPage() {
  return <AssistantView />;
}
