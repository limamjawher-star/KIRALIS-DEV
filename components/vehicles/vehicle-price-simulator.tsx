'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, Calculator, Info } from 'lucide-react';
import { formatTndFromMillimes } from '@/lib/currency';
import {
  formatIsoDateFr,
  getTodayIsoDateInTimeZone,
} from '@/lib/vehicles/compliance';
import {
  addCalendarDays,
  calculateRentalPricePreview,
  PRICING_SIMULATOR_DISCLAIMER,
  type SeasonalRateRuleInput,
  type VehiclePricingInput,
} from '@/lib/vehicles/pricing';

export interface VehiclePriceSimulatorProps {
  vehicle: VehiclePricingInput;
  seasonalRules: readonly SeasonalRateRuleInput[];
  agencyTimeZone: string;
}

function formatSignedDeltaTnd(deltaMinor: number): string {
  if (deltaMinor === 0) return '0,000 TND';
  const sign = deltaMinor > 0 ? '+' : '−';
  return `${sign}${formatTndFromMillimes(Math.abs(deltaMinor), 'fr')}`;
}

export function VehiclePriceSimulator({
  vehicle,
  seasonalRules,
  agencyTimeZone,
}: VehiclePriceSimulatorProps) {
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

  return (
    <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator
            className="h-4 w-4 text-slate-600 dark:text-slate-400"
            aria-hidden="true"
          />
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Simulateur de tarif
          </h4>
        </div>
        <span className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
          Intervalle [départ, retour) · {agencyTimeZone}
        </span>
      </div>

      {/* Date inputs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label
            htmlFor="simulator-pickup-date"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Date de prise en charge
          </label>
          <input
            id="simulator-pickup-date"
            type="date"
            min="1980-01-01"
            max="2100-12-31"
            value={pickupDate}
            onChange={(e) => setPickupDate(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
          />
        </div>

        <div className="space-y-1">
          <label
            htmlFor="simulator-return-date"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Date de restitution (exclue)
          </label>
          <input
            id="simulator-return-date"
            type="date"
            min="1980-01-01"
            max="2100-12-31"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-blue-400"
          />
        </div>
      </div>

      {!preview.ok ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{preview.error}</span>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Summary metrics row */}
          <div className="grid grid-cols-3 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Durée facturée
              </p>
              <p className="mt-0.5 font-mono text-sm font-semibold text-slate-950 tabular-nums dark:text-slate-50">
                {preview.chargedDays}{' '}
                {preview.chargedDays > 1 ? 'jours' : 'jour'}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Tarif jour std.
              </p>
              <p className="mt-0.5 font-mono text-sm font-medium text-slate-900 tabular-nums dark:text-slate-100">
                {formatTndFromMillimes(preview.standardDailyRateMinor, 'fr')}
              </p>
            </div>
            <div className="px-3 py-2.5">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Écart vs std.
              </p>
              <p
                className={
                  preview.differenceVsStandardDailyMinor < 0
                    ? 'mt-0.5 font-mono text-sm font-medium text-emerald-700 tabular-nums dark:text-emerald-400'
                    : preview.differenceVsStandardDailyMinor > 0
                      ? 'mt-0.5 font-mono text-sm font-medium text-amber-700 tabular-nums dark:text-amber-400'
                      : 'mt-0.5 font-mono text-sm font-medium text-slate-600 tabular-nums dark:text-slate-400'
                }
              >
                {formatSignedDeltaTnd(preview.differenceVsStandardDailyMinor)}
              </p>
            </div>
          </div>

          {/* Itemized calculation */}
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-900">
            {preview.lineItems.map((item, idx) => (
              <div
                key={`${item.kind}-${item.periodStart}-${item.ruleId ?? idx}`}
                className="flex items-start justify-between gap-3 px-3 py-2.5 text-xs"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {item.quantity} × {item.label}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    {formatIsoDateFr(item.periodStart)} →{' '}
                    {formatIsoDateFr(item.periodEndInclusive)} ·{' '}
                    {formatTndFromMillimes(item.unitRateMinor, 'fr')}
                    {item.kind === 'daily_seasonal' || item.kind === 'daily_standard'
                      ? ' / j'
                      : ' / forfait'}
                    {item.deltaVsStandardMinor !== 0
                      ? ` (${formatSignedDeltaTnd(item.deltaVsStandardMinor)})`
                      : ''}
                  </p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold text-slate-950 tabular-nums dark:text-slate-100">
                  {formatTndFromMillimes(item.subtotalMinor, 'fr')}
                </span>
              </div>
            ))}

            {/* Final indicative subtotal */}
            <div className="flex items-center justify-between gap-3 bg-slate-50/90 px-3 py-3 dark:bg-slate-950/60">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                Sous-total indicatif ({preview.chargedDays}{' '}
                {preview.chargedDays > 1 ? 'jours' : 'jour'})
              </span>
              <span
                data-testid="simulator-subtotal"
                className="font-mono text-base font-semibold text-slate-950 tabular-nums dark:text-slate-50"
              >
                {preview.totalFormattedTnd}
              </span>
            </div>
          </div>

          {/* Applied rules explanation */}
          <div className="space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-400">
            {preview.appliedRulesExplanation.map((line, index) => (
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

      {/* Mandatory exact disclaimer */}
      <p className="border-t border-slate-200 pt-2.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:text-slate-400">
        {PRICING_SIMULATOR_DISCLAIMER}
      </p>
    </div>
  );
}
