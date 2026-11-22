'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Car,
  CheckCircle2,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatStrip } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';
import type { AgencyRecord, AgencyRole } from '@/lib/agency/types';
import { formatTndFromMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  canManageVehicles,
  DEFAULT_VEHICLE_FILTERS,
  getVehicleCategoryLabel,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_FUEL_LABELS,
  VEHICLE_FUEL_VALUES,
  VEHICLE_SORT_OPTIONS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_TRANSMISSION_LABELS,
  VEHICLE_TRANSMISSION_VALUES,
  type VehicleFilterState,
  type VehicleFuelType,
  type VehicleRecord,
  type VehicleSortKey,
  type VehicleStatus,
  type VehicleTransmission,
} from '@/lib/vehicles/types';
import {
  computeFleetSummary,
  filterAndSortVehicles,
} from '@/lib/vehicles/validation';
import { VehicleDetailDrawer } from './vehicle-detail-drawer';
import { VehicleFormModal } from './vehicle-form-modal';
import { VehicleStatusBadge } from './vehicle-status-badge';

export interface VehiclesWorkspaceProps {
  agency: AgencyRecord;
  role: AgencyRole;
  initialVehicles: VehicleRecord[];
  initialError: string | null;
}

const ROLE_LABELS: Record<AgencyRole, string> = {
  owner: 'Propriétaire',
  manager: 'Gestionnaire',
  agent: 'Agent (lecture seule)',
};

const STATUS_FILTER_OPTIONS: readonly {
  value: 'all' | VehicleStatus;
  label: string;
}[] = [
  { value: 'all', label: 'Tous' },
  { value: 'available', label: VEHICLE_STATUS_LABELS.available },
  { value: 'rented', label: VEHICLE_STATUS_LABELS.rented },
  { value: 'maintenance', label: VEHICLE_STATUS_LABELS.maintenance },
  { value: 'retired', label: VEHICLE_STATUS_LABELS.retired },
];

export function VehiclesWorkspace({
  agency,
  role,
  initialVehicles,
  initialError,
}: VehiclesWorkspaceProps) {
  const router = useRouter();
  const canManage = canManageVehicles(role);

  const [vehicles, setVehicles] = useState<VehicleRecord[]>(initialVehicles);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [refreshing, setRefreshing] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);

  const [filters, setFilters] = useState<VehicleFilterState>(
    DEFAULT_VEHICLE_FILTERS
  );

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleRecord | null>(
    null
  );
  const [modalState, setModalState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    vehicle: VehicleRecord | null;
  }>({
    open: false,
    mode: 'create',
    vehicle: null,
  });

  const summary = useMemo(() => computeFleetSummary(vehicles), [vehicles]);

  const filteredVehicles = useMemo(
    () => filterAndSortVehicles(vehicles, filters),
    [vehicles, filters]
  );

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.category !== 'all' ||
    filters.transmission !== 'all' ||
    filters.fuelType !== 'all' ||
    filters.sortBy !== 'newest';

  async function refreshVehicles() {
    setRefreshing(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/vehicles', {
        method: 'GET',
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        vehicles?: VehicleRecord[];
        error?: string;
      } | null;

      if (!response.ok || !payload?.ok || !Array.isArray(payload.vehicles)) {
        setLoadError(
          payload?.error ??
            'Impossible d’actualiser la liste des véhicules depuis Supabase.'
        );
        setRefreshing(false);
        return;
      }

      setVehicles(payload.vehicles);
      if (selectedVehicle) {
        const refreshed = payload.vehicles.find(
          (v) => v.id === selectedVehicle.id
        );
        setSelectedVehicle(refreshed ?? null);
      }
      setRefreshing(false);
    } catch {
      setLoadError('Erreur réseau lors du chargement des véhicules.');
      setRefreshing(false);
    }
  }

  function handleVehicleSaved(
    saved: VehicleRecord,
    mode: 'create' | 'edit'
  ) {
    setVehicles((prev) => {
      if (mode === 'create') {
        return [saved, ...prev.filter((v) => v.id !== saved.id)];
      }
      return prev.map((v) => (v.id === saved.id ? saved : v));
    });

    if (selectedVehicle?.id === saved.id) {
      setSelectedVehicle(saved);
    }

    setModalState({ open: false, mode: 'create', vehicle: null });
    setFeedbackBanner(
      mode === 'create'
        ? `Véhicule ${saved.brand} ${saved.model} (${saved.plate_number}) ajouté à la flotte.`
        : `Fiche de ${saved.brand} ${saved.model} (${saved.plate_number}) mise à jour.`
    );
    router.refresh();
  }

  function handleStatusChanged(updated: VehicleRecord) {
    setVehicles((prev) =>
      prev.map((v) => (v.id === updated.id ? updated : v))
    );
    setSelectedVehicle(updated);
    setFeedbackBanner(
      updated.status === 'retired'
        ? `Le véhicule ${updated.plate_number} a été retiré du parc actif.`
        : `Le véhicule ${updated.plate_number} est désormais « ${VEHICLE_STATUS_LABELS[updated.status]} ».`
    );
    router.refresh();
  }

  function openCreateModal() {
    setFeedbackBanner(null);
    setModalState({ open: true, mode: 'create', vehicle: null });
  }

  function openEditModal(vehicle: VehicleRecord) {
    setFeedbackBanner(null);
    setModalState({ open: true, mode: 'edit', vehicle });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Véhicules"
        description="Gérez votre parc automobile, les tarifs journaliers en TND, les cautions et le cycle de vie opérationnel de chaque véhicule."
        meta={`${agency.name} · ${ROLE_LABELS[role]} · ${agency.currency_code}`}
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="secondary"
              onClick={refreshVehicles}
              disabled={refreshing}
              aria-label="Actualiser la flotte"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span>Actualiser</span>
            </Button>
            {canManage ? (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Ajouter un véhicule</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {feedbackBanner ? (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedbackBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackBanner(null)}
            className="text-xs font-medium underline underline-offset-2 hover:opacity-80 cursor-pointer"
          >
            Fermer
          </button>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={refreshVehicles}
            disabled={refreshing}
          >
            Réessayer
          </Button>
        </div>
      ) : null}

      {/* Real fleet KPI summary strip (exact Supabase counts) */}
      <StatStrip
        items={[
          {
            id: 'total',
            label: 'Total flotte',
            value: String(summary.totalCount),
            note:
              summary.retiredCount > 0
                ? `Dont ${summary.retiredCount} retiré(s)`
                : 'Véhicules enregistrés',
          },
          {
            id: 'available',
            label: 'Disponibles',
            value: String(summary.availableCount),
            note: 'Prêts à la location',
          },
          {
            id: 'rented',
            label: 'En location',
            value: String(summary.rentedCount),
            note: 'Actuellement en circulation',
          },
          {
            id: 'maintenance',
            label: 'Maintenance',
            value: String(summary.maintenanceCount),
            note: 'Immobilisés pour entretien',
          },
        ]}
      />

      {/* Inventory table surface */}
      <Surface className="overflow-hidden">
        {/* Toolbar: Search, status segmented control, secondary filters, sort */}
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder="Rechercher par immatriculation, marque, modèle..."
                aria-label="Rechercher dans la flotte"
                className="h-9 w-full rounded-lg border border-slate-200 bg-white ps-9 pe-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              />
            </div>

            <SegmentedControl
              options={STATUS_FILTER_OPTIONS}
              value={filters.status}
              onChange={(nextStatus) =>
                setFilters((prev) => ({ ...prev, status: nextStatus }))
              }
              ariaLabel="Filtrer par statut opérationnel"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Filtrer par catégorie"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Toutes catégories</option>
              {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrer par transmission"
              value={filters.transmission}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  transmission: e.target.value as 'all' | VehicleTransmission,
                }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Toutes transmissions</option>
              {VEHICLE_TRANSMISSION_VALUES.map((tr) => (
                <option key={tr} value={tr}>
                  {VEHICLE_TRANSMISSION_LABELS[tr]}
                </option>
              ))}
            </select>

            <select
              aria-label="Filtrer par carburant"
              value={filters.fuelType}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  fuelType: e.target.value as 'all' | VehicleFuelType,
                }))
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="all">Tous carburants</option>
              {VEHICLE_FUEL_VALUES.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {VEHICLE_FUEL_LABELS[fuel]}
                </option>
              ))}
            </select>

            <div className="ms-auto flex items-center gap-2">
              {hasActiveFilters ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilters(DEFAULT_VEHICLE_FILTERS)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Réinitialiser</span>
                </Button>
              ) : null}

              <select
                aria-label="Trier les véhicules"
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: e.target.value as VehicleSortKey,
                  }))
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                {VEHICLE_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Tri : {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Empty state: zero vehicles in agency */}
        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Car className="h-5 w-5" aria-hidden="true" />}
            title="Aucun véhicule dans votre flotte"
            description={
              canManage
                ? 'Votre agence ne possède encore aucun véhicule enregistré dans Supabase. Ajoutez votre premier véhicule pour démarrer l’inventaire.'
                : 'Votre agence ne possède encore aucun véhicule enregistré. Demandez à un propriétaire ou gestionnaire d’ajouter les véhicules du parc.'
            }
            action={
              canManage ? (
                <Button variant="primary" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Ajouter un premier véhicule</span>
                </Button>
              ) : undefined
            }
          />
        ) : filteredVehicles.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            title="Aucun véhicule ne correspond à vos critères"
            description="Modifiez votre recherche ou réinitialisez les filtres actifs pour afficher l’ensemble du parc."
            action={
              <Button
                variant="secondary"
                onClick={() => setFilters(DEFAULT_VEHICLE_FILTERS)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Réinitialiser les filtres</span>
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop high-density table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <th className="px-4 py-3 text-start">Véhicule</th>
                    <th className="px-4 py-3 text-start">Immatriculation</th>
                    <th className="px-4 py-3 text-start">Spécifications</th>
                    <th className="px-4 py-3 text-end">Kilométrage</th>
                    <th className="px-4 py-3 text-end">Tarif / jour</th>
                    <th className="px-4 py-3 text-start">Statut</th>
                    <th className="px-4 py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredVehicles.map((vehicle) => {
                    const kmFormatted = new Intl.NumberFormat('fr-TN').format(
                      vehicle.odometer_km
                    );
                    return (
                      <tr
                        key={vehicle.id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                      >
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="text-start focus-visible:outline-none focus-visible:underline cursor-pointer"
                          >
                            <p className="font-medium text-slate-950 hover:text-blue-700 dark:text-slate-100 dark:hover:text-blue-400">
                              {vehicle.brand} {vehicle.model}
                              {vehicle.model_year ? (
                                <span className="ms-1.5 font-mono text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400">
                                  {vehicle.model_year}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {getVehicleCategoryLabel(vehicle.category)}
                            </p>
                          </button>
                        </td>

                        <td className="px-4 py-3.5 font-mono text-xs font-medium text-slate-800 dark:text-slate-200">
                          {vehicle.plate_number}
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <span>
                            {VEHICLE_TRANSMISSION_LABELS[vehicle.transmission]}
                          </span>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span>{VEHICLE_FUEL_LABELS[vehicle.fuel_type]}</span>
                          <span aria-hidden="true" className="mx-1.5">
                            ·
                          </span>
                          <span className="tabular-nums">
                            {vehicle.seats} pl.
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-end font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                          {kmFormatted} km
                        </td>

                        <td className="px-4 py-3.5 text-end">
                          <p className="font-mono text-sm font-medium text-slate-950 tabular-nums dark:text-slate-100">
                            {formatTndFromMillimes(vehicle.daily_rate_minor, 'fr')}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            Caution :{' '}
                            {formatTndFromMillimes(vehicle.deposit_minor, 'fr')}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <VehicleStatusBadge status={vehicle.status} />
                        </td>

                        <td className="px-4 py-3.5 text-end">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedVehicle(vehicle)}
                              aria-label={`Voir la fiche de ${vehicle.brand} ${vehicle.model} ${vehicle.plate_number}`}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Détails</span>
                            </Button>
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditModal(vehicle)}
                                aria-label={`Modifier ${vehicle.brand} ${vehicle.model} ${vehicle.plate_number}`}
                              >
                                <Pencil
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>Modifier</span>
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile responsive list */}
            <div className="divide-y divide-slate-200 md:hidden dark:divide-slate-800">
              {filteredVehicles.map((vehicle) => {
                const kmFormatted = new Intl.NumberFormat('fr-TN').format(
                  vehicle.odometer_km
                );
                return (
                  <div key={vehicle.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-950 dark:text-slate-50">
                          {vehicle.brand} {vehicle.model}
                          {vehicle.model_year ? ` (${vehicle.model_year})` : ''}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {vehicle.plate_number} ·{' '}
                          {getVehicleCategoryLabel(vehicle.category)}
                        </p>
                      </div>
                      <VehicleStatusBadge status={vehicle.status} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <span>
                        {VEHICLE_TRANSMISSION_LABELS[vehicle.transmission]} ·{' '}
                        {VEHICLE_FUEL_LABELS[vehicle.fuel_type]} ·{' '}
                        {vehicle.seats} pl. ·{' '}
                        <span className="font-mono tabular-nums">
                          {kmFormatted} km
                        </span>
                      </span>
                      <span className="font-mono text-sm font-semibold text-slate-950 tabular-nums dark:text-slate-100">
                        {formatTndFromMillimes(vehicle.daily_rate_minor, 'fr')}
                        /j
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Détails</span>
                      </Button>
                      {canManage ? (
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1"
                          onClick={() => openEditModal(vehicle)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Modifier</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quiet footer count */}
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
              <span className="tabular-nums">
                {filteredVehicles.length} sur {vehicles.length} véhicule(s)
                affiché(s)
              </span>
              {!canManage ? (
                <span>Mode consultation (Agent)</span>
              ) : null}
            </div>
          </>
        )}
      </Surface>

      <VehicleDetailDrawer
        key={selectedVehicle?.id ?? 'drawer-closed'}
        vehicle={selectedVehicle}
        canManage={canManage}
        onClose={() => setSelectedVehicle(null)}
        onEdit={(v) => openEditModal(v)}
        onStatusChanged={handleStatusChanged}
      />

      {canManage && modalState.open ? (
        <VehicleFormModal
          key={`${modalState.mode}-${modalState.vehicle?.id ?? 'new'}`}
          open={modalState.open}
          mode={modalState.mode}
          vehicle={modalState.vehicle}
          currencyCode={agency.currency_code || 'TND'}
          onClose={() =>
            setModalState({ open: false, mode: 'create', vehicle: null })
          }
          onSaved={handleVehicleSaved}
        />
      ) : null}
    </div>
  );
}
