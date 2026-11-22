'use client';

import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { formatTndFromMillimes, parseTndToMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  createEmptyVehicleFormValues,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_FUEL_LABELS,
  VEHICLE_FUEL_VALUES,
  VEHICLE_STATUS_LABELS,
  VEHICLE_STATUS_VALUES,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_TRANSMISSION_VALUES,
  vehicleRecordToFormValues,
  type VehicleFieldErrors,
  type VehicleFormValues,
  type VehicleFuelType,
  type VehicleRecord,
  type VehicleStatus,
  type VehicleTransmission,
} from '@/lib/vehicles/types';
import { validateVehiclePayload } from '@/lib/vehicles/validation';

export interface VehicleFormModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  vehicle: VehicleRecord | null;
  currencyCode: string;
  onClose: () => void;
  onSaved: (vehicle: VehicleRecord, mode: 'create' | 'edit') => void;
}

export function VehicleFormModal({
  open,
  mode,
  vehicle,
  currencyCode,
  onClose,
  onSaved,
}: VehicleFormModalProps) {
  const [values, setValues] = useState<VehicleFormValues>(() =>
    mode === 'edit' && vehicle
      ? vehicleRecordToFormValues(vehicle)
      : createEmptyVehicleFormValues()
  );
  const [fieldErrors, setFieldErrors] = useState<VehicleFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting) {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, submitting, onClose]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof VehicleFormValues>(
    field: K,
    value: VehicleFormValues[K],
    errorKey?: keyof VehicleFieldErrors
  ) {
    setValues((prev) => ({ ...prev, [field]: value }));
    const errField = errorKey ?? (field as keyof VehicleFieldErrors);
    if (fieldErrors[errField]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[errField];
        return next;
      });
    }
    if (formError) {
      setFormError(null);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const candidatePayload: Record<string, unknown> = {
      plate_number: values.plate_number,
      vin: values.vin,
      brand: values.brand,
      model: values.model,
      model_year: values.model_year,
      category: values.category,
      transmission: values.transmission,
      fuel_type: values.fuel_type,
      seats: values.seats,
      odometer_km: values.odometer_km,
      daily_rate_tnd: values.daily_rate_tnd,
      deposit_tnd: values.deposit_tnd,
      status: values.status,
      notes: values.notes,
    };

    const validation = validateVehiclePayload(candidatePayload);
    if (!validation.valid || !validation.data) {
      setFieldErrors(validation.errors);
      setFormError('Veuillez corriger les champs indiqués ci-dessous.');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);

    try {
      const endpoint =
        mode === 'edit' && vehicle
          ? `/api/vehicles/${vehicle.id}`
          : '/api/vehicles';
      const method = mode === 'edit' ? 'PATCH' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        vehicle?: VehicleRecord;
        error?: string;
        fieldErrors?: VehicleFieldErrors;
      } | null;

      if (!response.ok || !payload?.ok || !payload.vehicle) {
        if (payload?.fieldErrors) {
          setFieldErrors(payload.fieldErrors);
        }
        setFormError(
          payload?.error ??
            'Impossible d’enregistrer le véhicule. Veuillez réessayer.'
        );
        setSubmitting(false);
        return;
      }

      onSaved(payload.vehicle, mode);
    } catch {
      setFormError('Erreur réseau lors de la communication avec le serveur.');
      setSubmitting(false);
    }
  }

  const parsedDailyRate = parseTndToMillimes(values.daily_rate_tnd);
  const parsedDeposit = parseTndToMillimes(values.deposit_tnd || '0');
  const titleId =
    mode === 'edit' ? 'edit-vehicle-modal-title' : 'create-vehicle-modal-title';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
            >
              {mode === 'edit' ? 'Modifier le véhicule' : 'Ajouter un véhicule'}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {mode === 'edit' && vehicle
                ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate_number}`
                : 'Renseignez les informations techniques et tarifaires du véhicule.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer la fenêtre"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100 cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
            {formError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-300"
              >
                <AlertCircle
                  className="mt-0.5 h-4 w-4 shrink-0"
                  aria-hidden="true"
                />
                <span>{formError}</span>
              </div>
            ) : null}

            {/* Section 1: Identification */}
            <fieldset className="space-y-4">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Identification du véhicule
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="vehicle-plate"
                  label="Immatriculation"
                  required
                  helperText="Unique au sein de votre agence (ex. 214 TU 4821)."
                  errorText={fieldErrors.plate_number}
                >
                  <input
                    id="vehicle-plate"
                    type="text"
                    required
                    maxLength={32}
                    value={values.plate_number}
                    onChange={(e) =>
                      updateField('plate_number', e.target.value, 'plate_number')
                    }
                    placeholder="214 TU 4821"
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono uppercase',
                      getInputStateClasses(Boolean(fieldErrors.plate_number))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-status"
                  label="Statut opérationnel"
                  required
                  errorText={fieldErrors.status}
                >
                  <select
                    id="vehicle-status"
                    value={values.status}
                    onChange={(e) =>
                      updateField(
                        'status',
                        e.target.value as VehicleStatus,
                        'status'
                      )
                    }
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.status))
                    )}
                  >
                    {VEHICLE_STATUS_VALUES.map((statusValue) => (
                      <option key={statusValue} value={statusValue}>
                        {VEHICLE_STATUS_LABELS[statusValue]}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id="vehicle-brand"
                  label="Marque"
                  required
                  errorText={fieldErrors.brand}
                >
                  <input
                    id="vehicle-brand"
                    type="text"
                    required
                    maxLength={60}
                    value={values.brand}
                    onChange={(e) => updateField('brand', e.target.value, 'brand')}
                    placeholder="Peugeot, Hyundai, Clio..."
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.brand))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-model"
                  label="Modèle"
                  required
                  errorText={fieldErrors.model}
                >
                  <input
                    id="vehicle-model"
                    type="text"
                    required
                    maxLength={60}
                    value={values.model}
                    onChange={(e) => updateField('model', e.target.value, 'model')}
                    placeholder="208, i20, Duster..."
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.model))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-year"
                  label="Année"
                  helperText="Entre 1980 et 2100 (optionnel)."
                  errorText={fieldErrors.model_year}
                >
                  <input
                    id="vehicle-year"
                    type="number"
                    inputMode="numeric"
                    min={1980}
                    max={2100}
                    value={values.model_year}
                    onChange={(e) =>
                      updateField('model_year', e.target.value, 'model_year')
                    }
                    placeholder="2024"
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.model_year))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-vin"
                  label="Numéro de châssis (VIN)"
                  helperText="Optionnel, 32 caractères maximum."
                  errorText={fieldErrors.vin}
                >
                  <input
                    id="vehicle-vin"
                    type="text"
                    maxLength={32}
                    value={values.vin}
                    onChange={(e) => updateField('vin', e.target.value, 'vin')}
                    placeholder="VF3UBHMZ6JS..."
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono uppercase',
                      getInputStateClasses(Boolean(fieldErrors.vin))
                    )}
                  />
                </FormField>
              </div>
            </fieldset>

            {/* Section 2: Caractéristiques */}
            <fieldset className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Caractéristiques techniques
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  id="vehicle-category"
                  label="Catégorie"
                  required
                  errorText={fieldErrors.category}
                >
                  <select
                    id="vehicle-category"
                    value={values.category}
                    onChange={(e) =>
                      updateField('category', e.target.value, 'category')
                    }
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.category))
                    )}
                  >
                    {VEHICLE_CATEGORY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id="vehicle-transmission"
                  label="Transmission"
                  required
                  errorText={fieldErrors.transmission}
                >
                  <select
                    id="vehicle-transmission"
                    value={values.transmission}
                    onChange={(e) =>
                      updateField(
                        'transmission',
                        e.target.value as VehicleTransmission,
                        'transmission'
                      )
                    }
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.transmission))
                    )}
                  >
                    {VEHICLE_TRANSMISSION_VALUES.map((tr) => (
                      <option key={tr} value={tr}>
                        {VEHICLE_TRANSMISSION_LABELS[tr]}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id="vehicle-fuel"
                  label="Carburant"
                  required
                  errorText={fieldErrors.fuel_type}
                >
                  <select
                    id="vehicle-fuel"
                    value={values.fuel_type}
                    onChange={(e) =>
                      updateField(
                        'fuel_type',
                        e.target.value as VehicleFuelType,
                        'fuel_type'
                      )
                    }
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      getInputStateClasses(Boolean(fieldErrors.fuel_type))
                    )}
                  >
                    {VEHICLE_FUEL_VALUES.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {VEHICLE_FUEL_LABELS[fuel]}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField
                  id="vehicle-seats"
                  label="Nombre de places"
                  required
                  errorText={fieldErrors.seats}
                >
                  <input
                    id="vehicle-seats"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    required
                    value={values.seats}
                    onChange={(e) => updateField('seats', e.target.value, 'seats')}
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.seats))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-odometer"
                  label="Kilométrage (km)"
                  required
                  className="sm:col-span-2"
                  errorText={fieldErrors.odometer_km}
                >
                  <input
                    id="vehicle-odometer"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={5000000}
                    required
                    value={values.odometer_km}
                    onChange={(e) =>
                      updateField('odometer_km', e.target.value, 'odometer_km')
                    }
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.odometer_km))
                    )}
                  />
                </FormField>
              </div>
            </fieldset>

            {/* Section 3: Tarification TND */}
            <fieldset className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
              <legend className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Tarification ({currencyCode}, précision 3 décimales)
              </legend>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  id="vehicle-daily-rate"
                  label={`Tarif journalier (${currencyCode})`}
                  required
                  helperText={
                    parsedDailyRate !== null && parsedDailyRate >= 0
                      ? `Enregistré : ${formatTndFromMillimes(parsedDailyRate, 'fr')}`
                      : 'Ex. 120,000 ou 95.500'
                  }
                  errorText={fieldErrors.daily_rate_minor}
                >
                  <input
                    id="vehicle-daily-rate"
                    type="text"
                    inputMode="decimal"
                    required
                    value={values.daily_rate_tnd}
                    onChange={(e) =>
                      updateField(
                        'daily_rate_tnd',
                        e.target.value,
                        'daily_rate_minor'
                      )
                    }
                    placeholder="110,000"
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.daily_rate_minor))
                    )}
                  />
                </FormField>

                <FormField
                  id="vehicle-deposit"
                  label={`Caution (${currencyCode})`}
                  helperText={
                    parsedDeposit !== null && parsedDeposit >= 0
                      ? `Enregistré : ${formatTndFromMillimes(parsedDeposit, 'fr')}`
                      : 'Ex. 1500,000 (0 par défaut)'
                  }
                  errorText={fieldErrors.deposit_minor}
                >
                  <input
                    id="vehicle-deposit"
                    type="text"
                    inputMode="decimal"
                    value={values.deposit_tnd}
                    onChange={(e) =>
                      updateField(
                        'deposit_tnd',
                        e.target.value,
                        'deposit_minor'
                      )
                    }
                    placeholder="1000,000"
                    disabled={submitting}
                    className={cn(
                      INPUT_BASE_CLASSES,
                      'font-mono tabular-nums',
                      getInputStateClasses(Boolean(fieldErrors.deposit_minor))
                    )}
                  />
                </FormField>
              </div>
            </fieldset>

            {/* Section 4: Notes */}
            <div className="border-t border-slate-200 pt-5 dark:border-slate-800">
              <FormField
                id="vehicle-notes"
                label="Notes internes"
                helperText="Observations d’état, équipements ou consignes d’exploitation (optionnel)."
                errorText={fieldErrors.notes}
              >
                <textarea
                  id="vehicle-notes"
                  rows={3}
                  maxLength={2000}
                  value={values.notes}
                  onChange={(e) => updateField('notes', e.target.value, 'notes')}
                  disabled={submitting}
                  placeholder="Ex. GPS intégré, siège bébé disponible sur demande..."
                  className={cn(
                    'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:outline-none focus:ring-2 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-60',
                    getInputStateClasses(Boolean(fieldErrors.notes))
                  )}
                />
              </FormField>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Enregistrement...</span>
                </>
              ) : mode === 'edit' ? (
                <span>Enregistrer les modifications</span>
              ) : (
                <span>Créer le véhicule</span>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
