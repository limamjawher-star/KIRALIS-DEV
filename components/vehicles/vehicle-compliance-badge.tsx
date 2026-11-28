import React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COMPLIANCE_STATUS_LABELS,
  type ComplianceStatus,
} from '@/lib/vehicles/compliance';

const COMPLIANCE_STYLES: Record<ComplianceStatus, string> = {
  valid:
    'border-emerald-300/90 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  expiring_soon:
    'border-amber-300/90 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  expired:
    'border-red-300/90 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300',
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
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
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
