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
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import {
  formatAgencyRoleLabel,
  type AgencySummary,
} from '@/lib/agency/types';
import { cn } from '@/lib/utils';

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
        setErrorMsg(
          payload?.error ?? 'Impossible de changer d’agence pour le moment.'
        );
        setSwitchingId(null);
        return;
      }

      setOpen(false);
      setSwitchingId(null);
      router.refresh();
    } catch {
      setErrorMsg('Erreur réseau lors du changement d’agence.');
      setSwitchingId(null);
    }
  }

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
        aria-label="Sélectionner l’agence active"
        className="inline-flex h-9 max-w-[165px] sm:max-w-[230px] items-center gap-2 rounded-xl border border-slate-300/80 bg-slate-100/85 px-2.5 text-xs font-semibold text-slate-900 transition-colors hover:border-slate-400/80 hover:bg-slate-200/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:border-slate-700/90 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:hover:bg-slate-800 cursor-pointer"
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
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
            className="absolute end-0 top-[calc(100%+6px)] z-50 w-[292px] overflow-hidden rounded-2xl border border-slate-300/90 bg-white shadow-[0_16px_36px_-10px_rgba(11,18,32,0.22)] dark:border-slate-700 dark:bg-slate-900 dark:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.65)]"
          >
            <div className="border-b border-slate-200 bg-slate-50/90 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-950/60">
              <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                {hasMultiple ? 'Vos agences actives' : 'Agence active'}
              </p>
            </div>

            {errorMsg ? (
              <div className="border-b border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {errorMsg}
              </div>
            ) : null}

            <div className="max-h-[260px] space-y-0.5 overflow-y-auto p-1.5">
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
                      'flex w-full items-center justify-between gap-2.5 rounded-xl px-2.5 py-2 text-start transition-colors cursor-pointer disabled:opacity-60',
                      isSelected
                        ? 'bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/70 dark:text-blue-200'
                        : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-display text-[11px] font-bold',
                          isSelected
                            ? 'bg-[#1D4ED8] text-white dark:bg-blue-600'
                            : 'bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                      >
                        {getAgencyInitials(agency.name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
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
                        className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600"
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

            <div className="border-t border-slate-200 p-1.5 dark:border-slate-800">
              <Link
                href="/onboarding"
                onClick={() => setOpen(false)}
                className="flex h-9 w-full items-center gap-2 rounded-xl px-2.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Créer une nouvelle agence</span>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
