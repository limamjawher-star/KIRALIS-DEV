'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Car,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
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
import { buildFleetCsv } from '@/lib/vehicles/fleet-export';
import {
  applyMobileVehicleFilters,
  resetMobileVehicleFilters,
} from '@/lib/vehicles/mobile-filters';
import {
  computeFleetComplianceSummary,
  DEFAULT_COMPLIANCE_WARNING_DAYS,
  evaluateVehicleCompliance,
} from '@/lib/vehicles/compliance';
import {
  formatComplianceRelativeDaysLocalized,
  formatOdometerLocalized,
  getLocalizedVehicleCategoryLabel,
  getVehiclesCopy,
} from '@/lib/vehicles/i18n';
import {
  canManageVehicles,
  DEFAULT_VEHICLE_FILTERS,
  VEHICLE_CATEGORY_OPTIONS,
  VEHICLE_FUEL_VALUES,
  VEHICLE_SORT_OPTIONS,
  VEHICLE_TRANSMISSION_VALUES,
  type VehicleCategoryPreset,
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

const FILTER_SELECT_CLASSES =
  'h-10 sm:h-9 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 transition-colors hover:border-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:border-blue-400 cursor-pointer';

interface ActiveFilterChip {
  key: string;
  label: string;
  onRemove: () => void;
}

export function VehiclesWorkspace({
  agency,
  role,
  initialVehicles,
  initialError,
  initialComplianceSchemaReady,
  initialPricingSchemaReady,
}: VehiclesWorkspaceProps) {
  const router = useRouter();
  const { locale } = useAppPreferences();
  const copy = getVehiclesCopy(locale);

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [mobileDraftFilters, setMobileDraftFilters] =
    useState<VehicleFilterState>(DEFAULT_VEHICLE_FILTERS);

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

  useEffect(() => {
    if (!mobileFiltersOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setMobileFiltersOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileFiltersOpen]);

  const statusFilterOptions: readonly {
    value: 'all' | VehicleStatus;
    label: string;
  }[] = useMemo(
    () => [
      { value: 'all', label: copy.toolbar.allStatuses },
      { value: 'available', label: copy.statuses.available },
      { value: 'rented', label: copy.statuses.rented },
      { value: 'maintenance', label: copy.statuses.maintenance },
      { value: 'retired', label: copy.statuses.retired },
    ],
    [copy]
  );

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

  // Sheet changes remain drafts until Apply, including the preview count.
  const mobilePreviewCount = useMemo(
    () =>
      mobileFiltersOpen
        ? filterAndSortVehicles(vehicles, mobileDraftFilters, {
            timeZone: agencyTimeZone,
            warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
          }).length
        : 0,
    [mobileFiltersOpen, vehicles, mobileDraftFilters, agencyTimeZone]
  );

  const openMobileFilters = () => {
    setMobileDraftFilters({ ...filters });
    setMobileFiltersOpen(true);
  };

  const applyMobileFilters = () => {
    setFilters((previous) => applyMobileVehicleFilters(previous, mobileDraftFilters));
    setMobileFiltersOpen(false);
  };

  const secondaryFilterCount =
    (filters.compliance !== 'all' ? 1 : 0) +
    (filters.category !== 'all' ? 1 : 0) +
    (filters.transmission !== 'all' ? 1 : 0) +
    (filters.fuelType !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'newest' ? 1 : 0);

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.status !== 'all' ||
    secondaryFilterCount > 0;

  const activeFilterChips: ActiveFilterChip[] = useMemo(() => {
    const chips: ActiveFilterChip[] = [];

    if (filters.compliance !== 'all') {
      const complianceLabels: Record<
        Exclude<VehicleComplianceFilter, 'all'>,
        string
      > = {
        expired: copy.toolbar.complianceExpired,
        expiring_soon: copy.toolbar.complianceExpiringSoon(
          DEFAULT_COMPLIANCE_WARNING_DAYS
        ),
        valid: copy.toolbar.complianceValid,
        not_provided: copy.toolbar.complianceNotProvided,
      };
      chips.push({
        key: 'compliance',
        label: complianceLabels[filters.compliance],
        onRemove: () =>
          setFilters((prev) => ({ ...prev, compliance: 'all' })),
      });
    }

    if (filters.category !== 'all') {
      chips.push({
        key: 'category',
        label: getLocalizedVehicleCategoryLabel(filters.category, locale),
        onRemove: () => setFilters((prev) => ({ ...prev, category: 'all' })),
      });
    }

    if (filters.transmission !== 'all') {
      chips.push({
        key: 'transmission',
        label: copy.transmissions[filters.transmission],
        onRemove: () =>
          setFilters((prev) => ({ ...prev, transmission: 'all' })),
      });
    }

    if (filters.fuelType !== 'all') {
      chips.push({
        key: 'fuelType',
        label: copy.fuels[filters.fuelType],
        onRemove: () => setFilters((prev) => ({ ...prev, fuelType: 'all' })),
      });
    }

    if (filters.sortBy !== 'newest') {
      chips.push({
        key: 'sortBy',
        label: `${copy.toolbar.sortPrefix} ${copy.sortOptions[filters.sortBy]}`,
        onRemove: () => setFilters((prev) => ({ ...prev, sortBy: 'newest' })),
      });
    }

    return chips;
  }, [filters, copy, locale]);

  const hasUrgentCompliance =
    complianceSummary.expiredDocumentsCount > 0 ||
    complianceSummary.expiringSoonDocumentsCount > 0 ||
    filters.compliance === 'expired' ||
    filters.compliance === 'expiring_soon';

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
        setLoadError(payload?.error ?? copy.feedback.refreshError);
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
      setLoadError(copy.feedback.refreshNetworkError);
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

    const vehicleName = `${saved.brand} ${saved.model}`;
    setModalState({ open: false, mode: 'create', vehicle: null });
    setFeedbackBanner(
      mode === 'create'
        ? copy.feedback.vehicleAdded(vehicleName, saved.plate_number)
        : copy.feedback.vehicleUpdated(vehicleName, saved.plate_number)
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
        ? copy.feedback.vehicleRetired(updated.plate_number)
        : copy.feedback.vehicleStatusChanged(
            updated.plate_number,
            copy.statuses[updated.status]
          )
    );
    router.refresh();
  }

  function downloadVisibleFleetCsv() {
    if (filteredVehicles.length === 0) return;

    // These records were supplied by the existing authenticated agency endpoint;
    // export only the currently visible selection, never hidden agency data.
    const csv = buildFleetCsv(filteredVehicles, copy);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kiralis-fleet-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Allow browsers time to hand off the download before releasing the URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
        title={copy.header.title}
        description={copy.header.description}
        meta={`${agency.name} · ${copy.roles[role]} · ${agency.currency_code}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={refreshVehicles}
              disabled={refreshing}
              aria-label={copy.header.refreshAria}
              className="h-10 w-10 px-0 sm:w-auto sm:px-4"
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{copy.header.refresh}</span>
            </Button>
            <Button
              variant="secondary"
              onClick={downloadVisibleFleetCsv}
              disabled={filteredVehicles.length === 0}
              aria-label={copy.header.exportCsvAria}
              title={copy.header.exportCsv}
              className="h-10 w-10 px-0 sm:w-auto sm:px-4"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{copy.header.exportCsv}</span>
            </Button>
            {canManage ? (
              <Button variant="primary" onClick={openCreateModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{copy.header.addVehicle}</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {!complianceSchemaReady ? (
        <AlertBanner
          variant="warning"
          compact
          title={copy.migrations.complianceBannerTitle}
        >
          {copy.migrations.complianceBannerPrefix}{' '}
          <span dir="ltr" className="font-mono">
            202611210004_vehicle_compliance_dates.sql
          </span>{' '}
          {copy.migrations.complianceBannerSuffix}
        </AlertBanner>
      ) : null}

      {!pricingSchemaReady ? (
        <AlertBanner
          variant="warning"
          compact
          title={copy.migrations.pricingBannerTitle}
        >
          {copy.migrations.pricingBannerPrefix}{' '}
          <span dir="ltr" className="font-mono">
            202611210005_vehicle_advanced_pricing.sql
          </span>{' '}
          {copy.migrations.pricingBannerSuffix}
        </AlertBanner>
      ) : null}

      {feedbackBanner ? (
        <AlertBanner
          variant="success"
          onDismiss={() => setFeedbackBanner(null)}
          dismissLabel={copy.list.close}
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
              {copy.list.retry}
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
            label: copy.kpis.totalLabel,
            value: String(summary.totalCount),
            note:
              summary.retiredCount > 0
                ? copy.kpis.retiredNote(summary.retiredCount)
                : copy.kpis.totalNote,
          },
          {
            id: 'available',
            label: copy.kpis.availableLabel,
            value: String(summary.availableCount),
            note: copy.kpis.availableNote,
            tone: summary.availableCount > 0 ? 'success' : 'default',
          },
          {
            id: 'rented',
            label: copy.kpis.rentedLabel,
            value: String(summary.rentedCount),
            note: copy.kpis.rentedNote,
            tone: summary.rentedCount > 0 ? 'brand' : 'default',
          },
          {
            id: 'maintenance',
            label: copy.kpis.maintenanceLabel,
            value: String(summary.maintenanceCount),
            note: copy.kpis.maintenanceNote,
            tone: summary.maintenanceCount > 0 ? 'warning' : 'default',
          },
        ]}
      />

      {/* Adaptive Compliance Alert Strip: compact when 0 alerts, vivid filter toggles when alerts exist */}
      {hasUrgentCompliance ? (
        <Surface className="overflow-hidden divide-y divide-slate-200/80 dark:divide-slate-800/80">
          <div className="grid grid-cols-1 divide-y divide-slate-200/80 sm:grid-cols-2 sm:divide-y-0 sm:divide-x rtl:sm:divide-x-reverse dark:divide-slate-800/80">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">
                    {copy.compliance.expiredDocsLabel}
                  </span>
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-lg font-bold tabular-nums sm:text-xl',
                      complianceSummary.expiredDocumentsCount > 0
                        ? 'text-red-700 dark:text-red-300'
                        : 'text-slate-950 dark:text-slate-50'
                    )}
                  >
                    {complianceSummary.expiredDocumentsCount}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {copy.compliance.onVehiclesCount(
                      complianceSummary.vehiclesWithExpiredCount
                    )}
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
                  ? copy.compliance.filterActive
                  : copy.compliance.viewExpired}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                    <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="truncate">
                    {copy.compliance.expiringDocsLabel(
                      complianceSummary.warningThresholdDays
                    )}
                  </span>
                </p>
                <p className="mt-1 flex items-baseline gap-2">
                  <span
                    className={cn(
                      'font-mono text-lg font-bold tabular-nums sm:text-xl',
                      complianceSummary.expiringSoonDocumentsCount > 0
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-slate-950 dark:text-slate-50'
                    )}
                  >
                    {complianceSummary.expiringSoonDocumentsCount}
                  </span>
                  <span className="text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {copy.compliance.onVehiclesCount(
                      complianceSummary.vehiclesWithExpiringSoonCount
                    )}
                  </span>
                </p>
              </div>
              <Button
                size="sm"
                variant={
                  filters.compliance === 'expiring_soon'
                    ? 'primary'
                    : 'secondary'
                }
                onClick={() => toggleComplianceQuickFilter('expiring_soon')}
                aria-pressed={filters.compliance === 'expiring_soon'}
              >
                {filters.compliance === 'expiring_soon'
                  ? copy.compliance.filterActive
                  : copy.compliance.viewExpiringSoon}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F4F6FA] px-4 py-2 text-[11px] font-medium text-slate-600 sm:px-5 dark:bg-slate-950/60 dark:text-slate-400">
            <span>{copy.compliance.informationalNotice}</span>
            <span
              dir="ltr"
              className="font-mono whitespace-nowrap tabular-nums"
            >
              {copy.compliance.refPrefix}: {complianceSummary.referenceDate} ·{' '}
              {complianceSummary.timeZone}
            </span>
          </div>
        </Surface>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-[0_1px_2px_rgba(11,18,32,0.03)] dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
          <span className="flex items-center gap-2 font-medium">
            <CheckCircle2
              className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            <span>
              {copy.compliance.allCompliantBanner(
                complianceSummary.warningThresholdDays
              )}
            </span>
          </span>
          <span
            dir="ltr"
            className="font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums dark:text-slate-400"
          >
            {copy.compliance.refPrefix}: {complianceSummary.referenceDate} ·{' '}
            {complianceSummary.timeZone}
          </span>
        </div>
      )}

      {/* Inventory table & card surface */}
      <Surface className="overflow-hidden">
        {/* Toolbar: Search, status segmented control, mobile filter sheet trigger, desktop inline filters */}
        <div className="space-y-3 border-b border-slate-200 bg-[#F4F6FA] p-3.5 sm:px-5 sm:py-4 dark:border-slate-800 dark:bg-slate-950/60">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-center gap-2 lg:max-w-sm">
              <div className="relative min-w-0 flex-1">
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
                  placeholder={copy.toolbar.searchPlaceholder}
                  aria-label={copy.toolbar.searchAria}
                  className="h-11 w-full rounded-xl border border-slate-300 bg-white ps-10 pe-3.5 text-sm text-slate-950 placeholder:text-slate-400 transition-colors hover:border-slate-400 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 sm:h-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-600 dark:focus:border-blue-400"
                />
              </div>

              {/* Mobile Filter Bottom Sheet Trigger */}
              <button
                type="button"
                onClick={openMobileFilters}
                aria-label={copy.toolbar.filtersOpenAria}
                aria-expanded={mobileFiltersOpen}
                className={cn(
                  'inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/80 md:hidden cursor-pointer',
                  secondaryFilterCount > 0
                    ? 'border-[#1D4ED8] bg-[#1D4ED8] text-white dark:border-blue-500 dark:bg-blue-600'
                    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                )}
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                <span>{copy.toolbar.filtersButton}</span>
                {secondaryFilterCount > 0 ? (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-white/20 px-1 font-mono text-[11px] font-bold tabular-nums">
                    {secondaryFilterCount}
                  </span>
                ) : null}
              </button>
            </div>

            <SegmentedControl
              options={statusFilterOptions}
              value={filters.status}
              onChange={(nextStatus) =>
                setFilters((prev) => ({ ...prev, status: nextStatus }))
              }
              ariaLabel={copy.toolbar.statusFilterAria}
            />
          </div>

          {/* Desktop & Tablet inline filters (mobile uses the slide-up Filter Bottom Sheet) */}
          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <select
              aria-label={copy.toolbar.complianceFilterAria}
              value={filters.compliance}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  compliance: e.target.value as VehicleComplianceFilter,
                }))
              }
              className={FILTER_SELECT_CLASSES}
            >
              <option value="all">{copy.toolbar.allCompliance}</option>
              <option value="expired">{copy.toolbar.complianceExpired}</option>
              <option value="expiring_soon">
                {copy.toolbar.complianceExpiringSoon(
                  DEFAULT_COMPLIANCE_WARNING_DAYS
                )}
              </option>
              <option value="valid">{copy.toolbar.complianceValid}</option>
              <option value="not_provided">
                {copy.toolbar.complianceNotProvided}
              </option>
            </select>

            <select
              aria-label={copy.toolbar.categoryFilterAria}
              value={filters.category}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, category: e.target.value }))
              }
              className={FILTER_SELECT_CLASSES}
            >
              <option value="all">{copy.toolbar.allCategories}</option>
              {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {copy.categories[opt.value as VehicleCategoryPreset]}
                </option>
              ))}
            </select>

            <select
              aria-label={copy.toolbar.transmissionFilterAria}
              value={filters.transmission}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  transmission: e.target.value as 'all' | VehicleTransmission,
                }))
              }
              className={FILTER_SELECT_CLASSES}
            >
              <option value="all">{copy.toolbar.allTransmissions}</option>
              {VEHICLE_TRANSMISSION_VALUES.map((tr) => (
                <option key={tr} value={tr}>
                  {copy.transmissions[tr]}
                </option>
              ))}
            </select>

            <select
              aria-label={copy.toolbar.fuelFilterAria}
              value={filters.fuelType}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  fuelType: e.target.value as 'all' | VehicleFuelType,
                }))
              }
              className={FILTER_SELECT_CLASSES}
            >
              <option value="all">{copy.toolbar.allFuels}</option>
              {VEHICLE_FUEL_VALUES.map((fuel) => (
                <option key={fuel} value={fuel}>
                  {copy.fuels[fuel]}
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
                  <span>{copy.toolbar.reset}</span>
                </Button>
              ) : null}

              <select
                aria-label={copy.toolbar.sortAria}
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
                    {copy.toolbar.sortPrefix} {copy.sortOptions[opt.value]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Mobile active filter summary & dismissible filter chips */}
          {hasActiveFilters ? (
            <div className="space-y-2 md:hidden">
              {activeFilterChips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  {activeFilterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.onRemove}
                      aria-label={copy.toolbar.removeChipAria(chip.label)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-xs font-semibold text-[#1D4ED8] transition-colors hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 dark:border-blue-800 dark:bg-blue-950/60 dark:text-blue-300 cursor-pointer"
                    >
                      <span>{chip.label}</span>
                      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
                <span className="font-mono text-[11px] font-semibold tabular-nums">
                  {copy.toolbar.countRatio(
                    filteredVehicles.length,
                    vehicles.length
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setFilters(DEFAULT_VEHICLE_FILTERS)}
                  className="inline-flex items-center gap-1 font-semibold text-[#1D4ED8] hover:underline dark:text-blue-400 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>{copy.toolbar.reset}</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Empty state: zero vehicles in agency */}
        {vehicles.length === 0 ? (
          <EmptyState
            icon={<Car className="h-5 w-5" aria-hidden="true" />}
            title={copy.emptyStates.fleetEmptyTitle}
            description={
              canManage
                ? copy.emptyStates.fleetEmptyManageDesc
                : copy.emptyStates.fleetEmptyAgentDesc
            }
            action={
              canManage ? (
                <Button variant="primary" onClick={openCreateModal}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.emptyStates.addFirstVehicle}</span>
                </Button>
              ) : undefined
            }
          />
        ) : filteredVehicles.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            title={copy.emptyStates.filteredEmptyTitle}
            description={copy.emptyStates.filteredEmptyDesc}
            action={
              <Button
                variant="secondary"
                onClick={() => setFilters(DEFAULT_VEHICLE_FILTERS)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>{copy.toolbar.resetFilters}</span>
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop high-density table (lg+ to avoid 8-column squeeze on 768px tablet) */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-white text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-[#0F172A] dark:text-slate-400">
                    <th className="px-4 py-3 text-start">
                      {copy.list.colVehicle}
                    </th>
                    <th className="px-4 py-3 text-start">
                      {copy.list.colPlate}
                    </th>
                    <th className="px-4 py-3 text-start">
                      {copy.list.colSpecs}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.list.colOdometer}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.list.colDailyRate}
                    </th>
                    <th className="px-4 py-3 text-start">
                      {copy.list.colCompliance}
                    </th>
                    <th className="px-4 py-3 text-start">
                      {copy.list.colStatus}
                    </th>
                    <th className="px-4 py-3 text-end">
                      {copy.list.colActions}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredVehicles.map((vehicle) => {
                    const kmFormatted = formatOdometerLocalized(
                      vehicle.odometer_km,
                      locale
                    );
                    const compliance = evaluateVehicleCompliance(vehicle, {
                      timeZone: agencyTimeZone,
                      warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
                    });
                    const urgent = compliance.mostUrgentItem;
                    const compactLabel =
                      compliance.expiredCount > 1
                        ? copy.compliance.expiredCountBadge(
                            compliance.expiredCount
                          )
                        : compliance.expiredCount === 0 &&
                            compliance.expiringSoonCount > 1
                          ? copy.compliance.expiringCountBadge(
                              compliance.expiringSoonCount
                            )
                          : undefined;
                    const vehicleDisplayName = `${vehicle.brand} ${vehicle.model} ${vehicle.plate_number}`;
                    const packageTags = [
                      vehicle.weekly_rate_minor !== null
                        ? copy.list.daysShort7
                        : null,
                      vehicle.monthly_rate_minor !== null
                        ? copy.list.daysShort30
                        : null,
                    ].filter(Boolean);

                    return (
                      <tr
                        key={vehicle.id}
                        onClick={() => setSelectedVehicle(vehicle)}
                        className="group cursor-pointer transition-colors hover:bg-blue-50/45 dark:hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedVehicle(vehicle);
                            }}
                            className="text-start focus-visible:outline-none focus-visible:underline cursor-pointer"
                          >
                            <p className="font-semibold text-slate-950 transition-colors group-hover:text-[#1D4ED8] dark:text-white dark:group-hover:text-blue-400">
                              {vehicle.brand} {vehicle.model}
                              {vehicle.model_year ? (
                                <span
                                  dir="ltr"
                                  className="ms-1.5 inline-block font-mono text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400"
                                >
                                  {vehicle.model_year}
                                </span>
                              ) : null}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400">
                              {getLocalizedVehicleCategoryLabel(
                                vehicle.category,
                                locale
                              )}
                            </p>
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            dir="ltr"
                            className="inline-flex rounded-md border border-slate-300 bg-[#F4F6FA] px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                          >
                            {vehicle.plate_number}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                          <span>
                            {copy.transmissions[vehicle.transmission]}
                          </span>
                          <span
                            aria-hidden="true"
                            className="mx-1.5 text-slate-300 dark:text-slate-700"
                          >
                            ·
                          </span>
                          <span>{copy.fuels[vehicle.fuel_type]}</span>
                          <span
                            aria-hidden="true"
                            className="mx-1.5 text-slate-300 dark:text-slate-700"
                          >
                            ·
                          </span>
                          <span className="tabular-nums">
                            {copy.list.seatsShort(vehicle.seats)}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-end font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                          <span dir="ltr" className="inline-block">
                            {kmFormatted} km
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-end">
                          <p
                            dir="ltr"
                            className="font-mono text-sm font-bold text-slate-950 tabular-nums dark:text-slate-100"
                          >
                            {formatTndFromMillimes(
                              vehicle.daily_rate_minor,
                              locale
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            {copy.list.depositPrefix}{' '}
                            <span dir="ltr" className="inline-block font-mono">
                              {formatTndFromMillimes(
                                vehicle.deposit_minor,
                                locale
                              )}
                            </span>
                            {packageTags.length > 0
                              ? ` · ${copy.list.packagesPrefix} ${packageTags.join('/')}`
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
                                {copy.complianceDocuments[urgent.key].shortLabel}{' '}
                                ·{' '}
                                {formatComplianceRelativeDaysLocalized(
                                  urgent.daysRemaining,
                                  locale
                                )}
                              </p>
                            ) : null}
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <VehicleStatusBadge status={vehicle.status} />
                        </td>

                        <td
                          className="px-4 py-3.5 text-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setSelectedVehicle(vehicle)}
                              aria-label={copy.list.viewVehicleAria(
                                vehicleDisplayName
                              )}
                            >
                              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>{copy.list.details}</span>
                            </Button>
                            {canManage ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditModal(vehicle)}
                                aria-label={copy.list.editVehicleAria(
                                  vehicleDisplayName
                                )}
                              >
                                <Pencil
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>{copy.list.edit}</span>
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

            {/* Mobile & Tablet responsive card grid (1 col mobile, 2 cols tablet) */}
            <div className="grid grid-cols-1 gap-3 bg-[#F4F6FA] p-3 md:grid-cols-2 md:gap-4 md:p-4 lg:hidden dark:bg-slate-950/50">
              {filteredVehicles.map((vehicle) => {
                const kmFormatted = formatOdometerLocalized(
                  vehicle.odometer_km,
                  locale
                );
                const compliance = evaluateVehicleCompliance(vehicle, {
                  timeZone: agencyTimeZone,
                  warningThresholdDays: DEFAULT_COMPLIANCE_WARNING_DAYS,
                });
                const urgent = compliance.mostUrgentItem;
                const compactLabel =
                  compliance.expiredCount > 1
                    ? copy.compliance.expiredCountBadge(compliance.expiredCount)
                    : compliance.expiredCount === 0 &&
                        compliance.expiringSoonCount > 1
                      ? copy.compliance.expiringCountBadge(
                          compliance.expiringSoonCount
                        )
                      : undefined;
                const packageTags = [
                  vehicle.weekly_rate_minor !== null
                    ? copy.list.daysShort7
                    : null,
                  vehicle.monthly_rate_minor !== null
                    ? copy.list.daysShort30
                    : null,
                ].filter(Boolean);

                return (
                  <article
                    key={vehicle.id}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(11,18,32,0.04)] transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedVehicle(vehicle)}
                      className="w-full space-y-3 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/40 rounded-xl cursor-pointer"
                    >
                      {/* Top precision strip: License plate + Operational status */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          dir="ltr"
                          className="inline-flex rounded-md border border-slate-300 bg-[#F4F6FA] px-2.5 py-0.5 font-mono text-xs font-bold tracking-wider text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                        >
                          {vehicle.plate_number}
                        </span>
                        <VehicleStatusBadge status={vehicle.status} />
                      </div>

                      {/* Vehicle identity headline */}
                      <div>
                        <h3 className="font-display text-base font-bold leading-snug text-slate-950 dark:text-white">
                          {vehicle.brand} {vehicle.model}
                          {vehicle.model_year ? (
                            <span
                              dir="ltr"
                              className="ms-1.5 inline-block font-mono text-xs font-normal text-slate-500 tabular-nums dark:text-slate-400"
                            >
                              {vehicle.model_year}
                            </span>
                          ) : null}
                        </h3>
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          {getLocalizedVehicleCategoryLabel(
                            vehicle.category,
                            locale
                          )}{' '}
                          · {copy.transmissions[vehicle.transmission]} ·{' '}
                          {copy.fuels[vehicle.fuel_type]} ·{' '}
                          {copy.list.seatsShort(vehicle.seats)}
                        </p>
                      </div>

                      {/* Pricing & odometer operational bar */}
                      <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl bg-[#F4F6FA] px-3 py-2.5 dark:bg-slate-950/60">
                        <div className="space-y-0.5">
                          <p
                            dir="ltr"
                            className="font-mono text-base font-bold text-[#1D4ED8] tabular-nums rtl:text-right dark:text-blue-400"
                          >
                            {formatTndFromMillimes(
                              vehicle.daily_rate_minor,
                              locale
                            )}
                            <span className="ms-0.5 font-sans text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {copy.list.perDayShort}
                            </span>
                          </p>
                          <p className="text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                            {copy.list.depositPrefix}{' '}
                            <span dir="ltr" className="inline-block font-mono">
                              {formatTndFromMillimes(
                                vehicle.deposit_minor,
                                locale
                              )}
                            </span>
                            {packageTags.length > 0
                              ? ` · ${packageTags.join('/')}`
                              : ''}
                          </p>
                        </div>

                        <span
                          dir="ltr"
                          className="font-mono text-xs font-semibold text-slate-700 tabular-nums dark:text-slate-300"
                        >
                          {kmFormatted} km
                        </span>
                      </div>

                      {/* Compliance row */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <VehicleComplianceBadge
                          status={compliance.overallStatus}
                          labelOverride={compactLabel}
                        />
                        {urgent &&
                        (compliance.overallStatus === 'expired' ||
                          compliance.overallStatus === 'expiring_soon') ? (
                          <span className="text-slate-600 tabular-nums dark:text-slate-400">
                            {copy.complianceDocuments[urgent.key].shortLabel} ·{' '}
                            {formatComplianceRelativeDaysLocalized(
                              urgent.daysRemaining,
                              locale
                            )}
                          </span>
                        ) : null}
                      </div>
                    </button>

                    {/* Thumb-friendly 44px bottom action bar */}
                    <div className="flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800/80">
                      <Button
                        size="md"
                        variant="secondary"
                        className="h-11 flex-1 sm:h-10"
                        onClick={() => setSelectedVehicle(vehicle)}
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span>{copy.list.details}</span>
                      </Button>
                      {canManage ? (
                        <Button
                          size="md"
                          variant="primary"
                          className="h-11 flex-1 sm:h-10"
                          onClick={() => openEditModal(vehicle)}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                          <span>{copy.list.edit}</span>
                        </Button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Quiet footer count */}
            <div className="flex items-center justify-between border-t border-slate-200/80 bg-slate-50/75 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-400">
              <span className="tabular-nums">
                {copy.list.footerCount(
                  filteredVehicles.length,
                  vehicles.length
                )}
              </span>
              {!canManage ? (
                <span>{copy.list.agentReadOnlyFooter}</span>
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

      {/* Mobile Slide-Up Filter Bottom Sheet */}
      <AnimatePresence>
        {mobileFiltersOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-50 flex items-end bg-slate-950/60 backdrop-blur-[2px] md:hidden"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setMobileFiltersOpen(false);
              }
            }}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="vehicles-mobile-filters-title"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-3xl border-t border-slate-800 bg-white shadow-2xl dark:bg-slate-900"
            >
              {/* Obsidian grabber + header */}
              <div
                className="flex justify-center bg-[#0B1220] pt-2.5 pb-1"
                aria-hidden="true"
              >
                <span className="h-1 w-10 rounded-full bg-slate-600" />
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-[#0B1220] px-5 py-3.5 text-white">
                <div>
                  <h2
                    id="vehicles-mobile-filters-title"
                    className="font-display text-base font-bold tracking-tight text-white"
                  >
                    {copy.toolbar.filtersSheetTitle}
                  </h2>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-400 tabular-nums">
                    {copy.toolbar.countRatio(
                      mobilePreviewCount,
                      vehicles.length
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label={copy.toolbar.filtersCloseAria}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/* Stacked 44px thumb-friendly filter controls */}
              <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
                <div className="space-y-1.5">
                  <label
                    htmlFor="mobile-filter-compliance"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {copy.toolbar.complianceFilterLabel}
                  </label>
                  <select
                    id="mobile-filter-compliance"
                    value={mobileDraftFilters.compliance}
                    onChange={(e) =>
                      setMobileDraftFilters((prev) => ({
                        ...prev,
                        compliance: e.target.value as VehicleComplianceFilter,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="all">{copy.toolbar.allCompliance}</option>
                    <option value="expired">
                      {copy.toolbar.complianceExpired}
                    </option>
                    <option value="expiring_soon">
                      {copy.toolbar.complianceExpiringSoon(
                        DEFAULT_COMPLIANCE_WARNING_DAYS
                      )}
                    </option>
                    <option value="valid">
                      {copy.toolbar.complianceValid}
                    </option>
                    <option value="not_provided">
                      {copy.toolbar.complianceNotProvided}
                    </option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="mobile-filter-category"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {copy.toolbar.categoryLabel}
                  </label>
                  <select
                    id="mobile-filter-category"
                    value={mobileDraftFilters.category}
                    onChange={(e) =>
                      setMobileDraftFilters((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    <option value="all">{copy.toolbar.allCategories}</option>
                    {VEHICLE_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {copy.categories[opt.value as VehicleCategoryPreset]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-filter-transmission"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {copy.toolbar.transmissionLabel}
                    </label>
                    <select
                      id="mobile-filter-transmission"
                      value={mobileDraftFilters.transmission}
                      onChange={(e) =>
                        setMobileDraftFilters((prev) => ({
                          ...prev,
                          transmission: e.target.value as
                            | 'all'
                            | VehicleTransmission,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="all">
                        {copy.toolbar.allTransmissionsShort}
                      </option>
                      {VEHICLE_TRANSMISSION_VALUES.map((tr) => (
                        <option key={tr} value={tr}>
                          {copy.transmissions[tr]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="mobile-filter-fuel"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {copy.toolbar.fuelLabel}
                    </label>
                    <select
                      id="mobile-filter-fuel"
                      value={mobileDraftFilters.fuelType}
                      onChange={(e) =>
                        setMobileDraftFilters((prev) => ({
                          ...prev,
                          fuelType: e.target.value as 'all' | VehicleFuelType,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="all">{copy.toolbar.allFuelsShort}</option>
                      {VEHICLE_FUEL_VALUES.map((fuel) => (
                        <option key={fuel} value={fuel}>
                          {copy.fuels[fuel]}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="mobile-filter-sort"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    {copy.toolbar.sortByLabel}
                  </label>
                  <select
                    id="mobile-filter-sort"
                    value={mobileDraftFilters.sortBy}
                    onChange={(e) =>
                      setMobileDraftFilters((prev) => ({
                        ...prev,
                        sortBy: e.target.value as VehicleSortKey,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-[#1D4ED8] focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    {VEHICLE_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {copy.sortOptions[opt.value]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sticky safe-area bottom action bar */}
              <div className="pb-safe flex items-center gap-2.5 border-t border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/80">
                <Button
                  type="button"
                  variant="secondary"
                  className="h-11"
                  onClick={() =>
                    setMobileDraftFilters((previous) =>
                      resetMobileVehicleFilters(previous)
                    )
                  }
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.toolbar.reset}</span>
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="h-11 flex-1"
                  onClick={applyMobileFilters}
                >
                  <span>
                    {copy.toolbar.applyCount(mobilePreviewCount)}
                  </span>
                </Button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
