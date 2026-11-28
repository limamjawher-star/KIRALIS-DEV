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
        'flex items-start gap-3.5 rounded-2xl border border-slate-300/85 bg-[#F4F6FA] px-4 py-3.5 text-sm dark:border-slate-800 dark:bg-[#111A2E]',
        className
      )}
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0B1220] text-blue-400 dark:bg-[#1D4ED8]/20 dark:text-blue-400">
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-semibold text-slate-950 dark:text-white">
          {title}
        </p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </p>
      </div>
    </div>
  );
}
