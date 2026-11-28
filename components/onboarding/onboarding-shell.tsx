'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, LogOut, Moon, Sun, User } from 'lucide-react';
import { motion } from 'motion/react';
import { KiralisLogo } from '@/components/brand/kiralis-logo';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { performLogout } from '@/lib/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SupabasePublicEnv } from '@/lib/supabase/env';

export interface OnboardingShellProps {
  userEmail: string | null;
  hasExistingAgency: boolean;
  supabasePublicEnv: SupabasePublicEnv | null;
  children: React.ReactNode;
}

export function OnboardingShell({
  userEmail,
  hasExistingAgency,
  supabasePublicEnv,
  children,
}: OnboardingShellProps) {
  const router = useRouter();
  const { theme, toggleTheme } = useAppPreferences();
  const [signingOut, setSigningOut] = useState(false);

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
      router.replace('/login?message=signed_out');
      router.refresh();
      setSigningOut(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#ECEFF4] text-slate-950 dark:bg-[#070B14] dark:text-slate-100">
      <header className="sticky top-0 z-30 flex h-[58px] shrink-0 items-center justify-between gap-4 border-b border-slate-800 bg-[#0B1220] px-4 text-white sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <KiralisLogo variant="compact" size="md" tone="dark" />
        </div>

        <div className="flex items-center gap-2">
          {hasExistingAgency ? (
            <Link
              href="/"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
            >
              <ArrowLeft
                className="h-3.5 w-3.5 rtl:rotate-180"
                aria-hidden="true"
              />
              <span className="hidden sm:inline">Tableau de bord</span>
            </Link>
          ) : null}

          <button
            type="button"
            onClick={toggleTheme}
            aria-label={
              theme === 'dark'
                ? 'Activer le thème clair'
                : 'Activer le thème sombre'
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {userEmail ? (
            <div className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 md:inline-flex">
              <User
                className="h-3.5 w-3.5 shrink-0 text-blue-400"
                aria-hidden="true"
              />
              <span className="max-w-[180px] truncate font-medium">
                {userEmail}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Se déconnecter"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-200 whitespace-nowrap transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
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

      <main className="mx-auto w-full max-w-[900px] flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6"
        >
          <div className="space-y-2 border-b border-slate-300/80 pb-6 dark:border-slate-800">
            <p className="text-xs font-semibold text-[#1D4ED8] dark:text-blue-400">
              {hasExistingAgency
                ? 'Nouvelle agence KIRALIS'
                : 'Étape unique · Configuration initiale de votre agence'}
            </p>
            <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-3xl dark:text-slate-50 [text-wrap:balance]">
              {hasExistingAgency
                ? 'Ajouter une nouvelle agence'
                : 'Configurez votre agence de location'}
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {hasExistingAgency
                ? 'Créez un nouvel espace agence entièrement isolé. Vous pourrez basculer entre vos agences depuis la barre supérieure.'
                : 'Renseignez les informations de votre agence pour activer votre espace de gestion sécurisé dans KIRALIS.'}
            </p>
          </div>

          {children}
        </motion.div>
      </main>

      <footer className="mt-auto border-t border-slate-300/75 bg-white/60 px-4 py-3.5 text-xs text-slate-500 sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-2">
          <span>KIRALIS · Gestion de location automobile</span>
          <span className="font-mono text-[11px] tabular-nums">
            Tunisie · TND · Africa/Tunis
          </span>
        </div>
      </footer>
    </div>
  );
}
