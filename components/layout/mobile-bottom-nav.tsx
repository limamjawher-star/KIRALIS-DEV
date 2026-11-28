'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { motion } from 'motion/react';
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
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-slate-300/85 bg-white/95 shadow-[0_-4px_20px_-6px_rgba(11,18,32,0.1)] backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-[#0B1220]/95"
    >
      <div className="mx-auto grid h-[58px] max-w-lg grid-cols-5 items-stretch px-1">
        {primaryItems.map((item) => {
          const active = !menuOpen && isRouteActive(pathname, item);
          const label = dict.modules[item.key].navLabel;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10.5px] transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400',
                active
                  ? 'font-semibold text-[#1D4ED8] dark:text-blue-400'
                  : 'font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
              )}
            >
              {active ? (
                <motion.span
                  layoutId="mobile-bottom-nav-indicator"
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-x-3 top-0 h-[2.5px] rounded-b-full bg-[#1D4ED8] dark:bg-blue-400"
                />
              ) : null}
              <span
                className={cn(
                  'flex h-7 w-11 items-center justify-center rounded-xl transition-colors duration-150',
                  active
                    ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/75 dark:text-blue-400'
                    : 'group-active:bg-slate-100 dark:group-active:bg-slate-800/80'
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
            'group relative flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10.5px] transition-colors active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400 cursor-pointer',
            menuOpen
              ? 'font-semibold text-[#1D4ED8] dark:text-blue-400'
              : 'font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
          )}
        >
          {menuOpen ? (
            <motion.span
              layoutId="mobile-bottom-nav-indicator"
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-3 top-0 h-[2.5px] rounded-b-full bg-[#1D4ED8] dark:bg-blue-400"
            />
          ) : null}
          <span
            className={cn(
              'flex h-7 w-11 items-center justify-center rounded-xl transition-colors duration-150',
              menuOpen
                ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/75 dark:text-blue-400'
                : 'group-active:bg-slate-100 dark:group-active:bg-slate-800/80'
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
