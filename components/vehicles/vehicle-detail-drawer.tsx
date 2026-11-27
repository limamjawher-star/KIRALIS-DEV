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
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { DEFAULT_TIMEZONE } from '@/lib/currency';
import {
  COMPLIANCE_INFORMATIONAL_NOTICE,
  evaluateVehicleCompliance,
  formatComplianceRelativeDays,
  formatIsoDateFr,
} from '@/lib/vehicles/compliance';
import {
  getVehicleCategoryLabel,
  VEHICLE_FUEL_LABELS,
  VEHICLE_TRANSMISSION_LABELS,
  type VehicleRecord,
  type VehicleStatus,
} from '@/lib/vehicles/types';
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

function formatTunisDateTime(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('fr-TN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timeZone || DEFAULT_TIMEZONE,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
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
  const [confirmAction, setConfirmAction] = useState<
    'retire' | 'reactivate' | null
  >(null);
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !mutating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        setActionError(
          payload?.error ??
            'Impossible de mettre à jour le statut du véhicule.'
        );
        setMutating(false);
        return;
      }

      setConfirmAction(null);
      setMutating(false);
      onStatusChanged(payload.vehicle);
    } catch {
      setActionError('Erreur réseau lors de la mise à jour du statut.');
      setMutating(false);
    }
  }

  const isRetired = vehicle.status === 'retired';
  const formattedKm = new Intl.NumberFormat('fr-TN').format(vehicle.odometer_km);
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
        initial={{ opacity: 0, x: 24, y: 12 }}
        animate={{ opacity: 1, x: 0, y: 0 }}
        exit={{ opacity: 0, x: 24, y: 12 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-detail-title"
        className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-200/90 bg-white shadow-2xl md:h-full md:max-h-none md:max-w-xl md:rounded-none md:border-t-0 md:border-s dark:border-slate-800 dark:bg-slate-900"
      >
            {/* Mobile bottom-sheet grabber */}
            <div
              className="flex justify-center pt-2.5 pb-1 md:hidden"
              aria-hidden="true"
            >
              <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" />
            </div>

            {/* Sticky frosted header */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-5 py-4 backdrop-blur-md sm:px-6 dark:border-slate-800/80 dark:bg-slate-900/90">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-slate-200/90 bg-slate-50 px-2 py-0.5 font-mono text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-300">
                    {vehicle.plate_number}
                  </span>
                  <VehicleStatusBadge status={vehicle.status} />
                </div>
                <h2
                  id="vehicle-detail-title"
                  className="font-display text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
                >
                  {vehicle.brand} {vehicle.model}
                  {vehicle.model_year ? (
                    <span className="ms-1.5 font-mono text-sm font-normal text-slate-500 tabular-nums dark:text-slate-400">
                      {vehicle.model_year}
                    </span>
                  ) : null}
                </h2>
              </div>

              <button
                type="button"
                onClick={onClose}
                disabled={mutating}
                aria-label="Fermer la fiche véhicule"
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/30 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
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
                  title={
                    compliance.expiredCount === 1
                      ? '1 échéance administrative dépassée'
                      : `${compliance.expiredCount} échéances administratives dépassées`
                  }
                >
                  Vérifiez les justificatifs correspondants et mettez à jour la
                  date après renouvellement. Le statut opérationnel du véhicule
                  n’est pas modifié automatiquement.
                </AlertBanner>
              ) : compliance.expiringSoonCount > 0 ? (
                <AlertBanner
                  variant="warning"
                  compact
                  title={
                    compliance.expiringSoonCount === 1
                      ? `1 échéance arrive à terme sous ${compliance.warningThresholdDays} jours`
                      : `${compliance.expiringSoonCount} échéances arrivent à terme sous ${compliance.warningThresholdDays} jours`
                  }
                >
                  Pensez à planifier le renouvellement avant la date limite.
                </AlertBanner>
              ) : null}

              {/* Tarification & rental price simulator */}
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
                aria-label="Échéances administratives"
                className="space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Échéances administratives</span>
                  </h3>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                    Seuil : {compliance.warningThresholdDays} j ·{' '}
                    {compliance.timeZone}
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
                          {item.label}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                          {formatIsoDateFr(item.expiresOn)}
                          {item.daysRemaining !== null ? (
                            <>
                              {' '}
                              ·{' '}
                              {formatComplianceRelativeDays(item.daysRemaining)}
                            </>
                          ) : null}
                        </p>
                      </div>
                      <VehicleComplianceBadge status={item.status} />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {COMPLIANCE_INFORMATIONAL_NOTICE}
                </p>
              </section>

              {/* Technical specifications */}
              <section
                aria-label="Caractéristiques du véhicule"
                className="space-y-3 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
              >
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                  <Gauge className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Caractéristiques techniques</span>
                </h3>
                <dl className="divide-y divide-slate-100 rounded-2xl border border-slate-200/90 bg-slate-50/60 px-4 text-sm dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-950/40">
                  <DetailRow
                    label="Catégorie"
                    value={getVehicleCategoryLabel(vehicle.category)}
                  />
                  <DetailRow
                    label="Transmission"
                    value={VEHICLE_TRANSMISSION_LABELS[vehicle.transmission]}
                  />
                  <DetailRow
                    label="Carburant"
                    value={VEHICLE_FUEL_LABELS[vehicle.fuel_type]}
                  />
                  <DetailRow
                    label="Places"
                    value={`${vehicle.seats} places`}
                    mono
                  />
                  <DetailRow
                    label="Kilométrage"
                    value={`${formattedKm} km`}
                    mono
                  />
                  <DetailRow
                    label="Année"
                    value={vehicle.model_year ? String(vehicle.model_year) : '—'}
                    mono
                  />
                  <DetailRow
                    label="Numéro de châssis (VIN)"
                    value={vehicle.vin ?? '—'}
                    mono
                  />
                  <DetailRow
                    label="Devise"
                    value={vehicle.currency_code}
                    mono
                  />
                </dl>
              </section>

              {/* Notes */}
              <section
                aria-label="Notes internes"
                className="space-y-2 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
              >
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Notes internes</span>
                </h3>
                <p className="whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-slate-50/70 px-4 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
                  {vehicle.notes ?? 'Aucune note enregistrée pour ce véhicule.'}
                </p>
              </section>

              {/* Audit timestamps */}
              <section
                aria-label="Historique de fiche"
                className="space-y-2 border-t border-slate-200/80 pt-5 dark:border-slate-800/80"
              >
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Suivi de la fiche</span>
                </h3>
                <dl className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <div className="flex items-center justify-between gap-4">
                    <dt>Créé le</dt>
                    <dd className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatTunisDateTime(vehicle.created_at, agencyTimeZone)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt>Dernière mise à jour</dt>
                    <dd className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                      {formatTunisDateTime(vehicle.updated_at, agencyTimeZone)}
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
                      ? 'Confirmer le retrait de ce véhicule du parc actif ?'
                      : 'Remettre ce véhicule en statut Disponible ?'}
                  </p>
                  <p
                    className={
                      confirmAction === 'retire'
                        ? 'mt-1 text-xs leading-relaxed text-red-800 dark:text-red-200'
                        : 'mt-1 text-xs leading-relaxed text-amber-800 dark:text-amber-200'
                    }
                  >
                    {confirmAction === 'retire'
                      ? 'Le véhicule passera en statut « Retiré » sans suppression définitive afin de préserver l’historique de votre agence.'
                      : 'Le véhicule redeviendra visible dans la flotte active en statut « Disponible ».'}
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
                          <span>Traitement...</span>
                        </>
                      ) : confirmAction === 'retire' ? (
                        <span>Confirmer le retrait</span>
                      ) : (
                        <span>Confirmer la réactivation</span>
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={mutating}
                      onClick={() => setConfirmAction(null)}
                    >
                      Annuler
                    </Button>
                  </div>
                </motion.div>
              ) : null}
            </div>

            {/* Sticky safe-area footer actions */}
            <div className="pb-safe flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 bg-slate-50/90 px-5 py-3.5 backdrop-blur-md sm:px-6 dark:border-slate-800/80 dark:bg-slate-950/75">
              {canManage ? (
                <>
                  <Button
                    variant="secondary"
                    disabled={mutating}
                    onClick={() =>
                      setConfirmAction(isRetired ? 'reactivate' : 'retire')
                    }
                  >
                    {isRetired ? (
                      <>
                        <RotateCcw className="h-4 w-4" aria-hidden="true" />
                        <span>Réactiver</span>
                      </>
                    ) : (
                      <>
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        <span>Retirer du parc</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={mutating}
                    onClick={() => onEdit(vehicle)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span>Modifier</span>
                  </Button>
                </>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Accès en lecture seule (rôle Agent). Seuls les propriétaires
                  et gestionnaires peuvent modifier un véhicule.
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
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd
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
