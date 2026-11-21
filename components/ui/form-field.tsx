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
        className="block text-sm font-medium text-slate-800 dark:text-slate-200"
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
          className="text-xs text-slate-500 dark:text-slate-400"
        >
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export const INPUT_BASE_CLASSES =
  'h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 dark:disabled:bg-slate-900 dark:disabled:text-slate-400';

export function getInputStateClasses(hasError: boolean): string {
  return hasError
    ? 'border-red-500 focus:border-red-600 focus:ring-red-500/20 dark:border-red-500 dark:focus:border-red-400'
    : 'border-slate-200 focus:border-blue-600 focus:ring-blue-600/20 dark:border-slate-700 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';
}
