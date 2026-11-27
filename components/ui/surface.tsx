import React from 'react';
import { cn } from '@/lib/utils';

export type SurfaceVariant = 'default' | 'subtle' | 'elevated';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  variant?: SurfaceVariant;
}

const SURFACE_VARIANTS: Record<SurfaceVariant, string> = {
  default:
    'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800/90 dark:bg-slate-900 dark:shadow-none',
  subtle:
    'border-slate-200/80 bg-slate-50/75 dark:border-slate-800/80 dark:bg-slate-900/60',
  elevated:
    'border-slate-200/90 bg-white shadow-[0_4px_16px_-4px_rgba(15,23,42,0.08),0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-[0_6px_20px_-6px_rgba(0,0,0,0.45)]',
};

export function Surface({
  padded = false,
  variant = 'default',
  className,
  ...props
}: SurfaceProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-colors',
        SURFACE_VARIANTS[variant],
        padded && 'p-5 sm:p-6',
        className
      )}
      {...props}
    />
  );
}
