import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatus,
} from '@/lib/vehicles/compliance';

const COMPLIANCE_STYLES: Record<ComplianceStatus, string> = {
  valid:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-300',
  expiring_soon:
    'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-300',
  expired:
    'border-red-200 bg-red-50 text-red-800 dark:border-red-900/70 dark:bg-red-950/50 dark:text-red-300',
  not_provided:
    'border-transparent bg-transparent px-0 text-slate-500 dark:text-slate-400',
};

export interface VehicleComplianceBadgeProps {
  status: ComplianceStatus;
  labelOverride?: string;
  className?: string;
}

export function VehicleComplianceBadge({
  status,
  labelOverride,
  className,
}: VehicleComplianceBadgeProps) {
  const label = labelOverride ?? COMPLIANCE_STATUS_LABELS[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        COMPLIANCE_STYLES[status],
        className
      )}
    >
      {status === 'expired' ? (
        <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : status === 'expiring_soon' ? (
        <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : status === 'valid' ? (
        <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : null}
      <span>{label}</span>
    </span>
  );
}
