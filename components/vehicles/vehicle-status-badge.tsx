import React from 'react';
import { cn } from '@/lib/utils';
import {
  VEHICLE_STATUS_LABELS,
  type VehicleStatus,
} from '@/lib/vehicles/types';

const STATUS_STYLES: Record<VehicleStatus, string> = {
  available:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300',
  rented:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300',
  maintenance:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300',
  retired:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

export interface VehicleStatusBadgeProps {
  status: VehicleStatus;
  className?: string;
}

export function VehicleStatusBadge({
  status,
  className,
}: VehicleStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        STATUS_STYLES[status],
        className
      )}
    >
      {VEHICLE_STATUS_LABELS[status]}
    </span>
  );
}
