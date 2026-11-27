import React from 'react';
import { cn } from '@/lib/utils';

export interface KiralisMarkProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const MARK_SIZE_CLASSES: Record<NonNullable<KiralisMarkProps['size']>, string> = {
  xs: 'h-6 w-6',
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-10 w-10',
  xl: 'h-12 w-12',
};

/**
 * Original KIRALIS geometric monogram mark.
 * Combines a precision architectural K pillar with dual forward mobility vectors.
 */
export function KiralisMark({ size = 'md', className }: KiralisMarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn(
        'shrink-0 select-none',
        MARK_SIZE_CLASSES[size],
        className
      )}
    >
      {/* Architectural squircle emblem base */}
      <rect
        x="1"
        y="1"
        width="34"
        height="34"
        rx="9.5"
        className="fill-[#1D4ED8] dark:fill-[#2563EB]"
      />
      {/* Subtle geometric inner top-edge highlight for depth without noisy gradients */}
      <rect
        x="1.5"
        y="1.5"
        width="33"
        height="33"
        rx="9"
        stroke="white"
        strokeOpacity="0.16"
        strokeWidth="1"
      />
      {/* Precision K pillar (left vertical track) */}
      <rect x="9.5" y="8.5" width="4.4" height="19" rx="2.2" fill="white" />
      {/* Upper forward chevron arm (mobility vector) */}
      <path
        d="M16.2 17.6L22.9 9.5C23.45 8.85 24.3 8.5 25.15 8.5H26.4C27.12 8.5 27.52 9.33 27.06 9.88L20.1 18.1L16.2 17.6Z"
        fill="white"
      />
      {/* Lower acceleration wedge with subtle key-notch separation */}
      <path
        d="M16.1 18.2L20.4 17.9L27.15 26.15C27.58 26.68 27.2 27.5 26.5 27.5H24.6C23.82 27.5 23.08 27.14 22.6 26.53L16.1 18.2Z"
        fill="white"
        fillOpacity="0.92"
      />
      {/* Precision route dot accent */}
      <circle cx="15.8" cy="18" r="1.45" className="fill-[#93C5FD]" />
    </svg>
  );
}

export interface KiralisLogoProps {
  variant?: 'full' | 'compact' | 'mark';
  size?: 'sm' | 'md' | 'lg';
  subtitle?: string;
  className?: string;
}

const WORDMARK_SIZE_CLASSES: Record<
  NonNullable<KiralisLogoProps['size']>,
  string
> = {
  sm: 'text-[15px]',
  md: 'text-[17px]',
  lg: 'text-xl',
};

const MARK_BY_LOGO_SIZE: Record<
  NonNullable<KiralisLogoProps['size']>,
  NonNullable<KiralisMarkProps['size']>
> = {
  sm: 'sm',
  md: 'md',
  lg: 'lg',
};

export function KiralisLogo({
  variant = 'full',
  size = 'md',
  subtitle,
  className,
}: KiralisLogoProps) {
  if (variant === 'mark') {
    return <KiralisMark size={MARK_BY_LOGO_SIZE[size]} className={className} />;
  }

  return (
    <span className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      <KiralisMark size={MARK_BY_LOGO_SIZE[size]} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display font-bold tracking-[-0.03em] text-slate-950 whitespace-nowrap dark:text-slate-50',
            WORDMARK_SIZE_CLASSES[size]
          )}
        >
          KIRALIS
        </span>
        {variant === 'full' && subtitle ? (
          <span className="mt-0.5 text-[10px] font-medium tracking-[0.02em] text-slate-500 whitespace-nowrap dark:text-slate-400">
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
