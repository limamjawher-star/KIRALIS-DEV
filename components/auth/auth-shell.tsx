'use client';

import React from 'react';
import Link from 'next/link';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AuthAlert } from './auth-alert';

export interface AuthShellProps {
  title: string;
  subtitle: string;
  supabaseConfigured: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthShell({
  title,
  subtitle,
  supabaseConfigured,
  children,
  footer,
}: AuthShellProps) {
  const { theme, toggleTheme } = useAppPreferences();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      {/* Minimal top header preserving KIRALIS visual grammar */}
      <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur-sm sm:px-6 lg:px-8 dark:border-slate-800 dark:bg-slate-950/95">
        <Link
          href="/login"
          className="flex items-center gap-2.5 rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:focus-visible:ring-blue-400"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-xs font-bold tracking-tight text-white dark:bg-blue-600"
          >
            K
          </span>
          <span className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-slate-50">
            KIRALIS
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline dark:text-slate-500">
            · Gestion de location de véhicules
          </span>
        </Link>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={
            theme === 'dark'
              ? 'Activer le thème clair'
              : 'Activer le thème sombre'
          }
          title={
            theme === 'dark'
              ? 'Activer le thème clair'
              : 'Activer le thème sombre'
          }
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Main centered authentication surface */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px] space-y-5"
        >
          <div className="space-y-1.5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-950 dark:text-slate-50">
              {title}
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>

          <section
            aria-label={title}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:p-7 dark:border-slate-800 dark:bg-slate-900"
          >
            {!supabaseConfigured ? (
              <AuthAlert
                variant="warning"
                title="Configuration Supabase manquante"
                className="mb-5"
              >
                Définissez{' '}
                <code className="font-mono text-[11px]">
                  NEXT_PUBLIC_SUPABASE_URL
                </code>{' '}
                et{' '}
                <code className="font-mono text-[11px]">
                  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
                </code>{' '}
                dans l’environnement d’exécution pour activer l’authentification
                Supabase.
              </AuthAlert>
            ) : null}

            {children}
          </section>

          {footer ? (
            <div className="text-center text-sm text-slate-600 dark:text-slate-400">
              {footer}
            </div>
          ) : null}

          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Authentification sécurisée par Supabase Auth</span>
          </div>
        </motion.div>
      </main>

      <footer className="border-t border-slate-200/80 px-4 py-3.5 text-xs text-slate-500 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:text-slate-400">
        <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2">
          <span>KIRALIS · Plateforme de gestion d’agence de location</span>
          <span className="font-mono text-[11px] tabular-nums">
            Tunisie · TND · Africa/Tunis
          </span>
        </div>
      </footer>
    </div>
  );
}
