'use client';

import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type AlertBannerVariant = 'success' | 'error' | 'warning' | 'info';

export interface AlertBannerProps {
  variant: AlertBannerVariant;
  title?: string;
  children: React.ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const STYLES: Record<
  AlertBannerVariant,
  { container: string; iconWrap: string; icon: string }
> = {
  success: {
    container:
      'border-emerald-200/90 bg-emerald-50/85 text-emerald-950 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-100',
    iconWrap: 'bg-emerald-100/90 dark:bg-emerald-900/50',
    icon: 'text-emerald-700 dark:text-emerald-300',
  },
  error: {
    container:
      'border-red-200/90 bg-red-50/85 text-red-950 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-100',
    iconWrap: 'bg-red-100/90 dark:bg-red-900/50',
    icon: 'text-red-700 dark:text-red-300',
  },
  warning: {
    container:
      'border-amber-200/90 bg-amber-50/85 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100',
    iconWrap: 'bg-amber-100/90 dark:bg-amber-900/50',
    icon: 'text-amber-700 dark:text-amber-300',
  },
  info: {
    container:
      'border-blue-200/90 bg-blue-50/80 text-blue-950 dark:border-blue-900/70 dark:bg-blue-950/40 dark:text-blue-100',
    iconWrap: 'bg-blue-100/90 dark:bg-blue-900/50',
    icon: 'text-blue-700 dark:text-blue-300',
  },
};

function renderVariantIcon(variant: AlertBannerVariant, className: string) {
  switch (variant) {
    case 'success':
      return <CheckCircle2 className={className} aria-hidden="true" />;
    case 'error':
      return <AlertCircle className={className} aria-hidden="true" />;
    case 'warning':
      return <AlertTriangle className={className} aria-hidden="true" />;
    case 'info':
      return <Info className={className} aria-hidden="true" />;
  }
}

export function AlertBanner({
  variant,
  title,
  children,
  onDismiss,
  dismissLabel = 'Fermer',
  action,
  className,
  compact = false,
}: AlertBannerProps) {
  const styles = STYLES[variant];
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';

  return (
    <motion.div
      role={role}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'flex items-start justify-between gap-3 rounded-xl border shadow-[0_1px_2px_rgba(15,23,42,0.03)]',
        compact ? 'px-3.5 py-2.5 text-xs' : 'px-4 py-3 text-sm',
        styles.container,
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className={cn(
            'mt-0.5 flex shrink-0 items-center justify-center rounded-lg',
            compact ? 'h-5 w-5' : 'h-6 w-6',
            styles.iconWrap
          )}
        >
          {renderVariantIcon(
            variant,
            cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', styles.icon)
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          {title ? (
            <p className={cn('font-semibold', compact ? 'text-xs' : 'text-sm')}>
              {title}
            </p>
          ) : null}
          <div className={cn('leading-relaxed opacity-95', compact ? 'text-xs' : 'text-xs sm:text-sm')}>
            {children}
          </div>
        </div>
      </div>

      {(action || onDismiss) ? (
        <div className="flex shrink-0 items-center gap-2">
          {action}
          {onDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={dismissLabel}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg opacity-75 transition-opacity hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:hover:bg-white/10 cursor-pointer"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
