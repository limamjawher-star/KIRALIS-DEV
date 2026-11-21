'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2, LogOut, Menu, Moon, Sun, User } from 'lucide-react';
import { getNavItemByPathname } from '@/lib/navigation';
import { SUPPORTED_LOCALES } from '@/lib/i18n/dictionaries';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { performLogout } from '@/lib/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

export interface TopbarProps {
  onOpenMobileMenu: () => void;
  userEmail?: string | null;
  supabaseConfigured?: boolean;
}

export function Topbar({
  onOpenMobileMenu,
  userEmail = null,
  supabaseConfigured = false,
}: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme, locale, setLocale, dict } = useAppPreferences();
  const [signingOut, setSigningOut] = useState(false);

  const activeModule = getNavItemByPathname(pathname);
  const currentTitle = dict.modules[activeModule.key].title;
  const groupLabel = dict.navGroups[activeModule.group];

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      if (supabaseConfigured) {
        const supabase = createSupabaseBrowserClient();
        await performLogout(supabase.auth);
      }
      await fetch('/auth/signout', { method: 'POST' }).catch(() => null);
    } finally {
      router.replace('/login?message=signed_out');
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-950/95">
      {/* Left: Mobile trigger + contextual breadcrumb */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label={dict.common.openNavigation}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 lg:hidden dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <Link
            href="/"
            className="font-display font-semibold text-slate-500 transition-colors hover:text-slate-900 whitespace-nowrap dark:text-slate-400 dark:hover:text-slate-100"
          >
            KIRALIS
          </Link>
          <span className="text-slate-300 dark:text-slate-700" aria-hidden="true">
            /
          </span>
          <span className="hidden text-slate-500 whitespace-nowrap sm:inline dark:text-slate-400">
            {groupLabel}
          </span>
          <span
            className="hidden text-slate-300 sm:inline dark:text-slate-700"
            aria-hidden="true"
          >
            /
          </span>
          <span className="truncate font-medium text-slate-950 dark:text-slate-50">
            {currentTitle}
          </span>
        </nav>
      </div>

      {/* Right: Language switcher + Light/Dark toggle + Authenticated user & Logout */}
      <div className="flex shrink-0 items-center gap-2">
        <div
          role="group"
          aria-label={dict.common.languageSelectorLabel}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-slate-900"
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
                  'h-8 rounded-md px-2.5 text-xs font-medium uppercase whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400 cursor-pointer',
                  active
                    ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                    : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
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
          title={
            theme === 'dark'
              ? dict.common.toggleThemeLight
              : dict.common.toggleThemeDark
          }
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {userEmail ? (
          <div className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 md:inline-flex dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            <User className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="max-w-[180px] truncate font-medium">{userEmail}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Se déconnecter"
          title="Se déconnecter"
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 whitespace-nowrap transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {signingOut ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
