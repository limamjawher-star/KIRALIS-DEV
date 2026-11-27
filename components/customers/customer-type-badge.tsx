import React from 'react';
import { CUSTOMER_TYPE_LABELS, type CustomerType } from '@/lib/customers/types';
import { cn } from '@/lib/utils';

const TYPE_STYLES: Record<CustomerType, string> = {
  individual:
    'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  corporate:
    'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/70 dark:bg-blue-950/50 dark:text-blue-300',
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
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TYPE_STYLES[customerType],
        className
      )}
    >
      {label ?? CUSTOMER_TYPE_LABELS[customerType]}
    </span>
  );
}
