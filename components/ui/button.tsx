import React from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'subtle'
  | 'danger';
export type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1D4ED8] text-white border border-[#1D4ED8] shadow-[0_1px_2px_rgba(29,78,216,0.22)] hover:bg-[#1E40AF] hover:border-[#1E40AF] active:bg-[#1E3A8A] dark:bg-blue-600 dark:border-blue-500/70 dark:text-white dark:hover:bg-blue-500 dark:hover:border-blue-400/70',
  secondary:
    'bg-white text-slate-800 border border-slate-200/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-slate-50 hover:border-slate-300 hover:text-slate-950 active:bg-slate-100/80 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700/90 dark:hover:bg-slate-800/90 dark:hover:border-slate-600',
  subtle:
    'bg-slate-100/90 text-slate-800 border border-transparent hover:bg-slate-200/80 hover:text-slate-950 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white',
  ghost:
    'bg-transparent text-slate-600 border border-transparent hover:bg-slate-100/90 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white',
  danger:
    'bg-red-600 text-white border border-red-600 shadow-[0_1px_2px_rgba(220,38,38,0.2)] hover:bg-red-700 hover:border-red-700 active:bg-red-800 dark:bg-red-600 dark:border-red-500/70 dark:hover:bg-red-500',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs gap-1.5 rounded-lg',
  sm: 'h-9 px-3.5 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap shrink-0 transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 disabled:shadow-none dark:disabled:bg-slate-800/80 dark:disabled:text-slate-500 dark:disabled:border-slate-800 cursor-pointer select-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}
