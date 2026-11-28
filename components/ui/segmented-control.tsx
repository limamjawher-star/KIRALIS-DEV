'use client';

import React, { useId } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'no-scrollbar inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-300/85 bg-slate-200/75 p-1 dark:border-slate-700/90 dark:bg-slate-950/90',
        className
      )}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative z-10 inline-flex h-8 items-center justify-center rounded-lg px-3 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 dark:focus-visible:ring-blue-400 cursor-pointer select-none',
              isActive
                ? 'text-slate-950 dark:text-white'
                : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
            )}
          >
            {isActive ? (
              <motion.span
                layoutId={`segmented-pill-${layoutId}`}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="absolute inset-0 -z-10 rounded-lg bg-white shadow-[0_1px_2px_rgba(11,18,32,0.12)] ring-1 ring-slate-900/[0.06] dark:bg-slate-800 dark:ring-white/[0.08]"
              />
            ) : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
