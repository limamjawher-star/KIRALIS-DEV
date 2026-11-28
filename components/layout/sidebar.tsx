'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Moon, PanelLeftClose, PanelLeftOpen, Sun, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  getNavItemsByGroup,
  NAV_GROUP_ORDER,
  type NavItemConfig,
} from '@/lib/navigation';
import { SUPPORTED_LOCALES } from '@/lib/i18n/dictionaries';
import { KiralisLogo } from '@/components/brand/kiralis-logo';
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
  const { dict, locale, setLocale, theme, toggleTheme } = useAppPreferences();

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

  const renderNavContent = (isCompact: boolean, isMobileDrawer = false) => {
    const onLinkClick = isMobileDrawer ? onCloseMobile : undefined;

    return (
      <div className="flex h-full flex-col bg-[#0B1220] text-slate-300 dark:bg-[#090E1A]">
        {/* Brand header */}
        <div
          className={cn(
            'flex h-[58px] shrink-0 items-center border-b border-slate-800/90',
            isCompact ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          <Link
            href="/"
            onClick={onLinkClick}
            aria-label="KIRALIS"
            className="flex items-center rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <KiralisLogo
              variant={isCompact ? 'mark' : 'compact'}
              size="md"
              tone="dark"
            />
          </Link>

          {!isMobileDrawer && !isCompact ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={dict.common.collapseSidebar}
              title={dict.common.collapseSidebar}
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800/80 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 lg:inline-flex cursor-pointer"
            >
              <PanelLeftClose
                className="h-4 w-4 rtl:rotate-180"
                aria-hidden="true"
              />
            </button>
          ) : null}

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={dict.common.closeNavigation}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Navigation groups */}
        <nav
          aria-label={dict.common.workspace}
          className="flex-1 space-y-5 overflow-y-auto px-3 py-4"
        >
          {NAV_GROUP_ORDER.map((groupId) => {
            const items = getNavItemsByGroup(groupId);
            return (
              <div key={groupId} className="space-y-1">
                {!isCompact ? (
                  <p className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-slate-500">
                    {dict.navGroups[groupId]}
                  </p>
                ) : (
                  <div
                    aria-hidden="true"
                    className="mx-auto my-2 h-px w-6 bg-slate-800"
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
                            'group relative flex items-center rounded-xl text-[13.5px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
                            isMobileDrawer ? 'h-11' : 'h-10',
                            isCompact ? 'justify-center px-0' : 'gap-3 px-3',
                            active
                              ? 'bg-[#1D4ED8] text-white shadow-[0_1px_2px_rgba(0,0,0,0.28)]'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          )}
                        >
                          <NavIcon
                            name={item.icon}
                            className={cn(
                              'h-[17px] w-[17px] shrink-0 transition-colors',
                              active
                                ? 'text-white'
                                : 'text-slate-400 group-hover:text-slate-100'
                            )}
                          />
                          {!isCompact ? (
                            <span className="truncate whitespace-nowrap">
                              {label}
                            </span>
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

        {/* Mobile drawer quick preferences (Language + Theme) */}
        {isMobileDrawer ? (
          <div className="shrink-0 space-y-3 border-t border-slate-800/90 bg-[#080D18] p-4">
            <div className="flex items-center justify-between gap-2">
              <div
                role="group"
                aria-label={dict.common.languageSelectorLabel}
                className="inline-flex flex-1 items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1"
              >
                {SUPPORTED_LOCALES.map((code) => {
                  const active = code === locale;
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setLocale(code)}
                      className={cn(
                        'h-9 flex-1 rounded-lg text-xs font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap',
                        active
                          ? 'bg-[#1D4ED8] text-white'
                          : 'text-slate-400 hover:text-white'
                      )}
                    >
                      {code.toUpperCase()}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                aria-label={
                  theme === 'dark'
                    ? dict.common.toggleThemeLight
                    : dict.common.toggleThemeDark
                }
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/90 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white cursor-pointer"
              >
                {theme === 'dark' ? (
                  <Sun className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ) : null}

        {/* Desktop collapsed expand button */}
        {!isMobileDrawer && isCompact ? (
          <div className="shrink-0 border-t border-slate-800/90 px-3 py-3">
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label={dict.common.expandSidebar}
                title={dict.common.expandSidebar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
              >
                <PanelLeftOpen
                  className="h-4 w-4 rtl:rotate-180"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const drawerOffsetX = locale === 'ar' ? 288 : -288;

  return (
    <>
      {/* Signature deep obsidian desktop sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 border-e border-slate-800/90 bg-[#0B1220] transition-[width] duration-200 ease-out lg:block dark:bg-[#090E1A]',
          collapsed ? 'w-[72px]' : 'w-[252px]'
        )}
      >
        <div className="sticky top-0 h-screen">{renderNavContent(collapsed)}</div>
      </aside>

      {/* Animated mobile slide-over drawer */}
      <AnimatePresence>
        {mobileOpen ? (
          <div
            className="fixed inset-0 z-50 flex lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label={dict.common.workspace}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
              aria-hidden="true"
              onClick={onCloseMobile}
            />
            <motion.aside
              initial={{ x: drawerOffsetX }}
              animate={{ x: 0 }}
              exit={{ x: drawerOffsetX }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex h-full w-[288px] max-w-[85vw] flex-col border-e border-slate-800 bg-[#0B1220] shadow-2xl"
            >
              {renderNavContent(false, true)}
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
