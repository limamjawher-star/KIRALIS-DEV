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
        'flex flex-col items-center justify-center px-6 py-12 text-center sm:py-14',
        className
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300/85 bg-[#F4F6FA] text-slate-700 shadow-[0_1px_2px_rgba(11,18,32,0.05)] dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-200">
        {icon}
      </div>
      <h2 className="font-display text-base font-bold tracking-tight text-slate-950 dark:text-white">
        {title}
      </h2>
      <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600 dark:text-slate-400">
        {description}
      </p>
      {meta ? (
        <p className="mt-3 font-mono text-xs font-medium text-slate-500 tabular-nums dark:text-slate-400">
          {meta}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
