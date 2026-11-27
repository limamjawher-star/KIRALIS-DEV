'use client';

import React from 'react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';

export interface PageHeaderProps {
  title: string;
  description: string;
  plannedPhase?: string;
  meta?: string;
  action?: React.ReactNode;
}

export function PageHeader({
  title,
  description,
  plannedPhase,
  meta,
  action,
}: PageHeaderProps) {
  const { dict } = useAppPreferences();

  return (
    <header className="flex flex-col gap-4 border-b border-slate-200/90 pb-5 dark:border-slate-800/90 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-500 dark:text-slate-400">
          {meta ? (
            <span>{meta}</span>
          ) : (
            <>
              <span>{dict.common.phase1Label}</span>
              {plannedPhase ? (
                <>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    ·
                  </span>
                  <span>
                    {dict.common.plannedFor} {plannedPhase}
                  </span>
                </>
              ) : null}
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <span>{dict.common.noDatabaseConnected}</span>
            </>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold tracking-[-0.025em] text-slate-950 dark:text-slate-50 sm:text-[28px] sm:leading-tight">
          {title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {description}
        </p>
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {action}
        </div>
      ) : null}
    </header>
  );
}
