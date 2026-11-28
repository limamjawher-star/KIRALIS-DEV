'use client';

import React, { useEffect, useState } from 'react';
import {
  Archive,
  Clock,
  FileText,
  Gauge,
  Loader2,
  Pencil,
  RotateCcw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { evaluateVehicleCompliance } from '@/lib/vehicles/compliance';
import {
  formatComplianceRelativeDaysLocalized,
  formatDateTimeLocalized,
  formatIsoDateLocalized,
  formatOdometerLocalized,
  getLocalizedVehicleCategoryLabel,
  getVehiclesCopy,
} from '@/lib/vehicles/i18n';
import type { VehicleRecord, VehicleStatus } from '@/lib/vehicles/types';
import { VehicleComplianceBadge } from './vehicle-compliance-badge';
import { VehiclePricingSection } from './vehicle-pricing-section';
import { VehicleStatusBadge } from './vehicle-status-badge';

export interface VehicleDetailDrawerProps {
  vehicle: VehicleRecord | null;
  agencyTimeZone: string;
  canManage: boolean;
  pricingSchemaReady: boolean;
  onPricingSchemaDetected: (ready: boolean) => void;
  onClose: () => void;
  onEdit: (vehicle: VehicleRecord) => void;
  onStatusChanged: (vehicle: VehicleRecord) => void;
}

export function VehicleDetailDrawer(props: VehicleDetailDrawerProps) {
  return (
    <AnimatePresence>
      {props.vehicle ? (
        <VehicleDetailDrawerContent
          key={props.vehicle.id}
          {...props}
          vehicle={props.vehicle}
        />
      ) : null}
    </AnimatePresence>
  );
}

interface VehicleDetailDrawerContentProps
  extends Omit<VehicleDetailDrawerProps, 'vehicle'> {
  vehicle: VehicleRecord;
}

function VehicleDetailDrawerContent({
  vehicle,
  agencyTimeZone,
  canManage,
  pricingSchemaReady,
  onPricingSchemaDetected,
  onClose,
  onEdit,
  onStatusChanged,
}: VehicleDetailDrawerContentProps) {
  const { locale } = useAppPreferences();
  const copy = getVehiclesCopy(locale);

  const [confirmAction, setConfirmAction] = useState<
    'retire' | 'reactivate' | null
  >(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !mutating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mutating, onClose]);

  async function handleStatusTransition(nextStatus: VehicleStatus) {
    if (mutating) return;
    setMutating(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusOnly: true, status: nextStatus }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        vehicle?: VehicleRecord;
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !payload.vehicle) {
        setActionError(payload?.error ?? copy.drawer.statusUpdateError);
        setMutating(false);
        return;
      }

      setConfirmAction(null);
      setMutating(false);
      onStatusChanged(payload.vehicle);
    } catch {
      setActionError(copy.drawer.statusUpdateNetworkError);
      setMutating(false);
    }
  }

  const isRetired = vehicle.status === 'retired';
  const formattedKm = formatOdometerLocalized(vehicle.odometer_km, locale);
  const compliance = evaluateVehicleCompliance(vehicle, {
    timeZone: agencyTimeZone,
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/50 backdrop-blur-[2px] md:items-stretch"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutating) {
          onClose();
        }
      }}
    >
      <motion.aside
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-detail-title"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200/90 bg-white shadow-2xl md:h-full md:max-h-none md:max-w-xl md:rounded-none md:border-t-0 md:border-s dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Mobile bottom-sheet grabber */}
        <div
          className="flex justify-center bg-[#0B1220] pt-2.5 pb-1 md:hidden"
          aria-hidden="true"
        >
          <span className="h-1 w-10 rounded-full bg-slate-600" />
        </div>

        {/* Executive obsidian dossier header */}
        <div className="border-b border-slate-800 bg-[#0B1220] px-5 py-4 text-white sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  dir="ltr"
                  className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-white"
                >
                  {vehicle.plate_number}
                </span>
                <VehicleStatusBadge status={vehicle.status} />
              </div>
              <h2
                id="vehicle-detail-title"
                className="font-display text-lg font-bold tracking-tight text-white"
              >
                {vehicle.brand} {vehicle.model}
                {vehicle.model_year ? (
                  <span
                    dir="ltr"
                    className="ms-1.5 inline-block font-mono text-sm font-normal text-slate-400 tabular-nums"
                  >
                    {vehicle.model_year}
                  </span>
                ) : null}
              </h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={mutating}
              aria-label={copy.drawer.closeAria}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-50 cursor-pointer"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Compact quick-specs summary strip for immediate operational context */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-slate-800/90 pt-2.5 text-xs text-slate-300">
            <span>
              {getLocalizedVehicleCategoryLabel(vehicle.category, locale)}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>{copy.transmissions[vehicle.transmission]}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span>{copy.fuels[vehicle.fuel_type]}</span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="tabular-nums">
              {copy.list.seatsShort(vehicle.seats)}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span dir="ltr" className="font-mono text-slate-200 tabular-nums">
              {formattedKm} km
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          {actionError ? (
            <AlertBanner variant="error" compact>
              {actionError}
            </AlertBanner>
          ) : null}

          {/* Informational compliance warning banner */}
          {compliance.expiredCount > 0 ? (
            <AlertBanner
              variant="error"
              compact
              title={copy.drawer.expiredBannerTitle(compliance.expiredCount)}
            >
              {copy.drawer.expiredBannerDesc}
            </AlertBanner>
          ) : compliance.expiringSoonCount > 0 ? (
            <AlertBanner
              variant="warning"
              compact
              title={copy.drawer.expiringBannerTitle(
                compliance.expiringSoonCount,
                compliance.warningThresholdDays
              )}
            >
              {copy.drawer.expiringBannerDesc}
            </AlertBanner>
          ) : null}

          {/* Pricing & rental price simulator */}
          <VehiclePricingSection
            vehicle={vehicle}
            agencyTimeZone={agencyTimeZone}
            canManage={canManage}
            pricingSchemaReady={pricingSchemaReady}
            onPricingSchemaDetected={onPricingSchemaDetected}
            onEditVehicle={onEdit}
          />

          {/* Compliance & Expiry section */}
          <section
            aria-label={copy.drawer.sectionCompliance}
            className="space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{copy.drawer.sectionCompliance}</span>
              </h3>
              <span
                dir="ltr"
                className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400"
              >
                {copy.compliance.thresholdLabel(compliance.warningThresholdDays)}{' '}
                · {compliance.timeZone}
              </span>
            </div>
            <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-950/40">
              {compliance.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {copy.complianceDocuments[item.key].label}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      <span dir="ltr" className="inline-block font-mono">
                        {formatIsoDateLocalized(item.expiresOn, locale)}
                      </span>
                      {item.daysRemaining !== null ? (
                        <>
                          {' '}
                          ·{' '}
                          {formatComplianceRelativeDaysLocalized(
                            item.daysRemaining,
                            locale
                          )}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <VehicleComplianceBadge status={item.status} />
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              {copy.compliance.informationalNotice}
            </p>
          </section>

          {/* Technical specifications */}
          <section
            aria-label={copy.drawer.sectionSpecs}
            className="space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
          >
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
              <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.drawer.sectionSpecs}</span>
            </h3>
            <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-[#F4F6FA] px-4 text-sm dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-950/40">
              <DetailRow
                label={copy.drawer.specCategory}
                value={getLocalizedVehicleCategoryLabel(
                  vehicle.category,
                  locale
                )}
              />
              <DetailRow
                label={copy.drawer.specTransmission}
                value={copy.transmissions[vehicle.transmission]}
              />
              <DetailRow
                label={copy.drawer.specFuel}
                value={copy.fuels[vehicle.fuel_type]}
              />
              <DetailRow
                label={copy.drawer.specSeats}
                value={copy.list.seatsFull(vehicle.seats)}
                mono
              />
              <DetailRow
                label={copy.drawer.specOdometer}
                value={`${formattedKm} km`}
                mono
                ltr
              />
              <DetailRow
                label={copy.drawer.specYear}
                value={vehicle.model_year ? String(vehicle.model_year) : '—'}
                mono
                ltr
              />
              <DetailRow
                label={copy.drawer.specVin}
                value={vehicle.vin ?? '—'}
                mono
                ltr
              />
              <DetailRow
                label={copy.drawer.specCurrency}
                value={vehicle.currency_code}
                mono
                ltr
              />
            </dl>
          </section>

          {/* Notes */}
          <section
            aria-label={copy.drawer.sectionNotes}
            className="space-y-2 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
          >
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
              <FileText className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.drawer.sectionNotes}</span>
            </h3>
            <p className="whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-[#F4F6FA] px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
              {vehicle.notes ?? copy.drawer.emptyNotes}
            </p>
          </section>

          {/* Audit timestamps */}
          <section
            aria-label={copy.drawer.sectionAudit}
            className="space-y-2 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
          >
            <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600 dark:text-slate-300">
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copy.drawer.sectionAudit}</span>
            </h3>
            <dl className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-between gap-4">
                <dt>{copy.drawer.createdAt}</dt>
                <dd
                  dir="ltr"
                  className="font-mono tabular-nums text-slate-700 dark:text-slate-300"
                >
                  {formatDateTimeLocalized(
                    vehicle.created_at,
                    agencyTimeZone,
                    locale
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt>{copy.drawer.updatedAt}</dt>
                <dd
                  dir="ltr"
                  className="font-mono tabular-nums text-slate-700 dark:text-slate-300"
                >
                  {formatDateTimeLocalized(
                    vehicle.updated_at,
                    agencyTimeZone,
                    locale
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Inline archive / reactivate confirmation */}
          {canManage && confirmAction ? (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.16 }}
              role="alertdialog"
              className={
                confirmAction === 'retire'
                  ? 'rounded-2xl border border-red-200/90 bg-red-50/90 p-4 dark:border-red-900/70 dark:bg-red-950/35'
                  : 'rounded-2xl border border-amber-200/90 bg-amber-50/90 p-4 dark:border-amber-900/70 dark:bg-amber-950/40'
              }
            >
              <p
                className={
                  confirmAction === 'retire'
                    ? 'text-sm font-semibold text-red-950 dark:text-red-100'
                    : 'text-sm font-semibold text-amber-950 dark:text-amber-100'
                }
              >
                {confirmAction === 'retire'
                  ? copy.drawer.retireTitle
                  : copy.drawer.reactivateTitle}
              </p>
              <p
                className={
                  confirmAction === 'retire'
                    ? 'mt-1 text-xs leading-relaxed text-red-800 dark:text-red-200'
                    : 'mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200'
                }
              >
                {confirmAction === 'retire'
                  ? copy.drawer.retireDesc
                  : copy.drawer.reactivateDesc}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant={confirmAction === 'retire' ? 'danger' : 'primary'}
                  disabled={mutating}
                  onClick={() =>
                    handleStatusTransition(
                      confirmAction === 'retire' ? 'retired' : 'available'
                    )
                  }
                >
                  {mutating ? (
                    <>
                      <Loader2
                        className="h-3.5 w-3.5 animate-spin"
                        aria-hidden="true"
                      />
                      <span>{copy.drawer.processing}</span>
                    </>
                  ) : confirmAction === 'retire' ? (
                    <span>{copy.drawer.retireConfirm}</span>
                  ) : (
                    <span>{copy.drawer.reactivateConfirm}</span>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={mutating}
                  onClick={() => setConfirmAction(null)}
                >
                  {copy.drawer.cancel}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Sticky safe-area footer actions */}
        <div className="pb-safe flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#F4F6FA] px-5 py-3.5 sm:px-6 dark:border-slate-800 dark:bg-slate-950/80">
          {canManage ? (
            <>
              <Button
                variant="secondary"
                className="h-11 sm:h-10"
                disabled={mutating}
                onClick={() =>
                  setConfirmAction(isRetired ? 'reactivate' : 'retire')
                }
              >
                {isRetired ? (
                  <>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.drawer.reactivateButton}</span>
                  </>
                ) : (
                  <>
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    <span>{copy.drawer.retireButton}</span>
                  </>
                )}
              </Button>
              <Button
                variant="primary"
                className="h-11 sm:h-10"
                disabled={mutating}
                onClick={() => onEdit(vehicle)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                <span>{copy.list.edit}</span>
              </Button>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {copy.drawer.agentReadOnlyNotice}
            </p>
          )}
        </div>
      </motion.aside>
    </motion.div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  ltr = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
        dir={ltr ? 'ltr' : undefined}
        className={
          mono
            ? 'font-mono text-end text-slate-900 tabular-nums dark:text-slate-100'
            : 'text-end font-medium text-slate-900 dark:text-slate-100'
        }
      >
        {value}
      </dd>
    </div>
  );
}
