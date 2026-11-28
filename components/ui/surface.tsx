import React from 'react';
import { cn } from '@/lib/utils';

export type SurfaceVariant = 'default' | 'subtle' | 'elevated' | 'dark';

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  variant?: SurfaceVariant;
}

const SURFACE_VARIANTS: Record<SurfaceVariant, string> = {
  default:
    'border-slate-300/85 bg-white shadow-[0_1px_3px_rgba(11,18,32,0.05)] dark:border-slate-800 dark:bg-[#0F172A] dark:shadow-none',
  subtle:
    'border-slate-300/75 bg-[#F4F6FA] dark:border-slate-800 dark:bg-[#141E33]/75',
  elevated:
    'border-slate-300/90 bg-white shadow-[0_10px_28px_-10px_rgba(11,18,32,0.14),0_1px_2px_rgba(11,18,32,0.05)] dark:border-slate-700/90 dark:bg-[#0F172A] dark:shadow-[0_10px_28px_-10px_rgba(0,0,0,0.6)]',
  dark:
    'border-slate-800 bg-[#0B1220] text-slate-100 shadow-[0_10px_28px_-12px_rgba(11,18,32,0.45)]',
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
