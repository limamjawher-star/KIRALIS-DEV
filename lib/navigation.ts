export type NavGroupId = 'overview' | 'operations' | 'finance' | 'platform';

export type ModuleKey =
  | 'dashboard'
  | 'vehicles'
  | 'customers'
  | 'reservations'
  | 'calendar'
  | 'contracts'
  | 'payments'
  | 'maintenance'
  | 'reports'
  | 'assistant'
  | 'settings';

export type NavIconName =
  | 'LayoutDashboard'
  | 'Car'
  | 'Users'
  | 'CalendarCheck2'
  | 'CalendarRange'
  | 'FileText'
  | 'CreditCard'
  | 'Wrench'
  | 'BarChart3'
  | 'Sparkles'
  | 'Settings';

export interface NavItemConfig {
  key: ModuleKey;
  href: string;
  group: NavGroupId;
  icon: NavIconName;
  plannedPhase: string;
}

export const NAV_GROUP_ORDER: readonly NavGroupId[] = [
  'overview',
  'operations',
  'finance',
  'platform',
];

export const NAV_ITEMS: readonly NavItemConfig[] = [
  {
    key: 'dashboard',
    href: '/',
    group: 'overview',
    icon: 'LayoutDashboard',
    plannedPhase: 'Actif',
  },
  {
    key: 'vehicles',
    href: '/vehicles',
    group: 'operations',
    icon: 'Car',
    plannedPhase: 'Actif',
  },
  {
    key: 'customers',
    href: '/customers',
    group: 'operations',
    icon: 'Users',
    plannedPhase: 'Phase 6',
  },
  {
    key: 'reservations',
    href: '/reservations',
    group: 'operations',
    icon: 'CalendarCheck2',
    plannedPhase: 'Phase 6',
  },
  {
    key: 'calendar',
    href: '/calendar',
    group: 'operations',
    icon: 'CalendarRange',
    plannedPhase: 'Phase 6',
  },
  {
    key: 'contracts',
    href: '/contracts',
    group: 'finance',
    icon: 'FileText',
    plannedPhase: 'Phase 7',
  },
  {
    key: 'payments',
    href: '/payments',
    group: 'finance',
    icon: 'CreditCard',
    plannedPhase: 'Phase 7',
  },
  {
    key: 'maintenance',
    href: '/maintenance',
    group: 'finance',
    icon: 'Wrench',
    plannedPhase: 'Phase 8',
  },
  {
    key: 'reports',
    href: '/reports',
    group: 'finance',
    icon: 'BarChart3',
    plannedPhase: 'Phase 8',
  },
  {
    key: 'assistant',
    href: '/assistant',
    group: 'platform',
    icon: 'Sparkles',
    plannedPhase: 'Phase 9',
  },
  {
    key: 'settings',
    href: '/settings',
    group: 'platform',
    icon: 'Settings',
    plannedPhase: 'Actif',
  },
] as const;

export function getNavItemByPathname(pathname: string): NavItemConfig {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  const exact = NAV_ITEMS.find((item) => item.href === normalized);
  if (exact) return exact;

  const prefix = NAV_ITEMS.find(
    (item) => item.href !== '/' && normalized.startsWith(`${item.href}/`)
  );
  return prefix ?? NAV_ITEMS[0];
}

export function getNavItemsByGroup(group: NavGroupId): NavItemConfig[] {
  return NAV_ITEMS.filter((item) => item.group === group);
}
