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
        className="inline-flex h-10 max-w-[230px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium text-slate-800 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 cursor-pointer"
      >
        <Building2
          className="h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-400"
          aria-hidden="true"
        />
        <span className="truncate">{activeAgency.name}</span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180'
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 top-[calc(100%+6px)] z-50 w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="border-b border-slate-200 px-3.5 py-2.5 dark:border-slate-800">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {hasMultiple ? 'Vos agences actives' : 'Agence active'}
            </p>
          </div>

          {errorMsg ? (
            <div className="border-b border-red-200 bg-red-50 px-3.5 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {errorMsg}
            </div>
          ) : null}

          <div className="max-h-[260px] overflow-y-auto p-1.5 space-y-0.5">
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
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-start transition-colors cursor-pointer disabled:opacity-60',
                    isSelected
                      ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-200'
                      : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">
                      {agency.name}
                    </p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                      {formatAgencyRoleLabel(agency.role, locale)}
                      {agency.city ? ` · ${agency.city}` : ''}
                    </p>
                  </div>
                  {isLoading ? (
                    <Loader2
                      className="h-3.5 w-3.5 shrink-0 animate-spin text-blue-600"
                      aria-hidden="true"
                    />
                  ) : isSelected ? (
                    <Check
                      className="h-3.5 w-3.5 shrink-0 text-blue-700 dark:text-blue-400"
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
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>Créer une nouvelle agence</span>
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
