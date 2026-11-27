'use client';

import React from 'react';
import Link from 'next/link';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { SUPPORTED_LOCALES } from '@/lib/i18n/dictionaries';
import { KiralisLogo } from '@/components/brand/kiralis-logo';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { cn } from '@/lib/utils';
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
  const { theme, toggleTheme, locale, setLocale, dict } = useAppPreferences();

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F7F9] text-slate-950 dark:bg-[#090D16] dark:text-slate-100">
      {/* Minimal top header with KIRALIS brand lockup */}
      <header className="flex h-[56px] sm:h-[60px] shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/92 px-4 backdrop-blur-md sm:px-6 lg:px-8 dark:border-slate-800/90 dark:bg-slate-950/92">
        <Link
          href="/login"
          className="flex items-center gap-3 rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400"
        >
          <KiralisLogo variant="compact" size="md" />
          <span className="hidden text-xs font-medium text-slate-400 sm:inline dark:text-slate-500">
            · Gestion de location de véhicules
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={dict.common.languageSelectorLabel}
            className="inline-flex items-center rounded-xl border border-slate-200/90 bg-slate-100/90 p-0.5 dark:border-slate-800 dark:bg-slate-900"
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
                    'h-7 rounded-lg px-2 text-[11px] font-semibold uppercase transition-colors cursor-pointer',
                    active
                      ? 'bg-white text-slate-950 shadow-xs dark:bg-slate-800 dark:text-slate-50'
                      : 'text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
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
                ? 'Activer le thème clair'
                : 'Activer le thème sombre'
            }
            title={
              theme === 'dark'
                ? 'Activer le thème clair'
                : 'Activer le thème sombre'
            }
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </header>

      {/* Main centered authentication surface */}
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-[440px] space-y-6"
        >
          <div className="space-y-2 text-center">
            <div className="mx-auto mb-3 inline-flex">
              <KiralisLogo variant="mark" size="lg" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[26px] dark:text-slate-50">
              {title}
            </h1>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {subtitle}
            </p>
          </div>

          <section
            aria-label={title}
            className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-[0_8px_28px_-8px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] sm:p-7 dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_10px_30px_-8px_rgba(0,0,0,0.45)]"
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
        <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2">
          <span>KIRALIS · Plateforme de gestion d’agence de location</span>
          <span className="font-mono text-[11px] tabular-nums">
            Tunisie · TND · Africa/Tunis
          </span>
        </div>
      </footer>
    </div>
  );
}
