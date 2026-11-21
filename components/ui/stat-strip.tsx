import React from 'react';
import { cn } from '@/lib/utils';

export interface StatStripItem {
  id: string;
  label: string;
  value: string;
  note: string;
}

export interface StatStripProps {
  items: readonly StatStripItem[];
  className?: string;
}

export function StatStrip({ items, className }: StatStripProps) {
  const colsClass =
    items.length === 3
      ? 'grid-cols-1 sm:grid-cols-3'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

  return (
    <div
      className={cn(
        'grid overflow-hidden rounded-xl border border-slate-200 bg-white divide-y divide-slate-200 sm:divide-y-0 sm:divide-x dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800',
        colsClass,
        className
      )}
    >
      {items.map((item) => (
        <div key={item.id} className="px-5 py-4 space-y-1">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {item.label}
          </p>
          <p className="font-mono text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50 tabular-nums">
            {item.value}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {item.note}
          </p>
        </div>
      ))}
    </div>
  );
}
