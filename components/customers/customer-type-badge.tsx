import React from 'react';
import { Building2, User } from 'lucide-react';
import { CUSTOMER_TYPE_LABELS, type CustomerType } from '@/lib/customers/types';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<CustomerType, string> = {
  individual:
    'border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  corporate:
    'border-blue-300/90 bg-blue-50 text-[#1D4ED8] dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-300',
};

export interface CustomerTypeBadgeProps {
  customerType: CustomerType;
  label?: string;
  className?: string;
}

export function CustomerTypeBadge({
  customerType,
  label,
  className,
}: CustomerTypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
        TYPE_STYLES[customerType],
        className
      )}
    >
      {customerType === 'corporate' ? (
        <Building2 className="h-3 w-3 shrink-0" aria-hidden="true" />
      ) : (
        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
      )}
      <span>{label ?? CUSTOMER_TYPE_LABELS[customerType]}</span>
    </span>
  );
}
