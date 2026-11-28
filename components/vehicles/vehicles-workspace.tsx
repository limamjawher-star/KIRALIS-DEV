'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Car,
  Clock,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
} from 'lucide-react';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { StatStrip } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';
import type { AgencyRecord, AgencyRole } from '@/lib/agency/types';
import { DEFAULT_TIMEZONE, formatTndFromMillimes } from '@/lib/currency';
import { cn } from '@/lib/utils';
import {
  COMPLIANCE_INFORMATIONAL_NOTICE,
  computeFleetComplianceSummary,
  DEFAULT_COMPLIANCE_WARNING_DAYS,
  evaluateVehicleCompliance,
  formatComplianceRelativeDays,
} from '@/lib/vehicles/compliance';
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
  type VehicleComplianceFilter,
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
import { VehicleComplianceBadge } from './vehicle-compliance-badge';
import { VehicleDetailDrawer } from './vehicle-detail-drawer';
import { VehicleFormModal } from './vehicle-form-modal';
import { VehicleStatusBadge } from './vehicle-status-badge';

export interface VehiclesWorkspaceProps {
  agency: AgencyRecord;
  role: AgencyRole;
  initialVehicles: VehicleRecord[];
  initialError: string | null;
  initialComplianceSchemaReady: boolean;
  initialPricingSchemaReady: boolean;
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

const FILTER_SELECT_CLASSES =
  'h-10 sm:h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:border-blue-400 cursor-pointer';

export function VehiclesWorkspace({
  agency,
  role,
  initialVehicles,
  initialError,
  initialComplianceSchemaReady,
  initialPricingSchemaReady,
}: VehiclesWorkspaceProps) {
  const router = useRouter();
  const canManage = canManageVehicles(role);
  const agencyTimeZone = agency.timezone || DEFAULT_TIMEZONE;

  const [vehicles, setVehicles] = useState<VehicleRecord[]>(initialVehicles);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [complianceSchemaReady, setComplianceSchemaReady] = useState<boolean>(
    initialComplianceSchemaReady
  );
  const [pricingSchemaReady, setPricingSchemaReady] = useState<boolean>(
    initialPricingSchemaReady
  );
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

  const complianceSummary = useMemo(
    () =>
      computeFleetComplianceSummary(vehicles, {
        timeZone: agencyTimeZone,
        warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
      }),
    [vehicles, agencyTimeZone]
  );

  const filteredVehicles = useMemo(
    () =>
      filterAndSortVehicles(vehicles, filters, {
        timeZone: agencyTimeZone,
        warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
      }),
    [vehicles, filters, agencyTimeZone]
  );

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    filters.compliance !== 'all' ||
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
        complianceSchemaReady?: boolean;
        pricingSchemaReady?: boolean;
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

      if (typeof payload.complianceSchemaReady === 'boolean') {
        setComplianceSchemaReady(payload.complianceSchemaReady);
      }
      if (typeof payload.pricingSchemaReady === 'boolean') {
        setPricingSchemaReady(payload.pricingSchemaReady);
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

  function toggleComplianceQuickFilter(target: 'expired' | 'expiring_soon') {
    setFilters((prev) => ({
      ...prev,
      compliance: prev.compliance === target ? 'all' : target,
    }));
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title="Véhicules"
        description="Gérez votre parc automobile, les tarifs journaliers en TND, les cautions et le suivi des échéances administratives."
        meta={`${agency.name} · ${ROLE_LABELS[role]} · ${agency.currency_code}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
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

      {!complianceSchemaReady ? (
        <AlertBanner
          variant="warning"
          compact
          title="Migration des échéances en attente"
        >
          Appliquez{' '}
          <span className="font-mono">
            202611210004_vehicle_compliance_dates.sql
          </span>{' '}
          dans Supabase SQL Editor pour activer la sauvegarde des dates
          d’assurance, visite technique et vignette. La gestion de flotte
          existante reste pleinement opérationnelle.
        </AlertBanner>
      ) : null}

      {!pricingSchemaReady ? (
        <AlertBanner
          variant="warning"
          compact
          title="Migration de tarification avancée en attente"
        >
          Appliquez{' '}
          <span className="font-mono">
            202611210005_vehicle_advanced_pricing.sql
          </span>{' '}
          dans Supabase SQL Editor pour activer les forfaits 7/30 jours et les
          tarifs saisonniers. Le tarif journalier, la gestion de flotte et les
          échéances restent pleinement opérationnels.
        </AlertBanner>
      ) : null}

      {feedbackBanner ? (
        <AlertBanner
          variant="success"
          onDismiss={() => setFeedbackBanner(null)}
          dismissLabel="Fermer"
        >
          {feedbackBanner}
        </AlertBanner>
      ) : null}

      {loadError ? (
        <AlertBanner
          variant="error"
          action={
            <Button
              size="sm"
              variant="secondary"
              onClick={refreshVehicles}
              disabled={refreshing}
            >
              Réessayer
            </Button>
          }
        >
          {loadError}
        </AlertBanner>
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
            tone: summary.availableCount > 0 ? 'success' : 'default',
          },
          {
            id: 'rented',
            label: 'En location',
            value: String(summary.rentedCount),
            note: 'Actuellement en circulation',
            tone: summary.rentedCount > 0 ? 'brand' : 'default',
          },
          {
            id: 'maintenance',
            label: 'Maintenance',
            value: String(summary.maintenanceCount),
            note: 'Immobilisés pour entretien',
            tone: summary.maintenanceCount > 0 ? 'warning' : 'default',
          },
        ]}
      />

      {/* Compliance & Expiry alert summary strip */}
      <Surface className="overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800/80">
        <div className="grid grid-cols-1 divide-y divide-slate-200/80 sm:grid-cols-2 sm:divide-y-0 sm:divide-x dark:divide-slate-800/80">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>Documents expirés</span>
              </p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-mono text-xl font-semibold tabular-nums',
                    complianceSummary.expiredDocumentsCount > 0
                      ? 'text-red-700 dark:text-red-300'
                      : 'text-slate-950 dark:text-slate-50'
                  )}
                >
                  {complianceSummary.expiredDocumentsCount}
                </span>
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  sur {complianceSummary.vehiclesWithExpiredCount} véhicule(s)
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant={
                filters.compliance === 'expired' ? 'primary' : 'secondary'
              }
              onClick={() => toggleComplianceQuickFilter('expired')}
              aria-pressed={filters.compliance === 'expired'}
            >
              {filters.compliance === 'expired'
                ? 'Filtre actif'
                : 'Voir les expirés'}
            </Button>
          </div>

          <div className="flex items-center justify-between gap-4 px-4 py-3.5 sm:px-5">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span>
                  Expirent sous {complianceSummary.warningThresholdDays} jours
                </span>
              </p>
              <p className="mt-1.5 flex items-baseline gap-2">
                <span
                  className={cn(
                    'font-mono text-xl font-semibold tabular-nums',
                    complianceSummary.expiringSoonDocumentsCount > 0
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-950 dark:text-slate-50'
                  )}
                >
                  {complianceSummary.expiringSoonDocumentsCount}
                </span>
                <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  sur {complianceSummary.vehiclesWithExpiringSoonCount}{' '}
                  véhicule(s)
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant={
                filters.compliance === 'expiring_soon' ? 'primary' : 'secondary'
              }
              onClick={() => toggleComplianceQuickFilter('expiring_soon')}
              aria-pressed={filters.compliance === 'expiring_soon'}
            >
              {filters.compliance === 'expiring_soon'
                ? 'Filtre actif'
                : 'Voir à renouveler'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F4F6FA] px-4 py-2.5 text-[11px] font-medium text-slate-600 sm:px-5 dark:bg-slate-950/60 dark:text-slate-400">
          <span>{COMPLIANCE_INFORMATIONAL_NOTICE}</span>
          <span className="font-mono whitespace-nowrap tabular-nums">
            Réf. : {complianceSummary.referenceDate} ·{' '}
            {complianceSummary.timeZone}
          </span>
        </div>
      </Surface>

      {/* Inventory table surface */}
      <Surface className="overflow-hidden">
        {/* Toolbar: Search, status segmented control, secondary filters, sort */}
        <div className="space-y-3 border-b border-slate-200 bg-[#F4F6FA] p-4 sm:px-5 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
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
                className="h-11 w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 text-sm text-slate-950 placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:h-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400"
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

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filtrer par échéances administratives"
              value={filters.compliance}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  compliance: e.target.value as VehicleComplianceFilter,
                }))
              }
              className={FILTER_SELECT_CLASSES}
            >
              <option value="all">Toutes échéances</option>
              <option value="expired">Documents expirés</option>
              <option value="expiring_soon">
                Expirent bientôt (≤ {DEFAULT_COMPLIANCE_WARNING_DAYS} j)
              </option>
              <option value="valid">Échéances valides</option>
              <option value="not_provided">Dates non renseignées</option>
            </select>

            <select
              aria-label="Filtrer par catégorie"
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
              className={FILTER_SELECT_CLASSES}
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
              className={FILTER_SELECT_CLASSES}
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
              className={FILTER_SELECT_CLASSES}
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
                className={FILTER_SELECT_CLASSES}
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
                  <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-400">
                    <th className="px-4 py-3 text-start">Véhicule</th>
                    <th className="px-4 py-3 text-start">Immatriculation</th>
                    <th className="px-4 py-3 text-start">Spécifications</th>
                    <th className="px-4 py-3 text-end">Kilométrage</th>
                    <th className="px-4 py-3 text-end">Tarif / jour</th>
                    <th className="px-4 py-3 text-start">Échéances</th>
                    <th className="px-4 py-3 text-start">Statut</th>
                    <th className="px-4 py-3 text-end">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredVehicles.map((vehicle) => {
                    const kmFormatted = new Intl.NumberFormat('fr-TN').format(
                      vehicle.odometer_km
                    );
                    const compliance = evaluateVehicleCompliance(vehicle, {
                      timeZone: agencyTimeZone,
                      warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
                    });
                    const urgent = compliance.mostUrgentItem;
                    const compactLabel =
                      compliance.expiredCount > 1
                        ? `${compliance.expiredCount} expirés`
                        : compliance.expiredCount === 0 &&
                            compliance.expiringSoonCount > 1
                          ? `${compliance.expiringSoonCount} à renouveler`
                          : undefined;

                    return (
                      <tr
                        key={vehicle.id}
                        className="group transition-colors hover:bg-blue-50/45 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => setSelectedVehicle(vehicle)}
                            className="text-start focus-visible:outline-none focus-visible:underline cursor-pointer"
                          >
                            <p className="font-semibold text-slate-950 transition-colors group-hover:text-[#1D4ED8] dark:text-white dark:group-hover:text-blue-400">
                              {vehicle.brand} {vehicle.model}
                              {vehicle.model_year ? (
                                <span className="ms-1.5 font-mono text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400">
                                  {vehicle.model_year}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {getVehicleCategoryLabel(vehicle.category)}
                            </p>
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="inline-flex rounded-md border border-slate-300 bg-[#F4F6FA] px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                            {vehicle.plate_number}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <span>
                            {VEHICLE_TRANSMISSION_LABELS[vehicle.transmission]}
                          </span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
                            ·
                          </span>
                          <span>{VEHICLE_FUEL_LABELS[vehicle.fuel_type]}</span>
                          <span aria-hidden="true" className="mx-1.5 text-slate-300 dark:text-slate-700">
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
                          <p className="font-mono text-sm font-semibold text-slate-950 tabular-nums dark:text-slate-100">
                            {formatTndFromMillimes(vehicle.daily_rate_minor, 'fr')}
                          </p>
                          <p className="font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            Caution :{' '}
                            {formatTndFromMillimes(vehicle.deposit_minor, 'fr')}
                            {vehicle.weekly_rate_minor !== null ||
                            vehicle.monthly_rate_minor !== null
                              ? ` · Forfaits ${[
                                  vehicle.weekly_rate_minor !== null ? '7j' : null,
                                  vehicle.monthly_rate_minor !== null ? '30j' : null,
                                ]
                                  .filter(Boolean)
                                  .join('/')}`
                              : ''}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-0.5">
                            <VehicleComplianceBadge
                              status={compliance.overallStatus}
                              labelOverride={compactLabel}
                            />
                            {urgent &&
                            (compliance.overallStatus === 'expired' ||
                              compliance.overallStatus === 'expiring_soon') ? (
                              <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                                {urgent.shortLabel} ·{' '}
                                {formatComplianceRelativeDays(
                                  urgent.daysRemaining
                                )}
                              </p>
                            ) : null}
                          </div>
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

            {/* Mobile responsive card list */}
            <div className="divide-y divide-slate-200/80 md:hidden dark:divide-slate-800/80">
              {filteredVehicles.map((vehicle) => {
                const kmFormatted = new Intl.NumberFormat('fr-TN').format(
                  vehicle.odometer_km
                );
                const compliance = evaluateVehicleCompliance(vehicle, {
                  timeZone: agencyTimeZone,
                  warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
                });
                const urgent = compliance.mostUrgentItem;

                return (
                  <div key={vehicle.id} className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedVehicle(vehicle)}
                        className="min-w-0 flex-1 text-start cursor-pointer"
                      >
                        <p className="font-semibold text-slate-950 dark:text-slate-50">
                          {vehicle.brand} {vehicle.model}
                          {vehicle.model_year ? (
                            <span className="ms-1.5 font-mono text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400">
                              {vehicle.model_year}
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                          <span className="rounded border border-slate-200/80 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-slate-800 dark:border-slate-700/80 dark:bg-slate-950/70 dark:text-slate-200">
                            {vehicle.plate_number}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{getVehicleCategoryLabel(vehicle.category)}</span>
                        </p>
                      </button>
                      <VehicleStatusBadge status={vehicle.status} />
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50/80 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/45 dark:text-slate-400">
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
                        <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                          /j
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <VehicleComplianceBadge
                        status={compliance.overallStatus}
                      />
                      {urgent &&
                      (compliance.overallStatus === 'expired' ||
                        compliance.overallStatus === 'expiring_soon') ? (
                        <span className="text-slate-500 tabular-nums dark:text-slate-400">
                          {urgent.shortLabel} ·{' '}
                          {formatComplianceRelativeDays(urgent.daysRemaining)}
                        </span>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <Button
                        size="md"
                        variant="secondary"
                        className="flex-1"
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span>Détails</span>
                      </Button>
                      {canManage ? (
                        <Button
                          size="md"
                          variant="primary"
                          className="flex-1"
                          onClick={() => openEditModal(vehicle)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span>Modifier</span>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quiet footer count */}
            <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400">
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
        vehicle={selectedVehicle}
        agencyTimeZone={agencyTimeZone}
        canManage={canManage}
        pricingSchemaReady={pricingSchemaReady}
        onPricingSchemaDetected={setPricingSchemaReady}
        onClose={() => setSelectedVehicle(null)}
        onEdit={(v) => openEditModal(v)}
        onStatusChanged={handleStatusChanged}
      />

      {canManage ? (
        <VehicleFormModal
          key={`${modalState.mode}-${modalState.vehicle?.id ?? 'new'}-${modalState.open ? 'open' : 'closed'}`}
          open={modalState.open}
          mode={modalState.mode}
          vehicle={modalState.vehicle}
          currencyCode={agency.currency_code || 'TND'}
          complianceSchemaReady={complianceSchemaReady}
          pricingSchemaReady={pricingSchemaReady}
          onClose={() =>
            setModalState({ open: false, mode: 'create', vehicle: null })
          }
          onSaved={handleVehicleSaved}
        />
      ) : null}
    </div>
  );
}
