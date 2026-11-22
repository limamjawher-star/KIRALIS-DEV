'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Loader2,
  Pencil,
  RotateCcw,
  X,
} from 'lucide-react';
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

export function VehicleDetailDrawer({
  vehicle,
  agencyTimeZone,
  canManage,
  pricingSchemaReady,
  onPricingSchemaDetected,
  onClose,
  onEdit,
  onStatusChanged,
}: VehicleDetailDrawerProps) {
  const [confirmAction, setConfirmAction] = useState<'retire' | 'reactivate' | null>(
    null
  );
  const [mutating, setMutating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!vehicle) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !mutating) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vehicle, mutating, onClose]);

  if (!vehicle) {
    return null;
  }

  async function handleStatusTransition(nextStatus: VehicleStatus) {
    if (!vehicle || mutating) return;
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
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-[1px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !mutating) {
          onClose();
        }
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="vehicle-detail-title"
        className="flex h-full w-full max-w-xl flex-col border-s border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-medium text-slate-600 dark:text-slate-400">
                {vehicle.plate_number}
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                ·
              </span>
              <VehicleStatusBadge status={vehicle.status} />
            </div>
            <h2
              id="vehicle-detail-title"
              className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
            >
              {vehicle.brand} {vehicle.model}
              {vehicle.model_year ? ` (${vehicle.model_year})` : ''}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={mutating}
            aria-label="Fermer la fiche véhicule"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {actionError ? (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
              />
              <span>{actionError}</span>
            </div>
          ) : null}

          {/* Informational compliance warning banner */}
          {compliance.expiredCount > 0 ? (
            <div
              role="status"
              className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-xs text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
            >
              <p className="font-semibold">
                {compliance.expiredCount === 1
                  ? '1 échéance administrative dépassée'
                  : `${compliance.expiredCount} échéances administratives dépassées`}
              </p>
              <p className="mt-1 leading-relaxed text-red-800 dark:text-red-300">
                Vérifiez les justificatifs correspondants et mettez à jour la
                date après renouvellement. Le statut opérationnel du véhicule
                n’est pas modifié automatiquement.
              </p>
            </div>
          ) : compliance.expiringSoonCount > 0 ? (
            <div
              role="status"
              className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <p className="font-semibold">
                {compliance.expiringSoonCount === 1
                  ? `1 échéance arrive à terme sous ${compliance.warningThresholdDays} jours`
                  : `${compliance.expiringSoonCount} échéances arrivent à terme sous ${compliance.warningThresholdDays} jours`}
              </p>
              <p className="mt-1 leading-relaxed text-amber-800 dark:text-amber-300">
                Pensez à planifier le renouvellement avant la date limite.
              </p>
            </div>
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
          <section aria-label="Échéances administratives" className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Échéances administratives
              </h3>
              <span className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                Seuil : {compliance.warningThresholdDays} j · {compliance.timeZone}
              </span>
            </div>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-950/40">
              {compliance.items.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 px-3.5 py-3"
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
                          · {formatComplianceRelativeDays(item.daysRemaining)}
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
          <section aria-label="Caractéristiques du véhicule" className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Caractéristiques techniques
            </h3>
            <dl className="divide-y divide-slate-100 border-y border-slate-200 text-sm dark:divide-slate-800/80 dark:border-slate-800">
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
          <section aria-label="Notes internes" className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Notes internes
            </h3>
            <p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-3 text-sm leading-relaxed text-slate-700 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-300">
              {vehicle.notes ?? 'Aucune note enregistrée pour ce véhicule.'}
            </p>
          </section>

          {/* Audit timestamps */}
          <section aria-label="Historique de fiche" className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Suivi de la fiche
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
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/70 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
                {confirmAction === 'retire'
                  ? 'Confirmer le retrait de ce véhicule du parc actif ?'
                  : 'Remettre ce véhicule en statut Disponible ?'}
              </p>
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                {confirmAction === 'retire'
                  ? 'Le véhicule passera en statut « Retiré » sans suppression définitive afin de préserver l’historique de votre agence.'
                  : 'Le véhicule redeviendra visible dans la flotte active en statut « Disponible ».'}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
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
            </div>
          ) : null}
        </div>

        {/* Footer actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
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
              Accès en lecture seule (rôle Agent). Seuls les propriétaires et
              gestionnaires peuvent modifier un véhicule.
            </p>
          )}
        </div>
      </aside>
    </div>
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
            ? 'font-mono text-right text-slate-900 tabular-nums dark:text-slate-100'
            : 'text-right font-medium text-slate-900 dark:text-slate-100'
        }
      >
        {value}
      </dd>
    </div>
  );
}
