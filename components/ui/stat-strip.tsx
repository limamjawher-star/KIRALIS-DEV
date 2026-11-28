import React from 'react';
import { cn } from '@/lib/utils';

export interface StatStripItem {
  id: string;
  label: string;
  value: string;
  note: string;
  tone?: 'default' | 'brand' | 'success' | 'warning';
}

export interface StatStripProps {
  items: readonly StatStripItem[];
  className?: string;
}

const VALUE_TONE_CLASSES: Record<
  NonNullable<StatStripItem['tone']>,
  string
> = {
  default: 'text-slate-950 dark:text-white',
  brand: 'text-[#1D4ED8] dark:text-blue-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
};

const TOP_BAR_TONE_CLASSES: Record<
  NonNullable<StatStripItem['tone']>,
  string
> = {
  default: 'bg-slate-300 dark:bg-slate-700',
  brand: 'bg-[#1D4ED8] dark:bg-blue-500',
  success: 'bg-emerald-600 dark:bg-emerald-500',
  warning: 'bg-amber-500 dark:bg-amber-400',
};

export function StatStrip({ items, className }: StatStripProps) {
  const colsClass =
    items.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-2xl border border-slate-300/85 bg-slate-300/80 shadow-[0_1px_3px_rgba(11,18,32,0.05)] dark:border-slate-800 dark:bg-slate-800 dark:shadow-none',
        colsClass,
        className
      )}
    >
      {items.map((item) => {
        const tone = item.tone ?? 'default';
        return (
          <div
            key={item.id}
            className="relative bg-white px-4 py-4 transition-colors hover:bg-slate-50/80 sm:px-5 sm:py-4.5 dark:bg-[#0F172A] dark:hover:bg-slate-900"
          >
            <div
              aria-hidden="true"
              className={cn('mb-3 h-[2px] w-7 rounded-full', TOP_BAR_TONE_CLASSES[tone])}
            />
            <p className="truncate text-xs font-semibold text-slate-600 dark:text-slate-400">
              {item.label}
            </p>
            <p
              className={cn(
                'mt-1.5 font-mono text-2xl font-bold tracking-tight tabular-nums sm:text-[28px] sm:leading-none',
                VALUE_TONE_CLASSES[tone]
              )}
            >
              {item.value}
            </p>
            <p className="mt-2 truncate text-[11px] font-medium text-slate-500 sm:text-xs dark:text-slate-400">
              {item.note}
            </p>
          </div>
        );
      })}
    </div>
  );
}
