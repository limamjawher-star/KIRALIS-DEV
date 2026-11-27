import React from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModuleNoticeProps {
  title: string;
  body: string;
  className?: string;
}

export function ModuleNotice({ title, body, className }: ModuleNoticeProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-2xl border border-slate-200/90 bg-white/80 px-4 py-3.5 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800/90 dark:bg-slate-900/70 dark:shadow-none',
        className
      )}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1D4ED8] dark:bg-blue-950/60 dark:text-blue-400">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </p>
      </div>
    </div>
  );
}
