import React from 'react';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
  id: string;
  label: string;
  required?: boolean;
  helperText?: string;
  errorText?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  id,
  label,
  required = false,
  helperText,
  errorText,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label
        htmlFor={id}
        className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200"
      >
        {label}
        {required ? (
          <span className="ms-1 text-red-600 dark:text-red-400" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {errorText ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium text-red-600 dark:text-red-400"
        >
          {errorText}
        </p>
      ) : helperText ? (
        <p
          id={`${id}-help`}
          className="text-xs leading-relaxed text-slate-500 dark:text-slate-400"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export const INPUT_BASE_CLASSES =
  'h-11 sm:h-10 w-full rounded-xl border bg-white px-3.5 text-sm text-slate-950 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:ring-3 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-400';

export const TEXTAREA_BASE_CLASSES =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-950 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-[border-color,box-shadow,background-color] duration-150 focus:outline-none focus:ring-3 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:shadow-none disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-400';

export function getInputStateClasses(hasError: boolean): string {
  return hasError
    ? 'border-red-500 hover:border-red-600 focus:border-red-600 focus:ring-red-500/15 dark:border-red-500/80 dark:focus:border-red-400 dark:focus:ring-red-400/20'
    : 'border-slate-300 hover:border-slate-400 focus:border-[#1D4ED8] focus:ring-blue-600/15 dark:border-slate-700 dark:hover:border-slate-600 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';
}
