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
    'bg-[#1D4ED8] text-white border border-[#1E40AF] shadow-[0_1px_2px_rgba(11,18,32,0.18),inset_0_1px_0_rgba(255,255,255,0.14)] hover:bg-[#1E40AF] hover:border-[#1E3A8A] active:bg-[#1E3A8A] dark:bg-blue-600 dark:border-blue-500 dark:text-white dark:hover:bg-blue-500',
  secondary:
    'bg-white text-slate-900 border border-slate-300/90 shadow-[0_1px_2px_rgba(11,18,32,0.05)] hover:bg-slate-50 hover:border-slate-400 hover:text-slate-950 active:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-slate-600',
  subtle:
    'bg-slate-200/75 text-slate-900 border border-transparent hover:bg-slate-200 hover:text-slate-950 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-slate-700 border border-transparent hover:bg-slate-200/70 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white',
  danger:
    'bg-red-600 text-white border border-red-700 shadow-[0_1px_2px_rgba(185,28,28,0.22)] hover:bg-red-700 active:bg-red-800 dark:bg-red-600 dark:border-red-500 dark:hover:bg-red-500',
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
        'inline-flex items-center justify-center font-semibold whitespace-nowrap shrink-0 transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-blue-400 dark:focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-200/80 disabled:text-slate-400 disabled:border-slate-300/70 disabled:shadow-none dark:disabled:bg-slate-800/80 dark:disabled:text-slate-500 dark:disabled:border-slate-800 cursor-pointer select-none',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className
      )}
      {...props}
    />
  );
}
