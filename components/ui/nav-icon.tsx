import React from 'react';
import {
  BarChart3,
  CalendarCheck2,
  CalendarRange,
  Car,
  CreditCard,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
  Users,
  Wrench,
} from 'lucide-react';
import type { NavIconName } from '@/lib/navigation';

const ICON_MAP: Record<NavIconName, React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
  LayoutDashboard,
  Car,
  Users,
  CalendarCheck2,
  CalendarRange,
  FileText,
  CreditCard,
  Wrench,
  BarChart3,
  Sparkles,
  Settings,
};

export function NavIcon({
  name,
  className = 'h-4 w-4',
}: {
  name: NavIconName;
  className?: string;
}) {
  const Icon = ICON_MAP[name];
  return <Icon className={className} aria-hidden={true} />;
}
