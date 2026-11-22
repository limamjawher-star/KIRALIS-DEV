'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Loader2,
  Pencil,
  Plus,
  Power,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { formatTndFromMillimes, parseTndToMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { formatIsoDateFr } from '@/lib/vehicles/compliance';
import {
  PRICING_PRECEDENCE_SUMMARY,
  validateSeasonalRatePayload,
  type SeasonalRateFieldErrors,
  type SeasonalRateFormValues,
  type VehicleSeasonalRateRecord,
} from '@/lib/vehicles/pricing';
import {
  formatMinorToEditableTnd,
  type VehicleRecord,
} from '@/lib/vehicles/types';
import { VehiclePriceSimulator } from './vehicle-price-simulator';

export interface VehiclePricingSectionProps {
  vehicle: VehicleRecord;
  agencyTimeZone: string;
  canManage: boolean;
  pricingSchemaReady: boolean;
  onPricingSchemaDetected: (ready: boolean) => void;
  onEditVehicle: (vehicle: VehicleRecord) => void;
}

function createEmptySeasonalForm(
  vehicle: VehicleRecord
): SeasonalRateFormValues {
  return {
    label: '',
    start_date: '',
    end_date: '',
    daily_rate_tnd: formatMinorToEditableTnd(vehicle.daily_rate_minor),
    is_active: true,
  };
}

function seasonalRecordToForm(
  rate: VehicleSeasonalRateRecord
): SeasonalRateFormValues {
  return {
    label: rate.label ?? '',
    start_date: rate.start_date,
    end_date: rate.end_date,
    daily_rate_tnd: formatMinorToEditableTnd(rate.daily_rate_minor),
    is_active: rate.is_active,
  };
}

function sortSeasonalRates(
  rates: readonly VehicleSeasonalRateRecord[]
): VehicleSeasonalRateRecord[] {
  return rates.slice().sort((a, b) => {
    if (a.is_active !== b.is_active) {
      return a.is_active ? -1 : 1;
    }
    return a.start_date.localeCompare(b.start_date);
  });
}

export function VehiclePricingSection({
  vehicle,
  agencyTimeZone,
  canManage,
  pricingSchemaReady,
  onPricingSchemaDetected,
  onEditVehicle,
}: VehiclePricingSectionProps) {
  const [rates, setRates] = useState<VehicleSeasonalRateRecord[]>([]);
  const [loadingRates, setLoadingRates] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [localSchemaReady, setLocalSchemaReady] =
    useState<boolean>(pricingSchemaReady);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRate, setEditingRate] =
    useState<VehicleSeasonalRateRecord | null>(null);
  const [formValues, setFormValues] = useState<SeasonalRateFormValues>(() =>
    createEmptySeasonalForm(vehicle)
  );
  const [fieldErrors, setFieldErrors] = useState<SeasonalRateFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const schemaReady = pricingSchemaReady && localSchemaReady;

  useEffect(() => {
    let cancelled = false;

    async function fetchRates() {
      try {
        const response = await fetch(
          `/api/vehicles/${vehicle.id}/seasonal-rates`,
          { method: 'GET', cache: 'no-store' }
        );
        const payload = (await response.json().catch(() => null)) as {
          ok?: boolean;
          rates?: VehicleSeasonalRateRecord[];
          pricingSchemaReady?: boolean;
          error?: string;
        } | null;

        if (cancelled) return;

        if (!response.ok || !payload?.ok) {
          setLoadError(
            payload?.error ??
              'Impossible de charger les tarifs saisonniers du véhicule.'
          );
          setLoadingRates(false);
          return;
        }

        if (typeof payload.pricingSchemaReady === 'boolean') {
          setLocalSchemaReady(payload.pricingSchemaReady);
          onPricingSchemaDetected(payload.pricingSchemaReady);
        }

        setRates(sortSeasonalRates(payload.rates ?? []));
        setLoadingRates(false);
      } catch {
        if (cancelled) return;
        setLoadError('Erreur réseau lors du chargement des tarifs saisonniers.');
        setLoadingRates(false);
      }
    }

    void fetchRates();
    return () => {
      cancelled = true;
    };
  }, [vehicle.id, onPricingSchemaDetected]);

  function openCreateForm() {
    setEditingRate(null);
    setFormValues(createEmptySeasonalForm(vehicle));
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
    setFormOpen(true);
  }

  function openEditForm(rate: VehicleSeasonalRateRecord) {
    setEditingRate(rate);
    setFormValues(seasonalRecordToForm(rate));
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingRate(null);
    setFieldErrors({});
    setFormError(null);
  }

  function updateFormField<K extends keyof SeasonalRateFormValues>(
    field: K,
    value: SeasonalRateFormValues[K],
    errorKey?: keyof SeasonalRateFieldErrors
  ) {
    setFormValues((prev) => ({ ...prev, [field]: value }));
    const errKey = errorKey ?? (field as keyof SeasonalRateFieldErrors);
    if (fieldErrors[errKey]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errKey];
        return next;
      });
    }
    if (formError) setFormError(null);
  }

  async function handleSaveRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !schemaReady) return;

    const validation = validateSeasonalRatePayload({
      label: formValues.label,
      start_date: formValues.start_date,
      end_date: formValues.end_date,
      daily_rate_tnd: formValues.daily_rate_tnd,
      is_active: formValues.is_active,
    });

    if (!validation.valid || !validation.data) {
      setFieldErrors(validation.errors);
      setFormError('Veuillez corriger les champs signalés ci-dessous.');
      return;
    }

    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    setFeedback(null);

    try {
      const endpoint = editingRate
        ? `/api/vehicles/${vehicle.id}/seasonal-rates/${editingRate.id}`
        : `/api/vehicles/${vehicle.id}/seasonal-rates`;
      const method = editingRate ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        rate?: VehicleSeasonalRateRecord;
        error?: string;
        fieldErrors?: SeasonalRateFieldErrors;
        missingPricingSchema?: boolean;
      } | null;

      if (payload?.missingPricingSchema) {
        setLocalSchemaReady(false);
        onPricingSchemaDetected(false);
      }

      if (!response.ok || !payload?.ok || !payload.rate) {
        if (payload?.fieldErrors) {
          setFieldErrors(payload.fieldErrors);
        }
        setFormError(
          payload?.error ?? 'Impossible d’enregistrer ce tarif saisonnier.'
        );
        setSaving(false);
        return;
      }

      const savedRate = payload.rate;
      setRates((prev) =>
        sortSeasonalRates(
          editingRate
            ? prev.map((r) => (r.id === savedRate.id ? savedRate : r))
            : [...prev, savedRate]
        )
      );
      setFeedback(
        editingRate
          ? 'Tarif saisonnier mis à jour.'
          : 'Nouveau tarif saisonnier enregistré.'
      );
      setSaving(false);
      closeForm();
    } catch {
      setFormError('Erreur réseau lors de la sauvegarde du tarif saisonnier.');
      setSaving(false);
    }
  }

  async function handleToggleActive(rate: VehicleSeasonalRateRecord) {
    if (togglingId || !schemaReady) return;
    setTogglingId(rate.id);
    setFormError(null);
    setFeedback(null);

    try {
      const response = await fetch(
        `/api/vehicles/${vehicle.id}/seasonal-rates/${rate.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toggleActiveOnly: true,
            is_active: !rate.is_active,
          }),
        }
      );

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        rate?: VehicleSeasonalRateRecord;
        error?: string;
        missingPricingSchema?: boolean;
      } | null;

      if (payload?.missingPricingSchema) {
        setLocalSchemaReady(false);
        onPricingSchemaDetected(false);
      }

      if (!response.ok || !payload?.ok || !payload.rate) {
        setLoadError(
          payload?.error ??
            'Impossible de modifier l’état de ce tarif saisonnier.'
        );
        setTogglingId(null);
        return;
      }

      const updatedRate = payload.rate;
      setRates((prev) =>
        sortSeasonalRates(
          prev.map((r) => (r.id === updatedRate.id ? updatedRate : r))
        )
      );
      setFeedback(
        updatedRate.is_active
          ? 'Tarif saisonnier réactivé.'
          : 'Tarif saisonnier désactivé.'
      );
      setTogglingId(null);
    } catch {
      setLoadError('Erreur réseau lors de la mise à jour du tarif saisonnier.');
      setTogglingId(null);
    }
  }

  const parsedSeasonalPreview = parseTndToMillimes(formValues.daily_rate_tnd);
  const currencyCode = vehicle.currency_code || 'TND';

  return (
    <section aria-label="Tarification" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          Tarification
        </h3>
        {canManage ? (
          <button
            type="button"
            onClick={() => onEditVehicle(vehicle)}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-none focus-visible:underline dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
          >
            <Pencil className="h-3 w-3" aria-hidden="true" />
            <span>Modifier les tarifs</span>
          </button>
        ) : null}
      </div>

      {/* Standard pricing summary grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-950/50">
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tarif journalier
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-slate-950 tabular-nums dark:text-slate-50">
            {formatTndFromMillimes(vehicle.daily_rate_minor, 'fr')}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Caution
          </p>
          <p className="mt-1 font-mono text-base font-semibold text-slate-950 tabular-nums dark:text-slate-50">
            {formatTndFromMillimes(vehicle.deposit_minor, 'fr')}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Forfait 7 jours
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {vehicle.weekly_rate_minor !== null
              ? formatTndFromMillimes(vehicle.weekly_rate_minor, 'fr')
              : 'Non défini'}
          </p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Forfait 30 jours
          </p>
          <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-slate-100">
            {vehicle.monthly_rate_minor !== null
              ? formatTndFromMillimes(vehicle.monthly_rate_minor, 'fr')
              : 'Non défini'}
          </p>
        </div>
      </div>

      {/* Pending migration 0005 honest notice */}
      {!schemaReady ? (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            aria-hidden="true"
          />
          <p className="leading-relaxed">
            <span className="font-semibold">
              Tarification avancée désactivée :
            </span>{' '}
            installez la migration{' '}
            <span className="font-mono">
              202611210005_vehicle_advanced_pricing.sql
            </span>{' '}
            dans Supabase pour enregistrer des forfaits 7/30 jours et des tarifs
            saisonniers. Le tarif journalier existant reste pleinement actif.
          </p>
        </div>
      ) : null}

      {/* Seasonal pricing rules block */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <CalendarRange
              className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Tarifs saisonniers
            </h4>
          </div>
          {canManage ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!schemaReady || formOpen}
              onClick={openCreateForm}
              title={
                !schemaReady
                  ? 'Installez la migration 0005 dans Supabase pour activer cette action.'
                  : undefined
              }
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ajouter une période</span>
            </Button>
          ) : null}
        </div>

        {feedback ? (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {feedback}
            </span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="font-medium underline underline-offset-2 cursor-pointer"
            >
              Fermer
            </button>
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
        ) : null}

        {/* Inline create / edit seasonal rule form (Owner / Manager only) */}
        {canManage && formOpen && schemaReady ? (
          <form
            onSubmit={handleSaveRule}
            noValidate
            className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-950/60"
          >
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {editingRate
                ? 'Modifier le tarif saisonnier'
                : 'Nouveau tarif saisonnier'}
            </p>

            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
                <span>{formError}</span>
              </div>
            ) : null}

            <FormField
              id="seasonal-label"
              label="Libellé (optionnel)"
              errorText={fieldErrors.label}
            >
              <input
                id="seasonal-label"
                type="text"
                maxLength={80}
                value={formValues.label}
                onChange={(e) =>
                  updateFormField('label', e.target.value, 'label')
                }
                placeholder="Ex. Haute saison été, Vacances scolaires..."
                disabled={saving}
                className={cn(
                  INPUT_BASE_CLASSES,
                  getInputStateClasses(Boolean(fieldErrors.label))
                )}
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                id="seasonal-start-date"
                label="Date de début (incluse)"
                required
                errorText={fieldErrors.start_date}
              >
                <input
                  id="seasonal-start-date"
                  type="date"
                  required
                  min="1980-01-01"
                  max="2100-12-31"
                  value={formValues.start_date}
                  onChange={(e) =>
                    updateFormField('start_date', e.target.value, 'start_date')
                  }
                  disabled={saving}
                  className={cn(
                    INPUT_BASE_CLASSES,
                    'font-mono tabular-nums',
                    getInputStateClasses(Boolean(fieldErrors.start_date))
                  )}
                />
              </FormField>

              <FormField
                id="seasonal-end-date"
                label="Date de fin (incluse)"
                required
                errorText={fieldErrors.end_date}
              >
                <input
                  id="seasonal-end-date"
                  type="date"
                  required
                  min="1980-01-01"
                  max="2100-12-31"
                  value={formValues.end_date}
                  onChange={(e) =>
                    updateFormField('end_date', e.target.value, 'end_date')
                  }
                  disabled={saving}
                  className={cn(
                    INPUT_BASE_CLASSES,
                    'font-mono tabular-nums',
                    getInputStateClasses(Boolean(fieldErrors.end_date))
                  )}
                />
              </FormField>
            </div>

            <FormField
              id="seasonal-daily-rate"
              label={`Tarif journalier saisonnier (${currencyCode})`}
              required
              helperText={
                parsedSeasonalPreview !== null && parsedSeasonalPreview >= 0
                  ? `Enregistré : ${formatTndFromMillimes(parsedSeasonalPreview, 'fr')} / jour`
                  : 'Ex. 165,000 (précision 3 décimales)'
              }
              errorText={fieldErrors.daily_rate_minor}
            >
              <input
                id="seasonal-daily-rate"
                type="text"
                inputMode="decimal"
                required
                value={formValues.daily_rate_tnd}
                onChange={(e) =>
                  updateFormField(
                    'daily_rate_tnd',
                    e.target.value,
                    'daily_rate_minor'
                  )
                }
                placeholder="165,000"
                disabled={saving}
                className={cn(
                  INPUT_BASE_CLASSES,
                  'font-mono tabular-nums',
                  getInputStateClasses(Boolean(fieldErrors.daily_rate_minor))
                )}
              />
            </FormField>

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={saving}
                onClick={closeForm}
              >
                Annuler
              </Button>
              <Button type="submit" size="sm" variant="primary" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    <span>Enregistrement...</span>
                  </>
                ) : editingRate ? (
                  <span>Mettre à jour</span>
                ) : (
                  <span>Enregistrer la règle</span>
                )}
              </Button>
            </div>
          </form>
        ) : null}

        {/* List of seasonal pricing rules */}
        {loadingRates ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3.5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            <span>Chargement des tarifs saisonniers...</span>
          </div>
        ) : rates.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
            Aucun tarif saisonnier configuré pour ce véhicule.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white dark:divide-slate-800/80 dark:border-slate-800 dark:bg-slate-950/40">
            {rates.map((rate) => {
              const delta = rate.daily_rate_minor - vehicle.daily_rate_minor;
              const isBusy = togglingId === rate.id;

              return (
                <div
                  key={rate.id}
                  className={cn(
                    'flex flex-wrap items-center justify-between gap-2 px-3.5 py-3',
                    !rate.is_active && 'opacity-65'
                  )}
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                      <span>{rate.label || 'Période saisonnière'}</span>
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                        ·
                      </span>
                      <span
                        className={
                          rate.is_active
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }
                      >
                        {rate.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                      {formatIsoDateFr(rate.start_date)} →{' '}
                      {formatIsoDateFr(rate.end_date)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-end">
                      <p className="font-mono text-xs font-semibold text-slate-950 tabular-nums dark:text-slate-100">
                        {formatTndFromMillimes(rate.daily_rate_minor, 'fr')} / j
                      </p>
                      {delta !== 0 ? (
                        <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          {delta > 0 ? '+' : '−'}
                          {formatTndFromMillimes(Math.abs(delta), 'fr')} vs std.
                        </p>
                      ) : null}
                    </div>

                    {canManage && schemaReady ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(rate)}
                          disabled={isBusy}
                          aria-label={`Modifier le tarif saisonnier ${rate.label || rate.start_date}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(rate)}
                          disabled={isBusy}
                          aria-label={
                            rate.is_active
                              ? `Désactiver le tarif saisonnier ${rate.label || rate.start_date}`
                              : `Réactiver le tarif saisonnier ${rate.label || rate.start_date}`
                          }
                          title={rate.is_active ? 'Désactiver' : 'Réactiver'}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer"
                        >
                          {isBusy ? (
                            <Loader2
                              className="h-3.5 w-3.5 animate-spin"
                              aria-hidden="true"
                            />
                          ) : (
                            <Power className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
          {PRICING_PRECEDENCE_SUMMARY}
        </p>
      </div>

      {/* Rental price simulator */}
      <VehiclePriceSimulator
        vehicle={vehicle}
        seasonalRules={rates}
        agencyTimeZone={agencyTimeZone}
      />
    </section>
  );
}
