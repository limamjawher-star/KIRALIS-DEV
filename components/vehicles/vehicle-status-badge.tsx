import React from 'react';
import { cn } from '@/lib/utils';
import {
  VEHICLE_STATUS_LABELS,
  type VehicleStatus,
} from '@/lib/vehicles/types';

const STATUS_STYLES: Record<VehicleStatus, { badge: string; dot: string }> = {
  available: {
    badge:
      'border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  rented: {
    badge:
      'border-blue-200/90 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  maintenance: {
    badge:
      'border-amber-200/90 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  retired: {
    badge:
      'border-slate-200/90 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
    dot: 'bg-slate-400 dark:bg-slate-500',
  },
};

export interface VehicleStatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function VehicleStatusBadge({
  status,
  className,
}: VehicleStatusBadgeProps) {
  const styles = STATUS_STYLES[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        styles.badge,
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn('h-1.5 w-1.5 shrink-0 rounded-full', styles.dot)}
      />
      <span>{VEHICLE_STATUS_LABELS[status]}</span>
    </span>
  );
}
