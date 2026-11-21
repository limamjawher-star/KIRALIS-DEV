'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import {
  getNavItemsByGroup,
  NAV_GROUP_ORDER,
  type NavItemConfig,
} from '@/lib/navigation';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { NavIcon } from '@/components/ui/nav-icon';
import { cn } from '@/lib/utils';

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

function isRouteActive(pathname: string, item: NavItemConfig): boolean {
  if (item.href === '/') {
    return pathname === '/';
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { dict } = useAppPreferences();

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const renderNavContent = (isCompact: boolean, onLinkClick?: () => void) => (
    <div className="flex h-full flex-col">
      {/* Brand header */}
      <div
        className={cn(
          'flex h-[60px] shrink-0 items-center border-b border-slate-200 dark:border-slate-800',
          isCompact ? 'justify-center px-2' : 'justify-between px-4'
        )}
      >
        <Link
          href="/"
          onClick={onLinkClick}
          className="flex items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold tracking-tight text-white dark:bg-blue-600"
          >
            K
          </span>
          {!isCompact ? (
            <span className="font-display text-base font-bold tracking-tight text-slate-950 whitespace-nowrap dark:text-slate-50">
              KIRALIS
            </span>
          ) : null}
        </Link>

        {!onLinkClick && !isCompact ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={dict.common.collapseSidebar}
            title={dict.common.collapseSidebar}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:inline-flex dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}

        {onLinkClick ? (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label={dict.common.closeNavigation}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>

      {/* Navigation groups */}
      <nav
        aria-label={dict.common.workspace}
        className="flex-1 overflow-y-auto px-3 py-4 space-y-5"
      >
        {NAV_GROUP_ORDER.map((groupId) => {
          const items = getNavItemsByGroup(groupId);
          return (
            <div key={groupId} className="space-y-1">
              {!isCompact ? (
                <p className="px-2.5 pb-1 text-xs font-medium text-slate-400 dark:text-slate-500">
                  {dict.navGroups[groupId]}
                </p>
              ) : (
                <div
                  aria-hidden="true"
                  className="mx-auto my-2 h-px w-6 bg-slate-200 dark:bg-slate-800"
                />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = isRouteActive(pathname, item);
                  const label = dict.modules[item.key].navLabel;
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onLinkClick}
                        aria-current={active ? 'page' : undefined}
                        title={isCompact ? label : undefined}
                        className={cn(
                          'flex h-10 items-center rounded-lg text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400',
                          isCompact ? 'justify-center px-0' : 'gap-3 px-2.5',
                          active
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-slate-50'
                        )}
                      >
                        <NavIcon
                          name={item.icon}
                          className={cn(
                            'h-4 w-4 shrink-0',
                            active
                              ? 'text-blue-700 dark:text-blue-300'
                              : 'text-slate-500 dark:text-slate-400'
                          )}
                        />
                        {!isCompact ? (
                          <span className="truncate">{label}</span>
                        ) : (
                          <span className="sr-only">{label}</span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* Sidebar footer (expand button when collapsed on desktop) */}
      {isCompact ? (
        <div className="shrink-0 border-t border-slate-200 px-3 py-3 dark:border-slate-800">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={dict.common.expandSidebar}
              title={dict.common.expandSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'hidden shrink-0 border-e border-slate-200 bg-white lg:block dark:border-slate-800 dark:bg-slate-900',
          collapsed ? 'w-[72px]' : 'w-[252px]'
        )}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(collapsed)}</div>
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={dict.common.workspace}
        >
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[1px]"
            aria-hidden="true"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 flex h-full w-[272px] max-w-[85vw] flex-col border-e border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {renderNavContent(false, onCloseMobile)}
          </aside>
        </div>
      ) : null}
    </>
  );
}
