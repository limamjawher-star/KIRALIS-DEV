import React from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  meta?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  meta,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200/90 bg-slate-50 text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-800/70 dark:text-slate-400">
        {icon}
      </div>
      <h2 className="font-display text-base font-semibold tracking-tight text-slate-950 dark:text-slate-100">
        {title}
      </h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {meta ? (
        <p className="mt-3 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
          {meta}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
