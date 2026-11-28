import React from 'react';
import { Archive, Car, CheckCircle2, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  VEHICLE_STATUS_LABELS,
  type VehicleStatus,
} from '@/lib/vehicles/types';

const STATUS_STYLES: Record<VehicleStatus, string> = {
  available:
    'border-emerald-300/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  rented:
    'border-blue-300/90 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300',
  maintenance:
    'border-amber-300/90 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  retired:
    'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

function StatusIcon({ status }: { status: VehicleStatus }) {
  switch (status) {
    case 'available':
      return <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'rented':
      return <Car className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'maintenance':
      return <Wrench className="h-3 w-3 shrink-0" aria-hidden="true" />;
    case 'retired':
    default:
      return <Archive className="h-3 w-3 shrink-0" aria-hidden="true" />;
  }
}

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
        'inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
        STATUS_STYLES[status],
        className
      )}
    >
      <StatusIcon status={status} />
      <span>{VEHICLE_STATUS_LABELS[status]}</span>
    </span>
  );
}
