'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Check,
  ChevronDown,
  Loader2,
  Plus,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import {
  formatAgencyRoleLabel,
  type AgencySummary,
} from '@/lib/agency/types';
import type { SupportedLocale } from '@/lib/currency';
import { cn } from '@/lib/utils';

const AGENCY_SELECTOR_COPY: Record<
  SupportedLocale,
  {
    triggerAria: string;
    multipleHeader: string;
    singleHeader: string;
    createAgency: string;
    closeLabel: string;
    switchError: string;
    networkError: string;
  }
> = {
  fr: {
    triggerAria: 'Sélectionner l’agence active',
    multipleHeader: 'Vos agences actives',
    singleHeader: 'Agence active',
    createAgency: 'Créer une nouvelle agence',
    closeLabel: 'Fermer le sélecteur d’agence',
    switchError: 'Impossible de changer d’agence pour le moment.',
    networkError: 'Erreur réseau lors du changement d’agence.',
  },
  en: {
    triggerAria: 'Select active agency',
    multipleHeader: 'Your active agencies',
    singleHeader: 'Active agency',
    createAgency: 'Create a new agency',
    closeLabel: 'Close agency switcher',
    switchError: 'Unable to switch agencies right now.',
    networkError: 'Network error while switching agencies.',
  },
  ar: {
    triggerAria: 'اختيار الوكالة النشطة',
    multipleHeader: 'وكالاتك النشطة',
    singleHeader: 'الوكالة النشطة',
    createAgency: 'إنشاء وكالة جديدة',
    closeLabel: 'إغلاق قائمة الوكالات',
    switchError: 'تعذر تبديل الوكالة حالياً.',
    networkError: 'خطأ في الشبكة أثناء تبديل الوكالة.',
  },
};

export interface AgencySelectorProps {
  activeAgency: AgencySummary | null;
  agencies: AgencySummary[];
}

function getAgencyInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'AG').toUpperCase();
}

export function AgencySelector({
  activeAgency,
  agencies,
}: AgencySelectorProps) {
  const router = useRouter();
  const { locale } = useAppPreferences();
  const copy = AGENCY_SELECTOR_COPY[locale];
  const [open, setOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  if (!activeAgency) {
    return null;
  }

  const hasMultiple = agencies.length > 1;

  async function handleSelectAgency(agencyId: string) {
    if (agencyId === activeAgency?.id || switchingId) {
      setOpen(false);
      return;
    }

    setSwitchingId(agencyId);
    setErrorMsg(null);

    try {
      const response = await fetch('/api/agency/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agencyId }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        setErrorMsg(payload?.error ?? copy.switchError);
        setSwitchingId(null);
        return;
      }

      setOpen(false);
      setSwitchingId(null);
      router.refresh();
    } catch {
      setErrorMsg(copy.networkError);
      setSwitchingId(null);
    }
  }

  const agencyListMarkup = (isMobileSheet: boolean) => (
    <>
      {errorMsg ? (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
          {errorMsg}
        </div>
      ) : null}

      <div
        className={cn(
          'space-y-1 overflow-y-auto p-2',
          isMobileSheet ? 'max-h-[55dvh]' : 'max-h-[260px]'
        )}
      >
        {agencies.map((agency) => {
          const isSelected = agency.id === activeAgency.id;
          const isLoading = switchingId === agency.id;
          return (
            <button
              key={agency.id}
              type="button"
              role="menuitemradio"
              aria-checked={isSelected}
              disabled={Boolean(switchingId)}
              onClick={() => handleSelectAgency(agency.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2.5 rounded-xl px-3 text-start transition-colors active:scale-[0.99] cursor-pointer disabled:opacity-60',
                isMobileSheet ? 'min-h-[52px] py-2.5' : 'py-2',
                isSelected
                  ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/70 dark:text-blue-200'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold',
                    isMobileSheet ? 'h-9 w-9' : 'h-7 w-7',
                    isSelected
                      ? 'bg-[#1D4ED8] text-white dark:bg-blue-600'
                      : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {getAgencyInitials(agency.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold sm:text-xs">
                    {agency.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                    {formatAgencyRoleLabel(agency.role, locale)}
                    {agency.city ? ` · ${agency.city}` : ''}
                  </p>
                </div>
              </div>
              {isLoading ? (
                <Loader2
                  className="h-4 w-4 shrink-0 animate-spin text-blue-600"
                  aria-hidden="true"
                />
              ) : isSelected ? (
                <Check
                  className="h-4 w-4 shrink-0 text-[#1D4ED8] dark:text-blue-400"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-200 p-2 dark:border-slate-800">
        <Link
          href="/onboarding"
          onClick={() => setOpen(false)}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40',
            isMobileSheet ? 'h-11' : 'h-9'
          )}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{copy.createAgency}</span>
        </Link>
      </div>
    </>
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setErrorMsg(null);
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={copy.triggerAria}
        className="inline-flex h-10 sm:h-9 max-w-[132px] sm:max-w-[220px] items-center gap-1.5 sm:gap-2 rounded-xl border border-slate-300/80 bg-slate-100/85 px-2.5 text-xs font-semibold text-slate-900 transition-colors hover:border-slate-400/80 hover:bg-slate-200/70 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer"
      >
        <Building2
          className="h-3.5 w-3.5 shrink-0 text-[#1D4ED8] dark:text-blue-400"
          aria-hidden="true"
        />
        <span className="truncate">{activeAgency.name}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform duration-150 dark:text-slate-400',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open ? (
          <>
            {/* Desktop & Tablet anchored popover */}
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              className="absolute end-0 top-[calc(100%+6px)] z-50 hidden w-[292px] overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_16px_36px_-10px_rgba(11,18,32,0.22)] sm:block dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.65)]"
            >
              <div className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  {hasMultiple ? copy.multipleHeader : copy.singleHeader}
                </p>
              </div>
              {agencyListMarkup(false)}
            </motion.div>

            {/* Mobile thumb-friendly bottom sheet (<640px) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 z-50 flex items-end bg-slate-950/55 backdrop-blur-[2px] sm:hidden"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  setOpen(false);
                }
              }}
            >
              <motion.div
                role="dialog"
                aria-modal="true"
                aria-label={hasMultiple ? copy.multipleHeader : copy.singleHeader}
                initial={{ y: 40, opacity: 0.8 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="pb-safe w-full overflow-hidden rounded-t-3xl border-t border-slate-300/80 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="bg-[#0B1220] px-4 pt-2.5 pb-3.5 text-white">
                  <div className="mb-2.5 flex justify-center" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-slate-600" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-sm font-bold tracking-tight text-white">
                      {hasMultiple ? copy.multipleHeader : copy.singleHeader}
                    </p>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      aria-label={copy.closeLabel}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                {agencyListMarkup(true)}
              </motion.div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
