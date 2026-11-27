import React from 'react';
import { cn } from '@/lib/utils';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full';
}

const ROUNDED_CLASSES = {
  sm: 'rounded',
  md: 'rounded-lg',
  lg: 'rounded-xl',
  full: 'rounded-full',
};

export function Skeleton({
  rounded = 'md',
  className,
  ...props
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-slate-200/80 dark:bg-slate-800/80',
        ROUNDED_CLASSES[rounded],
        className
      )}
      {...props}
    />
  );
}

export function SkeletonRowList({ rows = 3 }: { rows?: number }) {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="divide-y divide-slate-200/80 rounded-xl border border-slate-200/90 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-900/60"
    >
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-7 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}
