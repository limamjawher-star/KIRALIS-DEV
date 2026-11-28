import React from 'react';
import { cn } from '@/lib/utils';

export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoVariant = 'full' | 'compact' | 'mark';
export type LogoTone = 'auto' | 'dark' | 'light';

export interface KiralisMarkProps {
  size?: LogoSize;
  tone?: LogoTone;
  className?: string;
}

const MARK_SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-11 w-11',
};

/**
 * KIRALIS precision geometric brand mark.
 * Architectural dark-obsidian chassis with a split kinetic chevron K
 * in crisp white and electric cobalt — engineered for automotive-tech B2B authority.
 */
export function KiralisMark({
  size = 'md',
  tone = 'auto',
  className,
}: KiralisMarkProps) {
  const isDarkSurface = tone === 'dark';

  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('shrink-0', MARK_SIZE_CLASSES[size], className)}
    >
      {/* Precision chassis tile */}
      <rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="9"
        className={
          isDarkSurface
            ? 'fill-[#162238] stroke-[#2A3B5C]'
            : 'fill-[#0B1220] stroke-[#1E293B] dark:fill-[#162238] dark:stroke-[#2A3B5C]'
        }
        strokeWidth="1.25"
      />
      {/* Subtle geometric diagonal highway facet */}
      <path
        d="M25.5 2L38 14.5V9.5C38 5.36 34.64 2 30.5 2H25.5Z"
        fill="#2563EB"
        fillOpacity="0.24"
      />
      {/* Vertical structural chassis stem of K */}
      <path
        d="M10.5 9.5H15.2V30.5H10.5V9.5Z"
        fill="#FFFFFF"
      />
      {/* Upper directional speed-lane blade (electric cobalt) */}
      <path
        d="M17.2 19.6L25.4 9.5H30.8L22.2 20.1L17.2 19.6Z"
        fill="#3B82F6"
      />
      {/* Lower grounded torque leg (crisp white) */}
      <path
        d="M17.2 20.5L22.3 19.9L31.1 30.5H25.2L17.2 20.5Z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

export interface KiralisLogoProps {
  variant?: LogoVariant;
  size?: LogoSize;
  tone?: LogoTone;
  subtitle?: string;
  className?: string;
}

const WORDMARK_SIZE_CLASSES: Record<LogoSize, string> = {
  sm: 'text-[15px]',
  md: 'text-[17px]',
  lg: 'text-[22px]',
};

export function KiralisLogo({
  variant = 'compact',
  size = 'md',
  tone = 'auto',
  subtitle,
  className,
}: KiralisLogoProps) {
  if (variant === 'mark') {
    return <KiralisMark size={size} tone={tone} className={className} />;
  }

  const wordmarkToneClass =
    tone === 'dark'
      ? 'text-white'
      : tone === 'light'
        ? 'text-[#0B1220]'
        : 'text-[#0B1220] dark:text-white';

  const subtitleToneClass =
    tone === 'dark'
      ? 'text-slate-400'
      : tone === 'light'
        ? 'text-slate-500'
        : 'text-slate-500 dark:text-slate-400';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 select-none whitespace-nowrap shrink-0',
        className
      )}
    >
      <KiralisMark size={size} tone={tone} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display font-extrabold tracking-[-0.04em]',
            wordmarkToneClass,
            WORDMARK_SIZE_CLASSES[size]
          )}
        >
          KIRALIS
        </span>
        {variant === 'full' && subtitle ? (
          <span
            className={cn(
              'mt-0.5 text-[11px] font-medium tracking-normal',
              subtitleToneClass
            )}
          >
            {subtitle}
          </span>
        ) : null}
      </span>
    </span>
  );
}
