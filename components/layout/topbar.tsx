'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronDown,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { getNavItemByPathname } from '@/lib/navigation';
import { SUPPORTED_LOCALES } from '@/lib/i18n/dictionaries';
import { KiralisMark } from '@/components/brand/kiralis-logo';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { performLogout } from '@/lib/auth/actions';
import type { AgencySummary } from '@/lib/agency/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';
import { AgencySelector } from './agency-selector';

export interface TopbarProps {
  onOpenMobileMenu: () => void;
  userEmail?: string | null;
  supabasePublicEnv?: SupabasePublicEnv | null;
  activeAgency?: AgencySummary | null;
  agencies?: AgencySummary[];
}

function getUserInitials(email: string | null): string {
  if (!email) return 'KR';
  const localPart = email.split('@')[0] ?? '';
  const cleaned = localPart.replace(/[^a-zA-Z0-9]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (localPart.slice(0, 2) || 'KR').toUpperCase();
}

export function Topbar({
  onOpenMobileMenu,
  userEmail = null,
  supabasePublicEnv = null,
  activeAgency = null,
  agencies = [],
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, locale, setLocale, dict } = useAppPreferences();
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const activeModule = getNavItemByPathname(pathname);
  const currentTitle = dict.modules[activeModule.key].title;
  const groupLabel = dict.navGroups[activeModule.group];
  const initials = getUserInitials(userEmail);

  useEffect(() => {
    if (!accountOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        accountMenuRef.current &&
        !accountMenuRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setAccountOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [accountOpen]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      if (supabasePublicEnv) {
        const supabase = createSupabaseBrowserClient(supabasePublicEnv);
        await performLogout(supabase.auth);
      }
      await fetch('/auth/signout', { method: 'POST' }).catch(() => null);
    } finally {
      setAccountOpen(false);
      router.replace('/login?message=signed_out');
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-slate-200/90 bg-white/92 px-3.5 backdrop-blur-md sm:h-[60px] sm:gap-4 sm:px-6 lg:px-8 dark:border-slate-800/90 dark:bg-slate-950/92">
      {/* Left: Mobile compact brand + title / Tablet menu + Breadcrumbs */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={dict.common.openNavigation}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 sm:inline-flex lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        {/* Mobile compact mark */}
        <Link
          href="/"
          aria-label="KIRALIS"
          className="inline-flex shrink-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 lg:hidden"
        >
          <KiralisMark size="sm" />
        </Link>

        <nav
          aria-label="Breadcrumb"
          className="flex min-w-0 items-center gap-2 text-sm"
        >
          <Link
            href="/"
            className="hidden font-display font-bold tracking-[-0.02em] text-slate-500 transition-colors hover:text-slate-900 whitespace-nowrap lg:inline dark:text-slate-400 dark:hover:text-slate-100"
          >
            KIRALIS
          </Link>
          <span
            className="hidden text-slate-300 lg:inline dark:text-slate-700"
            aria-hidden="true"
          >
            /
          </span>
          <span className="hidden text-slate-500 whitespace-nowrap md:inline dark:text-slate-400">
            {groupLabel}
          </span>
          <span
            className="hidden text-slate-300 md:inline dark:text-slate-700"
            aria-hidden="true"
          >
            /
          </span>
          <span className="truncate font-display text-[15px] font-semibold tracking-tight text-slate-950 sm:text-sm dark:text-slate-50">
            {currentTitle}
          </span>
        </nav>
      </div>

      {/* Right: Agency selector + Language + Theme + Unified Account popover */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <AgencySelector activeAgency={activeAgency} agencies={agencies} />

        {/* Language switcher (tablet/desktop) */}
        <div
          role="group"
          aria-label={dict.common.languageSelectorLabel}
          className="hidden items-center rounded-xl border border-slate-200/90 bg-slate-100/90 p-0.5 md:inline-flex dark:border-slate-800 dark:bg-slate-900"
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
                  'h-8 rounded-lg px-2.5 text-xs font-semibold uppercase whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400 cursor-pointer',
                  active
                    ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.08)] dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Light / Dark toggle (sm+) */}
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === 'dark'
              ? dict.common.toggleThemeLight
              : dict.common.toggleThemeDark
          }
          title={
            theme === 'dark'
              ? dict.common.toggleThemeLight
              : dict.common.toggleThemeDark
          }
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 sm:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Account menu (avatar + email + sign out) */}
        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((prev) => !prev)}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            aria-label={userEmail ? `Compte ${userEmail}` : 'Menu du compte'}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200/90 bg-white ps-1.5 pe-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#1D4ED8]/10 font-display text-[11px] font-bold text-[#1D4ED8] dark:bg-blue-500/20 dark:text-blue-300">
              {initials}
            </span>
            {userEmail ? (
              <span className="hidden max-w-[140px] truncate text-xs font-medium xl:inline">
                {userEmail}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform duration-150',
                accountOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>

          <AnimatePresence>
            {accountOpen ? (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                className="absolute end-0 top-[calc(100%+6px)] z-50 w-[264px] overflow-hidden rounded-2xl border border-slate-200/95 bg-white shadow-[0_12px_32px_-8px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_12px_32px_-8px_rgba(0,0,0,0.6)]"
              >
                <div className="border-b border-slate-200/90 px-3.5 py-3 dark:border-slate-800">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-slate-400 dark:text-slate-500">
                    Compte connecté
                  </p>
                  <p className="mt-0.5 truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {userEmail ?? 'Session active'}
                  </p>
                </div>

                {/* Quick preferences for narrow screens */}
                <div className="space-y-2 border-b border-slate-200/90 p-2.5 md:hidden dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label={dict.common.languageSelectorLabel}
                      className="inline-flex flex-1 items-center rounded-lg border border-slate-200/90 bg-slate-100/80 p-0.5 dark:border-slate-800 dark:bg-slate-950"
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
                              'h-7 flex-1 rounded-md text-[11px] font-semibold uppercase transition-colors cursor-pointer',
                              active
                                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                                : 'text-slate-500 dark:text-slate-400'
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
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-700 sm:hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <Sun className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : (
                        <Moon className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5 p-1.5">
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <Settings
                      className="h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                    <span>{dict.modules.settings.title}</span>
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    {signingOut ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                    <span>Déconnexion</span>
                  </button>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
