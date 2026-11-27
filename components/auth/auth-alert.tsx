'use client';

import React from 'react';
import { AlertBanner, type AlertBannerVariant } from '@/components/ui/alert-banner';

export type AuthAlertVariant = AlertBannerVariant;

export interface AuthAlertProps {
  variant: AuthAlertVariant;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthAlert({
  variant,
  title,
  children,
  className,
}: AuthAlertProps) {
  return (
    <AlertBanner
      variant={variant}
      title={title}
      className={className}
      compact
    >
      {children}
    </AlertBanner>
  );
}
