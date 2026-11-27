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
  default: 'text-slate-950 dark:text-slate-50',
  brand: 'text-[#1D4ED8] dark:text-blue-400',
  success: 'text-emerald-700 dark:text-emerald-400',
  warning: 'text-amber-700 dark:text-amber-400',
};

export function StatStrip({ items, className }: StatStripProps) {
  const colsClass =
    items.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={cn(
        'grid gap-px overflow-hidden rounded-2xl border border-slate-200/90 bg-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800/90 dark:bg-slate-800/80 dark:shadow-none',
        colsClass,
        className
      )}
    >
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white px-4 py-3.5 transition-colors hover:bg-slate-50/70 sm:px-5 sm:py-4 dark:bg-slate-900 dark:hover:bg-slate-900/80"
        >
          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
            {item.label}
          </p>
          <p
            className={cn(
              'mt-1.5 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[26px]',
              VALUE_TONE_CLASSES[item.tone ?? 'default']
            )}
          >
            {item.value}
          </p>
          <p className="mt-1 truncate text-[11px] text-slate-500 sm:text-xs dark:text-slate-400">
            {item.note}
          </p>
        </div>
      ))}
    </div>
  );
}
