'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { NAV_ITEMS, type ModuleKey, type NavItemConfig } from '@/lib/navigation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { NavIcon } from '@/components/ui/nav-icon';
import { cn } from '@/lib/utils';

export interface MobileBottomNavProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
}

const PRIMARY_MOBILE_KEYS: readonly ModuleKey[] = [
  'dashboard',
  'vehicles',
  'customers',
  'reservations',
];

function isRouteActive(pathname: string, item: NavItemConfig): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function MobileBottomNav({
  onOpenMenu,
  menuOpen,
}: MobileBottomNavProps) {
  const pathname = usePathname();
  const { dict } = useAppPreferences();

  const primaryItems = PRIMARY_MOBILE_KEYS.map(
    (key) => NAV_ITEMS.find((item) => item.key === key)!
  );

  return (
    <nav
      aria-label={dict.common.workspace}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/90 bg-white/95 backdrop-blur-md lg:hidden dark:border-slate-800/90 dark:bg-slate-950/95"
    >
      <div className="mx-auto grid h-[56px] max-w-lg grid-cols-5 items-stretch px-1">
        {primaryItems.map((item) => {
          const active = !menuOpen && isRouteActive(pathname, item);
          const label = dict.modules[item.key].navLabel;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400',
                active
                  ? 'text-[#1D4ED8] dark:text-blue-400'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              <span
                className={cn(
                  'flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150',
                  active
                    ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/70 dark:text-blue-400'
                    : 'group-active:bg-slate-100 dark:group-active:bg-slate-800/70'
                )}
              >
                <NavIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="max-w-full truncate leading-none">{label}</span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-label={dict.common.openNavigation}
          aria-expanded={menuOpen}
          className={cn(
            'group flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400 cursor-pointer',
            menuOpen
              ? 'text-[#1D4ED8] dark:text-blue-400'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
          )}
        >
          <span
            className={cn(
              'flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150',
              menuOpen
                ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/70 dark:text-blue-400'
                : 'group-active:bg-slate-100 dark:group-active:bg-slate-800/70'
            )}
          >
            <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <span className="max-w-full truncate leading-none">Menu</span>
        </button>
      </div>
    </nav>
  );
}
