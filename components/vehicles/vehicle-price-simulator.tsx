'use client';

import React, { useMemo, useState } from 'react';
import { Calculator, Info } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { formatTndFromMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  getTodayIsoDateInTimeZone,
  isValidIsoCalendarDate,
} from '@/lib/vehicles/compliance';
import {
  buildLocalizedAppliedRulesExplanation,
  formatIsoDateLocalized,
  formatSignedDeltaTndLocalized,
  getLocalizedLineItemLabel,
  getVehiclesCopy,
} from '@/lib/vehicles/i18n';
import {
  addCalendarDays,
  calculateRentalPricePreview,
  type SeasonalRateRuleInput,
  type VehiclePricingInput,
} from '@/lib/vehicles/pricing';

export interface VehiclePriceSimulatorProps {
  vehicle: VehiclePricingInput;
  seasonalRules: readonly SeasonalRateRuleInput[];
  agencyTimeZone: string;
}

const DURATION_PRESETS = [1, 3, 7, 14, 30] as const;

export function VehiclePriceSimulator({
  vehicle,
  seasonalRules,
  agencyTimeZone,
}: VehiclePriceSimulatorProps) {
  const { locale } = useAppPreferences();
  const copy = getVehiclesCopy(locale);

  const [pickupDate, setPickupDate] = useState<string>(() =>
    getTodayIsoDateInTimeZone(agencyTimeZone)
  );
  const [returnDate, setReturnDate] = useState<string>(() =>
    addCalendarDays(getTodayIsoDateInTimeZone(agencyTimeZone), 3)
  );

  const preview = useMemo(
    () =>
      calculateRentalPricePreview({
        vehicle,
        seasonalRules,
        pickupDate,
        returnDate,
        agencyTimeZone,
      }),
    [vehicle, seasonalRules, pickupDate, returnDate, agencyTimeZone]
  );

  const explanationLines = useMemo(
    () =>
      preview.ok ? buildLocalizedAppliedRulesExplanation(preview, locale) : [],
    [preview, locale]
  );

  function applyDurationPreset(days: number) {
    const baseDate = isValidIsoCalendarDate(pickupDate)
      ? pickupDate
      : getTodayIsoDateInTimeZone(agencyTimeZone);
    setPickupDate(baseDate);
    setReturnDate(addCalendarDays(baseDate, days));
  }

  const activePresetDays = preview.ok ? preview.chargedDays : null;

  return (
    <div className="space-y-3.5 rounded-2xl border border-slate-200/90 bg-[#F4F6FA] p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100/90 text-[#1D4ED8] dark:bg-blue-950/70 dark:text-blue-300"
          >
            <Calculator className="h-3.5 w-3.5" />
          </span>
          <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            {copy.simulator.title}
          </h4>
        </div>
        <span
          dir="ltr"
          className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400"
        >
          {copy.simulator.intervalMeta(agencyTimeZone)}
        </span>
      </div>

      {/* 1-tap quick duration presets for thumb-friendly mobile simulation */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="me-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {copy.simulator.quickDurationLabel}
        </span>
        {DURATION_PRESETS.map((days) => {
          const isSelected = activePresetDays === days;
          return (
            <button
              key={days}
              type="button"
              onClick={() => applyDurationPreset(days)}
              aria-pressed={isSelected}
              className={cn(
                'inline-flex h-8 min-w-10 items-center justify-center rounded-lg border px-2.5 font-mono text-xs font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 cursor-pointer',
                isSelected
                  ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white dark:border-blue-500 dark:bg-blue-600'
                  : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600'
              )}
            >
              {copy.simulator.presetDays(days)}
            </button>
          );
        })}
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="simulator-pickup-date"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            {copy.simulator.pickupDate}
          </label>
          <input
            id="simulator-pickup-date"
            type="date"
            dir="ltr"
            min="1980-01-01"
            max="2100-12-31"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3 font-mono text-xs text-slate-900 tabular-nums transition-colors hover:border-slate-300 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:h-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-400"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="simulator-return-date"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            {copy.simulator.returnDate}
          </label>
          <input
            id="simulator-return-date"
            type="date"
            dir="ltr"
            min="1980-01-01"
            max="2100-12-31"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3 font-mono text-xs text-slate-900 tabular-nums transition-colors hover:border-slate-300 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:h-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-slate-600 dark:focus:border-blue-400"
          />
        </div>
      </div>

      {!preview.ok ? (
        <AlertBanner variant="error" compact>
          {copy.simulator.errors[preview.code] ?? preview.error}
        </AlertBanner>
      ) : (
        <div className="space-y-3">
          {/* Summary metrics row */}
          <div className="grid grid-cols-3 divide-x divide-slate-200/80 overflow-hidden rounded-xl border border-slate-200/90 bg-white rtl:divide-x-reverse dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-900">
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {copy.simulator.chargedDuration}
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-950 tabular-nums dark:text-slate-50">
                {copy.simulator.daysCount(preview.chargedDays)}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {copy.simulator.standardDailyRate}
              </p>
              <p
                dir="ltr"
                className="mt-0.5 font-mono text-sm font-medium text-slate-900 tabular-nums rtl:text-right dark:text-slate-100"
              >
                {formatTndFromMillimes(preview.standardDailyRateMinor, locale)}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {copy.simulator.deltaVsStandard}
              </p>
              <p
                dir="ltr"
                className={cn(
                  'mt-0.5 font-mono text-sm tabular-nums rtl:text-right',
                  preview.differenceVsStandardDailyMinor < 0
                    ? 'font-semibold text-emerald-700 dark:text-emerald-400'
                    : preview.differenceVsStandardDailyMinor > 0
                      ? 'font-semibold text-amber-700 dark:text-amber-400'
                      : 'font-medium text-slate-600 dark:text-slate-400'
                )}
              >
                {formatSignedDeltaTndLocalized(
                  preview.differenceVsStandardDailyMinor,
                  locale
                )}
              </p>
            </div>
          </div>

          {/* Itemized calculation */}
          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/90 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-900">
            {preview.lineItems.map((item, idx) => (
              <div
                key={`${item.kind}-${item.periodStart}-${item.ruleId ?? idx}`}
                className="flex items-start justify-between gap-3 px-3.5 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    <span dir="ltr" className="inline-block font-mono tabular-nums">
                      {item.quantity} ×
                    </span>{' '}
                    {getLocalizedLineItemLabel(item, locale)}
                  </p>
                  <p
                    dir="ltr"
                    className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums rtl:text-right dark:text-slate-400"
                  >
                    {formatIsoDateLocalized(item.periodStart, locale)} →{' '}
                    {formatIsoDateLocalized(item.periodEndInclusive, locale)} ·{' '}
                    {formatTndFromMillimes(item.unitRateMinor, locale)}{' '}
                    {item.kind === 'daily_seasonal' ||
                    item.kind === 'daily_standard'
                      ? copy.simulator.perDayUnit
                      : copy.simulator.perPackageUnit}
                    {item.deltaVsStandardMinor !== 0
                      ? ` (${formatSignedDeltaTndLocalized(item.deltaVsStandardMinor, locale)})`
                      : ''}
                  </p>
                </div>
                <span
                  dir="ltr"
                  className="shrink-0 font-mono text-xs font-semibold text-slate-950 tabular-nums dark:text-slate-100"
                >
                  {formatTndFromMillimes(item.subtotalMinor, locale)}
                </span>
              </div>
            ))}

            {/* Final indicative subtotal */}
            <div className="flex items-center justify-between gap-3 bg-blue-50/70 px-3.5 py-3 dark:bg-blue-950/35">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {copy.simulator.indicativeSubtotal(preview.chargedDays)}
              </span>
              <span
                data-testid="simulator-subtotal"
                dir="ltr"
                className="font-mono text-base font-bold text-[#1D4ED8] tabular-nums dark:text-blue-300"
              >
                {formatTndFromMillimes(preview.subtotalMinor, locale)}
              </span>
            </div>
          </div>

          {/* Applied rules explanation */}
          <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
            {explanationLines.map((line, index) => (
              <p key={index} className="flex items-start gap-1.5">
                <Info
                  className="mt-0.5 h-3 w-3 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Mandatory honest indicative disclaimer */}
      <p className="border-t border-slate-200/80 pt-2.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:text-slate-400">
        {copy.simulator.disclaimer}
      </p>
    </div>
  );
}
