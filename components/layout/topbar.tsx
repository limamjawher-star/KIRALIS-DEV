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
import type { SupportedLocale } from '@/lib/currency';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';
import { AgencySelector } from './agency-selector';

const ACCOUNT_COPY: Record<
  SupportedLocale,
  {
    accountPrefix: string;
    accountMenuLabel: string;
    signedInAs: string;
    activeSession: string;
    signOut: string;
  }
> = {
  fr: {
    accountPrefix: 'Compte',
    accountMenuLabel: 'Menu du compte',
    signedInAs: 'Compte connecté',
    activeSession: 'Session active',
    signOut: 'Déconnexion',
  },
  en: {
    accountPrefix: 'Account',
    accountMenuLabel: 'Account menu',
    signedInAs: 'Signed in as',
    activeSession: 'Active session',
    signOut: 'Sign out',
  },
  ar: {
    accountPrefix: 'الحساب',
    accountMenuLabel: 'قائمة الحساب',
    signedInAs: 'الحساب المتصل',
    activeSession: 'جلسة نشطة',
    signOut: 'تسجيل الخروج',
  },
};

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
  const accountCopy = ACCOUNT_COPY[locale];
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
    <header className="sticky top-0 z-30 flex h-[54px] shrink-0 items-center justify-between gap-2.5 border-b border-slate-300/80 bg-white/95 px-3.5 backdrop-blur-md sm:h-[58px] sm:gap-6 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-[#0B1220]/95">
      {/* Left: Tablet drawer button + mobile brand + breadcrumb trail */}
      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={dict.common.openNavigation}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-white text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 md:inline-flex lg:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

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
          <span className="hidden text-xs font-medium text-slate-500 whitespace-nowrap md:inline dark:text-slate-400">
            {groupLabel}
          </span>
          <span
            className="hidden text-slate-300 md:inline dark:text-slate-700"
            aria-hidden="true"
          >
            /
          </span>
          <span className="truncate font-display text-[15px] font-bold tracking-[-0.02em] text-slate-950 dark:text-slate-50">
            {currentTitle}
          </span>
        </nav>
      </div>

      {/* Right: Agency selector + compact preferences + account popover */}
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <AgencySelector activeAgency={activeAgency} agencies={agencies} />

        {/* Language switcher (tablet/desktop) */}
        <div
          role="group"
          aria-label={dict.common.languageSelectorLabel}
          className="hidden items-center rounded-xl border border-slate-300/80 bg-slate-100 p-0.5 md:inline-flex dark:border-slate-700/90 dark:bg-slate-900"
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
                    ? 'bg-white text-slate-950 shadow-[0_1px_2px_rgba(15,23,42,0.1)] dark:bg-slate-800 dark:text-white'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
                )}
              >
                {code.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Light / Dark toggle */}
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
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300/80 bg-white text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 sm:inline-flex dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Account menu */}
        <div ref={accountMenuRef} className="relative">
          <button
            type="button"
            onClick={() => setAccountOpen((prev) => !prev)}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            aria-label={
              userEmail
                ? `${accountCopy.accountPrefix} ${userEmail}`
                : accountCopy.accountMenuLabel
            }
            className="inline-flex h-10 sm:h-9 items-center gap-2 rounded-xl border border-slate-300/80 bg-white ps-1.5 pe-2 text-xs font-medium text-slate-800 transition-colors hover:border-slate-400/80 hover:bg-slate-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0B1220] font-display text-[11px] font-bold text-white dark:bg-[#1D4ED8]">
              {initials}
            </span>
            {userEmail ? (
              <span
                dir="ltr"
                className="hidden max-w-[140px] truncate text-xs font-medium xl:inline"
              >
                {userEmail}
              </span>
            ) : null}
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 dark:text-slate-400',
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
                className="absolute end-0 top-[calc(100%+6px)] z-50 w-[264px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_16px_36px_-10px_rgba(11,18,32,0.22)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.65)]"
              >
                <div className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-3 dark:border-slate-800 dark:bg-slate-950/60">
                  <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {accountCopy.signedInAs}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 truncate text-xs font-semibold text-slate-950 rtl:text-right dark:text-slate-100"
                  >
                    {userEmail ?? accountCopy.activeSession}
                  </p>
                </div>

                {/* Quick preferences for narrow screens */}
                <div className="space-y-2 border-b border-slate-200 p-2.5 md:hidden dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label={dict.common.languageSelectorLabel}
                      className="inline-flex flex-1 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-950"
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
                              'h-8 flex-1 rounded-md text-[11px] font-semibold uppercase transition-colors cursor-pointer',
                              active
                                ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-white'
                                : 'text-slate-600 dark:text-slate-400'
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
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 sm:hidden dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 cursor-pointer"
                    >
                      {theme === 'dark' ? (
                        <Sun className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Moon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-0.5 p-1.5">
                  <Link
                    href="/settings"
                    role="menuitem"
                    onClick={() => setAccountOpen(false)}
                    className="flex h-10 sm:h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <Settings
                      className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
                      aria-hidden="true"
                    />
                    <span>{dict.modules.settings.title}</span>
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="flex h-10 sm:h-9 w-full items-center gap-2.5 rounded-xl px-2.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    {signingOut ? (
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                    ) : (
                      <LogOut
                        className="h-3.5 w-3.5 rtl:-scale-x-100"
                        aria-hidden="true"
                      />
                    )}
                    <span>{accountCopy.signOut}</span>
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
