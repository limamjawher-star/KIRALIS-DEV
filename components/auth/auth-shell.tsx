'use client';

import React from 'react';
import Link from 'next/link';
import {
  CarFront,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  WalletCards,
} from 'lucide-react';
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

const PLATFORM_PILLARS = [
  {
    icon: CarFront,
    title: 'Parc automobile & tarification TND',
    detail:
      'Calculs tarifaires précis en millimes, saisons configurables et suivi de conformité des véhicules.',
  },
  {
    icon: Users,
    title: 'Clients & conducteurs autorisés',
    detail:
      'Contrôle des permis, vérification encadrée et traçabilité complète des opérations sensibles.',
  },
  {
    icon: WalletCards,
    title: 'Isolation multi-agences native',
    detail:
      'Chaque agence dispose de son propre espace cloisonné côté base de données via PostgreSQL RLS.',
  },
] as const;

export function AuthShell({
  title,
  subtitle,
  supabaseConfigured,
  children,
  footer,
}: AuthShellProps) {
  const { theme, toggleTheme, locale, setLocale, dict } = useAppPreferences();

  return (
    <div className="grid min-h-screen grid-cols-1 bg-[#ECEFF4] text-slate-950 lg:grid-cols-12 dark:bg-[#070B14] dark:text-slate-100">
      {/* Desktop brand showcase panel (deep obsidian architectural anchor) */}
      <aside className="bg-kiralis-grid relative hidden flex-col justify-between overflow-hidden border-e border-slate-800 bg-[#0B1220] p-10 text-slate-100 lg:col-span-5 lg:flex xl:p-12">
        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <KiralisLogo variant="compact" size="md" tone="dark" />
          </Link>
        </div>

        <div className="relative z-10 my-auto space-y-8 py-10">
          <div className="space-y-3.5">
            <p className="text-xs font-semibold tracking-wide text-blue-400">
              Plateforme de gestion pour agences de location
            </p>
            <h2 className="max-w-md font-display text-3xl font-bold leading-[1.16] tracking-[-0.03em] text-white xl:text-[34px] [text-wrap:balance]">
              Pilotez votre flotte et vos agences avec rigueur.
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-slate-400">
              Conçue pour les agences indépendantes en Tunisie et sur les
              marchés MENA et Europe — rapide, structurée et isolée par agence.
            </p>
          </div>

          <ul className="space-y-4 border-t border-slate-800/90 pt-6">
            {PLATFORM_PILLARS.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex items-start gap-3.5">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700/90 bg-slate-900/90 text-blue-400">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-white">
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-slate-800/90 pt-5 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck
              className="h-3.5 w-3.5 text-blue-400"
              aria-hidden="true"
            />
            <span>Supabase Auth · RLS actif</span>
          </span>
          <span className="font-mono text-[11px] tabular-nums text-slate-500">
            TND · Africa/Tunis
          </span>
        </div>
      </aside>

      {/* Right workspace column: top utility strip + elevated auth card */}
      <div className="flex min-h-screen flex-col lg:col-span-7">
        <header className="flex h-[56px] shrink-0 items-center justify-between border-b border-slate-300/80 bg-white/90 px-4 backdrop-blur-md sm:h-[60px] sm:px-6 lg:border-b-0 lg:bg-transparent lg:px-10 dark:border-slate-800 dark:bg-[#0B1220]/90 lg:dark:bg-transparent">
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 lg:invisible"
          >
            <KiralisLogo variant="compact" size="md" />
          </Link>

          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label={dict.common.languageSelectorLabel}
              className="inline-flex items-center rounded-xl border border-slate-300/85 bg-white p-0.5 shadow-[0_1px_2px_rgba(11,18,32,0.04)] dark:border-slate-700/90 dark:bg-slate-900"
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
                      'h-7 rounded-lg px-2.5 text-[11px] font-semibold uppercase transition-colors cursor-pointer whitespace-nowrap',
                      active
                        ? 'bg-[#0B1220] text-white dark:bg-[#1D4ED8] dark:text-white'
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
                  ? 'Activer le thème clair'
                  : 'Activer le thème sombre'
              }
              title={
                theme === 'dark'
                  ? 'Activer le thème clair'
                  : 'Activer le thème sombre'
              }
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-300/85 bg-white text-slate-700 shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-colors hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white cursor-pointer"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </header>

        <main className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[440px] space-y-6"
          >
            <div className="space-y-2 text-start">
              <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-slate-950 sm:text-[28px] dark:text-slate-50 [text-wrap:balance]">
                {title}
              </h1>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {subtitle}
              </p>
            </div>

            <section
              aria-label={title}
              className="rounded-2xl border border-slate-300/85 bg-white p-6 shadow-[0_12px_32px_-12px_rgba(11,18,32,0.14),0_1px_2px_rgba(11,18,32,0.05)] sm:p-7 dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-[0_14px_36px_-12px_rgba(0,0,0,0.6)]"
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
                  dans l’environnement d’exécution pour activer
                  l’authentification Supabase.
                </AuthAlert>
              ) : null}

              {children}
            </section>

            {footer ? (
              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                {footer}
              </div>
            ) : null}

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 lg:hidden dark:text-slate-400">
              <ShieldCheck
                className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-blue-400"
                aria-hidden="true"
              />
              <span>Authentification sécurisée · Supabase Auth</span>
            </div>
          </motion.div>
        </main>

        <footer className="border-t border-slate-300/70 px-4 py-3.5 text-xs text-slate-500 sm:px-6 lg:border-t-0 lg:px-10 dark:border-slate-800/80 dark:text-slate-400">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>KIRALIS · Gestion de location de véhicules</span>
            <span className="font-mono text-[11px] tabular-nums">
              Tunisie · TND · Africa/Tunis
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
