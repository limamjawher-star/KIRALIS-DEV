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
        'flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm dark:border-slate-800 dark:bg-slate-900/70',
        className
      )}
    >
      <Info
        className="mt-0.5 h-4 w-4 shrink-0 text-blue-700 dark:text-blue-400"
        aria-hidden="true"
      />
      <div className="min-w-0 space-y-0.5">
        <p className="font-medium text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          {body}
        </p>
      </div>
    </div>
  );
}
