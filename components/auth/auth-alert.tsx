'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type AuthAlertVariant = 'error' | 'success' | 'warning' | 'info';

export interface AuthAlertProps {
  variant: AuthAlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<
  AuthAlertVariant,
  { container: string; icon: string }
> = {
  error: {
    container:
      'border-red-200 bg-red-50/90 text-red-900 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-200',
    icon: 'text-red-600 dark:text-red-400',
  },
  success: {
    container:
      'border-emerald-200 bg-emerald-50/90 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  warning: {
    container:
      'border-amber-200 bg-amber-50/90 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    container:
      'border-blue-200 bg-blue-50/80 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-200',
    icon: 'text-blue-600 dark:text-blue-400',
  },
};

function renderIcon(variant: AuthAlertVariant, className: string) {
  switch (variant) {
    case 'error':
      return <AlertCircle className={className} aria-hidden="true" />;
    case 'success':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'info':
      return <Info className={className} aria-hidden="true" />;
  }
}

export function AuthAlert({
  variant,
  title,
  children,
  className,
}: AuthAlertProps) {
  const styles = VARIANT_STYLES[variant];
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';

  return (
    <div
      role={role}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-relaxed',
        styles.container,
        className
      )}
    >
      {renderIcon(variant, cn('mt-0.5 h-4 w-4 shrink-0', styles.icon))}
      <div className="min-w-0 flex-1 space-y-0.5">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-xs leading-relaxed opacity-95">{children}</div>
      </div>
    </div>
  );
}
