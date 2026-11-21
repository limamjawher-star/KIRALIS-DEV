import React from 'react';
import { cn } from '@/lib/utils';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Surface({
  padded = false,
  className,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
        padded && 'p-5 sm:p-6',
        className
      )}
      {...props}
    />
  );
}
