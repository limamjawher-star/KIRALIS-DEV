'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
  Users,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getCustomerCountryLabel } from '@/lib/customers/types';
import {
  createCustomerDriversController,
  createDriverSingleFlightGuard,
  formatDriverExpiryDate,
  INITIAL_CUSTOMER_DRIVERS_STATE,
  submitToggleDriverActive,
  type CustomerDriverClientItem,
  type CustomerDriversViewState,
} from '@/lib/drivers/client';
import {
  canManageCustomerDrivers,
  type DriverEligibilityPrecheckStatus,
  type DriverEligibilitySeverity,
  type DriverVerificationStatus,
} from '@/lib/drivers/types';
import type { AgencyRole } from '@/lib/supabase/database.types';
import { AddDriverForm } from './add-driver-form';
import { DriverVerificationForm } from './driver-verification-form';
import { EditDriverForm } from './edit-driver-form';

export interface CustomerDriversSectionProps {
  customerId: string;
  role: AgencyRole;
}

function getDriverInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'DR';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getVerificationBadgeClasses(status: DriverVerificationStatus): string {
  switch (status) {
    case 'verified':
      return 'border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300';
    case 'pending':
      return 'border-amber-200/90 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
    case 'rejected':
      return 'border-red-200/90 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';
    case 'unverified':
    default:
      return 'border-slate-200/90 bg-slate-100/90 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  }
}

function getEligibilityBadgeClasses(
  status: DriverEligibilityPrecheckStatus
): string {
  switch (status) {
    case 'blocked':
      return 'border-red-200/90 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300';
    case 'attention_required':
      return 'border-amber-200/90 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300';
    case 'checks_passed_manual_review_required':
    default:
      return 'border-emerald-200/90 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300';
  }
}

function getFlagRowClasses(severity: DriverEligibilitySeverity): string {
  switch (severity) {
    case 'blocking':
      return 'border-red-200/90 bg-red-50/80 text-red-900 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200';
    case 'warning':
      return 'border-amber-200/90 bg-amber-50/80 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/35 dark:text-amber-200';
    case 'info':
    default:
      return 'border-sky-200/90 bg-sky-50/75 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/35 dark:text-sky-200';
  }
}

function EligibilityIcon({
  status,
}: {
  status: DriverEligibilityPrecheckStatus;
}) {
  switch (status) {
    case 'blocked':
      return <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'attention_required':
      return (
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      );
    case 'checks_passed_manual_review_required':
    default:
      return <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
}

function VerificationIcon({ status }: { status: DriverVerificationStatus }) {
  switch (status) {
    case 'verified':
      return (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      );
    case 'pending':
      return <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'rejected':
      return <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
    case 'unverified':
    default:
      return <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
  }
}

function FlagSeverityIcon({
  severity,
}: {
  severity: DriverEligibilitySeverity;
}) {
  switch (severity) {
    case 'blocking':
      return (
        <AlertCircle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400"
          aria-hidden="true"
        />
      );
    case 'warning':
      return (
        <AlertTriangle
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
          aria-hidden="true"
        />
      );
    case 'info':
    default:
      return (
        <Info
          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
          aria-hidden="true"
        />
      );
  }
}

export function CustomerDriversSection({
  customerId,
  role,
}: CustomerDriversSectionProps) {
  const { dict, locale } = useAppPreferences();
  const notProvided = dict.customersDirectory.notProvided;
  const driversCopy = dict.customersDirectory.detailDrawer.drivers;
  const addCopy = driversCopy.addForm;
  const editCopy = driversCopy.editForm;
  const verifyCopy = driversCopy.verificationForm;
  const activationCopy = driversCopy.activation;
  const canManageDrivers = canManageCustomerDrivers(role);

  const [state, setState] = useState<CustomerDriversViewState>(
    INITIAL_CUSTOMER_DRIVERS_STATE
  );
  const [activePanel, setActivePanel] = useState<
    | { kind: 'add'; customerId: string }
    | { kind: 'edit'; customerId: string; driverId: string }
    | { kind: 'verify'; customerId: string; driverId: string }
    | { kind: 'confirm_deactivate'; customerId: string; driverId: string }
    | null
  >(null);
  const [statusBanner, setStatusBanner] = useState<{
    customerId: string;
    message: string;
    tone: 'success' | 'warning' | 'error';
  } | null>(null);
  const [togglingTarget, setTogglingTarget] = useState<{
    customerId: string;
    driverId: string;
  } | null>(null);

  const controllerRef = useRef<ReturnType<
    typeof createCustomerDriversController
  > | null>(null);
  const activeCustomerIdRef = useRef(customerId);
  const toggleGuardRef = useRef(createDriverSingleFlightGuard());
  const toggleAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    activeCustomerIdRef.current = customerId;
  }, [customerId]);

  useEffect(() => {
    isMountedRef.current = true;
    const toggleGuard = toggleGuardRef.current;
    const controller = createCustomerDriversController(fetch, setState);
    controllerRef.current = controller;
    void controller.loadForCustomer(customerId, role);

    return () => {
      isMountedRef.current = false;
      controller.close();
      if (controllerRef.current === controller) {
        controllerRef.current = null;
      }
      if (toggleAbortRef.current) {
        toggleAbortRef.current.abort();
        toggleAbortRef.current = null;
      }
      toggleGuard.release();
    };
  }, [customerId, role]);

  const handleRefresh = useCallback(() => {
    void controllerRef.current?.retry();
  }, []);

  const handleOpenAddForm = useCallback(() => {
    if (!canManageDrivers) {
      return;
    }
    setStatusBanner(null);
    setActivePanel({ kind: 'add', customerId });
  }, [canManageDrivers, customerId]);

  const handleOpenEditForm = useCallback(
    (driverId: string) => {
      if (!canManageDrivers) {
        return;
      }
      setStatusBanner(null);
      setActivePanel({ kind: 'edit', customerId, driverId });
    },
    [canManageDrivers, customerId]
  );

  const handleOpenVerifyForm = useCallback(
    (driverId: string) => {
      if (!canManageDrivers) {
        return;
      }
      setStatusBanner(null);
      setActivePanel({ kind: 'verify', customerId, driverId });
    },
    [canManageDrivers, customerId]
  );

  const handleRequestDeactivate = useCallback(
    (driverId: string) => {
      if (!canManageDrivers) {
        return;
      }
      setStatusBanner(null);
      setActivePanel({ kind: 'confirm_deactivate', customerId, driverId });
    },
    [canManageDrivers, customerId]
  );

  const handleClosePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const handleDriverCreated = useCallback(
    async (createdDriver: CustomerDriverClientItem) => {
      if (
        activeCustomerIdRef.current !== customerId ||
        createdDriver.customer_id !== customerId
      ) {
        return;
      }

      setActivePanel(null);
      setStatusBanner({
        customerId,
        message: addCopy.createSuccessBanner,
        tone: 'success',
      });
      await controllerRef.current?.retry();
    },
    [addCopy.createSuccessBanner, customerId]
  );

  const handleDriverUpdated = useCallback(
    async (
      updatedDriver: CustomerDriverClientItem,
      meta: { licenceMetadataChanged: boolean; wasVerified: boolean }
    ) => {
      if (
        activeCustomerIdRef.current !== customerId ||
        updatedDriver.customer_id !== customerId
      ) {
        return;
      }

      setActivePanel(null);
      const needsRenewedReview =
        meta.wasVerified &&
        (updatedDriver.verification_status !== 'verified' ||
          meta.licenceMetadataChanged);
      setStatusBanner({
        customerId,
        message: needsRenewedReview
          ? editCopy.updateSuccessVerifiedReviewBanner
          : editCopy.updateSuccessBanner,
        tone: needsRenewedReview ? 'warning' : 'success',
      });
      await controllerRef.current?.retry();
    },
    [
      customerId,
      editCopy.updateSuccessBanner,
      editCopy.updateSuccessVerifiedReviewBanner,
    ]
  );

  const handleDriverVerificationSaved = useCallback(
    async (updatedDriver: CustomerDriverClientItem) => {
      if (
        activeCustomerIdRef.current !== customerId ||
        updatedDriver.customer_id !== customerId
      ) {
        return;
      }

      setActivePanel(null);
      setStatusBanner({
        customerId,
        message: verifyCopy.updateSuccessBanner,
        tone: 'success',
      });
      await controllerRef.current?.retry();
    },
    [customerId, verifyCopy.updateSuccessBanner]
  );

  const handleToggleActive = useCallback(
    async (driver: CustomerDriverClientItem, nextIsActive: boolean) => {
      if (!canManageDrivers) {
        return;
      }
      if (!toggleGuardRef.current.tryAcquire()) {
        return;
      }

      const requestCustomerId = customerId;
      const abortController = new AbortController();
      toggleAbortRef.current = abortController;

      setTogglingTarget({ customerId: requestCustomerId, driverId: driver.id });
      setStatusBanner(null);

      try {
        const result = await submitToggleDriverActive(
          requestCustomerId,
          driver.id,
          driver,
          nextIsActive,
          { signal: abortController.signal }
        );

        if (
          !isMountedRef.current ||
          abortController.signal.aborted ||
          activeCustomerIdRef.current !== requestCustomerId
        ) {
          return;
        }

        if (!result.ok) {
          if (result.aborted) {
            return;
          }
          setStatusBanner({
            customerId: requestCustomerId,
            message: result.error,
            tone: 'error',
          });
          return;
        }

        setActivePanel(null);
        setStatusBanner({
          customerId: requestCustomerId,
          message: nextIsActive
            ? activationCopy.reactivatedSuccessBanner
            : activationCopy.deactivatedSuccessBanner,
          tone: 'success',
        });
        await controllerRef.current?.retry();
      } finally {
        if (toggleAbortRef.current === abortController) {
          toggleAbortRef.current = null;
        }
        toggleGuardRef.current.release();
        if (isMountedRef.current) {
          setTogglingTarget(null);
        }
      }
    },
    [
      activationCopy.deactivatedSuccessBanner,
      activationCopy.reactivatedSuccessBanner,
      canManageDrivers,
      customerId,
    ]
  );

  const isStaleCustomer = state.customerId !== customerId;
  const effectiveStatus = isStaleCustomer ? 'loading' : state.status;
  const drivers = isStaleCustomer ? [] : state.drivers;
  const isAddFormOpen =
    canManageDrivers &&
    activePanel?.kind === 'add' &&
    activePanel.customerId === customerId;
  const activeEditingDriverId =
    canManageDrivers &&
    activePanel?.kind === 'edit' &&
    activePanel.customerId === customerId
      ? activePanel.driverId
      : null;
  const activeVerifyingDriverId =
    canManageDrivers &&
    activePanel?.kind === 'verify' &&
    activePanel.customerId === customerId
      ? activePanel.driverId
      : null;
  const activeConfirmDeactivateDriverId =
    canManageDrivers &&
    activePanel?.kind === 'confirm_deactivate' &&
    activePanel.customerId === customerId
      ? activePanel.driverId
      : null;
  const activeTogglingDriverId =
    togglingTarget?.customerId === customerId ? togglingTarget.driverId : null;
  const visibleBanner =
    !isAddFormOpen &&
    activeEditingDriverId === null &&
    activeVerifyingDriverId === null &&
    statusBanner?.customerId === customerId
      ? statusBanner
      : null;

  const driverCountLabel =
    drivers.length === 1
      ? `1 ${driversCopy.driverCountSingular}`
      : `${drivers.length} ${driversCopy.driverCountPlural}`;

  return (
    <section
      className="py-5"
      aria-labelledby="customer-authorized-drivers-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users
            className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
            aria-hidden="true"
          />
          <h3
            id="customer-authorized-drivers-heading"
            className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400"
          >
            {driversCopy.sectionTitle}
          </h3>
          {effectiveStatus === 'ready' ? (
            <span className="inline-flex items-center rounded-md border border-slate-200/90 bg-slate-100/90 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-700 tabular-nums dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              {driverCountLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {canManageDrivers && !isAddFormOpen ? (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleOpenAddForm}
              className="min-h-9 sm:min-h-8"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{addCopy.addButtonLabel}</span>
            </Button>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleRefresh}
            disabled={effectiveStatus === 'loading'}
            aria-label={driversCopy.refreshAriaLabel}
            className="min-h-9 sm:min-h-8"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${
                effectiveStatus === 'loading' ? 'animate-spin' : ''
              }`}
              aria-hidden="true"
            />
            <span>{driversCopy.refreshLabel}</span>
          </Button>
        </div>
      </div>

      {visibleBanner ? (
        <AlertBanner
          variant={visibleBanner.tone}
          compact
          onDismiss={() => setStatusBanner(null)}
          dismissLabel={addCopy.dismissBannerLabel}
          className="mt-3"
        >
          {visibleBanner.message}
        </AlertBanner>
      ) : null}

      {isAddFormOpen ? (
        <AddDriverForm
          key={customerId}
          customerId={customerId}
          onCancel={handleClosePanel}
          onCreated={handleDriverCreated}
        />
      ) : null}

      {effectiveStatus === 'loading' ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={driversCopy.loadingAriaLabel}
          className="mt-3 space-y-3"
        >
          <p className="sr-only">{driversCopy.loadingLabel}</p>
          {[0, 1].map((item) => (
            <div
              key={item}
              className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Skeleton rounded="lg" className="h-8 w-8 shrink-0" />
                  <Skeleton className="h-4 w-36" />
                </div>
                <Skeleton className="h-5 w-24" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {effectiveStatus === 'error' ? (
        <AlertBanner
          variant="error"
          title={driversCopy.errorTitle}
          compact
          className="mt-3"
          action={
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleRefresh}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{driversCopy.retryLabel}</span>
            </Button>
          }
        >
          {state.error ?? driversCopy.errorTitle}
        </AlertBanner>
      ) : null}

      {effectiveStatus === 'ready' && drivers.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center dark:border-slate-800 dark:bg-slate-900/40">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-400 shadow-xs dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
            <Users className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-3 text-xs font-semibold text-slate-900 dark:text-slate-100">
            {driversCopy.emptyTitle}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {driversCopy.emptyDescription}
          </p>
        </div>
      ) : null}

      {effectiveStatus === 'ready' && drivers.length > 0 ? (
        <div className="mt-3 space-y-3">
          <ul aria-label={driversCopy.sectionTitle} className="space-y-3">
            {drivers.map((driver) => {
              const formattedExpiry = formatDriverExpiryDate(
                driver.licence_expires_on,
                locale
              );
              const expiryStatus = driver.eligibility.licenceExpiryStatus;
              const expiryValueClasses =
                expiryStatus === 'expired'
                  ? 'font-mono text-xs font-semibold text-red-700 tabular-nums dark:text-red-300'
                  : expiryStatus === 'expiring_soon'
                    ? 'font-mono text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-300'
                    : 'font-mono text-xs font-medium text-slate-900 tabular-nums dark:text-slate-100';

              const internalNotes =
                canManageDrivers &&
                typeof driver.verification_notes === 'string' &&
                driver.verification_notes.trim().length > 0
                  ? driver.verification_notes.trim()
                  : null;

              const isEditingThisDriver = activeEditingDriverId === driver.id;
              const isVerifyingThisDriver =
                activeVerifyingDriverId === driver.id;
              const isConfirmingDeactivate =
                activeConfirmDeactivateDriverId === driver.id;
              const isTogglingThisDriver = activeTogglingDriverId === driver.id;
              const isInlinePanelActive =
                isEditingThisDriver || isVerifyingThisDriver;

              return (
                <li
                  key={driver.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isInlinePanelActive
                      ? 'border-blue-300/80 bg-blue-50/35 shadow-xs dark:border-blue-900/70 dark:bg-blue-950/20'
                      : driver.is_active
                        ? 'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-slate-800 dark:bg-slate-900/70'
                        : 'border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/35'
                  }`}
                >
                  {isEditingThisDriver ? (
                    <EditDriverForm
                      key={`${customerId}:${driver.id}:edit`}
                      customerId={customerId}
                      driver={driver}
                      onCancel={handleClosePanel}
                      onSaved={handleDriverUpdated}
                    />
                  ) : isVerifyingThisDriver ? (
                    <DriverVerificationForm
                      key={`${customerId}:${driver.id}:verify`}
                      customerId={customerId}
                      driver={driver}
                      onCancel={handleClosePanel}
                      onSaved={handleDriverVerificationSaved}
                    />
                  ) : (
                    <>
                      {/* Driver Header: Monogram + Name + Active state & Operational Eligibility */}
                      <div className="flex flex-wrap items-start justify-between gap-2.5">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <span
                            aria-hidden="true"
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold ${
                              driver.is_active
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                                : 'bg-slate-200/70 text-slate-500 dark:bg-slate-800/70 dark:text-slate-400'
                            }`}
                          >
                            {getDriverInitials(driver.full_name)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p
                              className={`truncate text-sm font-semibold ${
                                driver.is_active
                                  ? 'text-slate-950 dark:text-slate-50'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {driver.full_name}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-medium">
                              <span
                                aria-hidden="true"
                                className={`h-1.5 w-1.5 rounded-full ${
                                  driver.is_active
                                    ? 'bg-emerald-500'
                                    : 'bg-slate-400 dark:bg-slate-500'
                                }`}
                              />
                              <span
                                className={
                                  driver.is_active
                                    ? 'text-emerald-700 dark:text-emerald-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }
                              >
                                {driver.is_active
                                  ? driversCopy.statusActive
                                  : driversCopy.statusInactive}
                              </span>
                            </p>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium ${getEligibilityBadgeClasses(
                            driver.eligibility.status
                          )}`}
                        >
                          <EligibilityIcon status={driver.eligibility.status} />
                          <span>
                            {
                              driversCopy.eligibilityStatuses[
                                driver.eligibility.status
                              ]
                            }
                          </span>
                        </span>
                      </div>

                      {/* Owner & Manager Management Controls (hidden from Agents) */}
                      {canManageDrivers ? (
                        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-y border-slate-100 py-2 dark:border-slate-800/80">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={isTogglingThisDriver}
                            onClick={() => handleOpenEditForm(driver.id)}
                            aria-label={`${editCopy.editButtonAriaPrefix} ${driver.full_name}`}
                            className="min-h-9 sm:min-h-8"
                          >
                            <Pencil
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{editCopy.editButtonLabel}</span>
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={isTogglingThisDriver}
                            onClick={() => handleOpenVerifyForm(driver.id)}
                            aria-label={`${verifyCopy.buttonAriaPrefix} ${driver.full_name}`}
                            className="min-h-9 sm:min-h-8"
                          >
                            <ShieldCheck
                              className="h-3.5 w-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span>{verifyCopy.buttonLabel}</span>
                          </Button>

                          {driver.is_active ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={
                                isTogglingThisDriver || isConfirmingDeactivate
                              }
                              onClick={() => handleRequestDeactivate(driver.id)}
                              aria-label={`${activationCopy.deactivateAriaPrefix} ${driver.full_name}`}
                              className="min-h-9 text-red-700 hover:bg-red-50 hover:text-red-800 sm:min-h-8 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            >
                              <UserX
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                              />
                              <span>{activationCopy.deactivateButtonLabel}</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              disabled={isTogglingThisDriver}
                              onClick={() =>
                                void handleToggleActive(driver, true)
                              }
                              aria-label={`${activationCopy.reactivateAriaPrefix} ${driver.full_name}`}
                              className="min-h-9 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 sm:min-h-8 dark:text-emerald-400 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300"
                            >
                              {isTogglingThisDriver ? (
                                <>
                                  <Loader2
                                    className="h-3.5 w-3.5 shrink-0 animate-spin"
                                    aria-hidden="true"
                                  />
                                  <span>{activationCopy.updatingLabel}</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck
                                    className="h-3.5 w-3.5 shrink-0"
                                    aria-hidden="true"
                                  />
                                  <span>
                                    {activationCopy.reactivateButtonLabel}
                                  </span>
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      ) : null}

                      {/* Explicit Deactivation Confirmation Panel (Owner/Manager only) */}
                      {isConfirmingDeactivate ? (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          role="alertdialog"
                          aria-labelledby={`confirm-deactivate-${driver.id}-title`}
                          aria-describedby={`confirm-deactivate-${driver.id}-body`}
                          className="mt-3 rounded-xl border border-red-200/90 bg-red-50/90 p-3.5 dark:border-red-900/60 dark:bg-red-950/35"
                        >
                          <p
                            id={`confirm-deactivate-${driver.id}-title`}
                            className="text-xs font-semibold text-red-950 dark:text-red-100"
                          >
                            {activationCopy.confirmDeactivateTitle}
                          </p>
                          <p
                            id={`confirm-deactivate-${driver.id}-body`}
                            className="mt-1 text-xs leading-relaxed text-red-800 dark:text-red-200"
                          >
                            {activationCopy.confirmDeactivateBody}
                          </p>
                          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={isTogglingThisDriver}
                              onClick={handleClosePanel}
                            >
                              {activationCopy.cancelLabel}
                            </Button>
                            <Button
                              type="button"
                              variant="danger"
                              size="sm"
                              disabled={isTogglingThisDriver}
                              onClick={() =>
                                void handleToggleActive(driver, false)
                              }
                            >
                              {isTogglingThisDriver ? (
                                <>
                                  <Loader2
                                    className="h-3.5 w-3.5 animate-spin"
                                    aria-hidden="true"
                                  />
                                  <span>{activationCopy.updatingLabel}</span>
                                </>
                              ) : (
                                <span>
                                  {activationCopy.confirmDeactivateButton}
                                </span>
                              )}
                            </Button>
                          </div>
                        </motion.div>
                      ) : null}

                      {/* Licence & Verification Metadata */}
                      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 rounded-xl bg-slate-50/75 p-3 sm:grid-cols-2 dark:bg-slate-950/45">
                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                            {driversCopy.issuingCountryLabel}
                          </dt>
                          <dd className="mt-0.5 text-xs font-medium text-slate-900 dark:text-slate-100">
                            {driver.licence_issuing_country ? (
                              getCustomerCountryLabel(
                                driver.licence_issuing_country
                              )
                            ) : (
                              <span className="font-normal text-slate-400 dark:text-slate-500">
                                {notProvided}
                              </span>
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                            {driversCopy.licenceCategoryLabel}
                          </dt>
                          <dd className="mt-0.5 text-xs text-slate-900 dark:text-slate-100">
                            {driver.licence_category ? (
                              <span
                                dir="ltr"
                                className="inline-block font-mono font-semibold"
                              >
                                {driver.licence_category}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                {notProvided}
                              </span>
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                            {driversCopy.licenceExpiresOnLabel}
                          </dt>
                          <dd className="mt-0.5">
                            {formattedExpiry ? (
                              <span dir="ltr" className={expiryValueClasses}>
                                {formattedExpiry}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-500">
                                {notProvided}
                              </span>
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-[11px] text-slate-500 dark:text-slate-400">
                            {driversCopy.verificationStatusLabel}
                          </dt>
                          <dd className="mt-0.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium ${getVerificationBadgeClasses(
                                driver.verification_status
                              )}`}
                            >
                              <VerificationIcon
                                status={driver.verification_status}
                              />
                              <span>
                                {
                                  driversCopy.verificationStatuses[
                                    driver.verification_status
                                  ]
                                }
                              </span>
                            </span>
                          </dd>
                        </div>
                      </dl>

                      {/* Operational Eligibility Warnings */}
                      {driver.eligibility.flags.length > 0 ? (
                        <div className="mt-3">
                          <p className="sr-only">{driversCopy.warningsLabel}</p>
                          <ul className="space-y-1.5">
                            {driver.eligibility.flags.map((flag) => (
                              <li
                                key={flag.code}
                                className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs leading-relaxed ${getFlagRowClasses(
                                  flag.severity
                                )}`}
                              >
                                <FlagSeverityIcon severity={flag.severity} />
                                <span>
                                  {driversCopy.flagMessages[flag.code] ??
                                    flag.message}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {/* Internal Verification Notes — strictly Owner/Manager only */}
                      {internalNotes ? (
                        <div className="mt-3 rounded-xl border border-slate-200/80 bg-slate-50/75 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/45">
                          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {driversCopy.verificationNotesLabel}
                          </p>
                          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                            {internalNotes}
                          </p>
                        </div>
                      ) : null}
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Explicit Operational Pre-Check Legal Disclaimer */}
          <div className="flex items-start gap-2 rounded-xl border border-slate-200/80 bg-slate-50/75 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
            <Info
              className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
              aria-hidden="true"
            />
            <p>{driversCopy.legalNotice}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
