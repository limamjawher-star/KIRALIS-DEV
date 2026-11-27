'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Pencil, RefreshCw, X } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { DEFAULT_TIMEZONE, type SupportedLocale } from '@/lib/currency';
import {
  createCustomerDetailController,
  INITIAL_CUSTOMER_DETAIL_STATE,
  type CustomerDetailViewState,
} from '@/lib/customers/client';
import {
  getCustomerCountryLabel,
  type CustomerRecord,
} from '@/lib/customers/types';
import type { AgencyRole } from '@/lib/supabase/database.types';
import { CustomerDriversSection } from './customer-drivers-section';
import { CustomerTypeBadge } from './customer-type-badge';
import { EditCustomerForm } from './edit-customer-form';

export interface CustomerDetailDrawerProps {
  customerId: string | null;
  role?: AgencyRole;
  timeZone?: string;
  canEdit?: boolean;
  onClose: () => void;
  onCustomerUpdated?: (customer: CustomerRecord) => Promise<void> | void;
}

const INTL_LOCALE_BY_SUPPORTED: Record<SupportedLocale, string> = {
  fr: 'fr-TN',
  en: 'en-GB',
  ar: 'ar-TN',
};

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function formatDetailTimestamp(
  isoDate: string,
  locale: SupportedLocale,
  timeZone: string
): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  try {
    return new Intl.DateTimeFormat(INTL_LOCALE_BY_SUPPORTED[locale], {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(parsed);
  } catch {
    return isoDate.slice(0, 16).replace('T', ' ');
  }
}

export function CustomerDetailDrawer({
  customerId,
  role = 'agent',
  timeZone = DEFAULT_TIMEZONE,
  canEdit = false,
  onClose,
  onCustomerUpdated,
}: CustomerDetailDrawerProps) {
  const { dict, locale } = useAppPreferences();
  const copy = dict.customersDirectory;
  const drawerCopy = copy.detailDrawer;
  const isOpen = customerId !== null;

  const [detailState, setDetailState] = useState<CustomerDetailViewState>(
    INITIAL_CUSTOMER_DETAIL_STATE
  );
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(
    null
  );
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [updatedBannerCustomerId, setUpdatedBannerCustomerId] = useState<
    string | null
  >(null);

  const controllerRef = useRef<ReturnType<
    typeof createCustomerDetailController
  > | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  const isEditing =
    isOpen && editingCustomerId !== null && editingCustomerId === customerId;
  const showUpdateSuccessBanner =
    isOpen &&
    !isEditing &&
    updatedBannerCustomerId !== null &&
    updatedBannerCustomerId === customerId;

  const isEditingRef = useRef(isEditing);
  const isSavingEditRef = useRef(isSavingEdit);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    isEditingRef.current = isEditing;
    isSavingEditRef.current = isSavingEdit;
  }, [isEditing, isSavingEdit]);

  const getController = useCallback(() => {
    if (!controllerRef.current) {
      controllerRef.current = createCustomerDetailController(fetch, (next) => {
        setDetailState(next);
      });
    }
    return controllerRef.current;
  }, []);

  // Load real customer details whenever customerId changes, cancelling any
  // superseded in-flight request so stale data never overwrites the panel.
  useEffect(() => {
    const controller = getController();
    if (!customerId) {
      controller.close();
      return;
    }

    void controller.selectCustomer(customerId);

    return () => {
      controller.close();
    };
  }, [customerId, getController]);

  // Manage body scroll lock, initial focus inside the dialog, and focus restoration.
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  // Escape-to-cancel/close and lightweight Tab focus trapping inside the dialog.
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (isSavingEditRef.current) {
          return;
        }
        event.preventDefault();
        if (isEditingRef.current) {
          setEditingCustomerId(null);
        } else {
          onCloseRef.current();
        }
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) {
        return;
      }

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey &&
        (active === first || !panelRef.current.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (isSavingEditRef.current) {
      return;
    }
    setEditingCustomerId(null);
    setUpdatedBannerCustomerId(null);
    onCloseRef.current();
  }, []);

  if (!isOpen) {
    return null;
  }

  // Prevent rendering even a single frame of a previously viewed customer while switching IDs.
  const isCurrentMatch = detailState.selectedCustomerId === customerId;
  const effectiveStatus = isCurrentMatch ? detailState.status : 'loading';
  const customer =
    isCurrentMatch && detailState.status === 'ready'
      ? detailState.customer
      : null;
  const errorMessage =
    isCurrentMatch && detailState.status === 'error' ? detailState.error : null;

  const titleId = 'customer-detail-drawer-title';
  const showCompanyRow =
    customer !== null &&
    (customer.customer_type === 'corporate' || Boolean(customer.company_name));

  function handleRetry() {
    void getController().retry();
  }

  function handleStartEdit() {
    if (!customer || !canEdit) {
      return;
    }
    setUpdatedBannerCustomerId(null);
    setEditingCustomerId(customer.id);
  }

  function handleCancelEdit() {
    if (isSavingEdit) {
      return;
    }
    setEditingCustomerId(null);
    window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });
  }

  async function handleEditSaved(updatedCustomer: CustomerRecord) {
    if (updatedCustomer.id !== customerId) {
      return;
    }
    getController().applyUpdatedCustomer(updatedCustomer);
    setIsSavingEdit(false);
    setEditingCustomerId(null);
    setUpdatedBannerCustomerId(updatedCustomer.id);
    await onCustomerUpdated?.(updatedCustomer);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/50 backdrop-blur-[2px] md:items-stretch"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSavingEdit) {
          handleClose();
        }
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={effectiveStatus === 'loading' || isSavingEdit}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl md:h-full md:max-h-none md:max-w-lg md:rounded-none md:border-s md:border-t-0 dark:border-slate-800 dark:bg-slate-900"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {drawerCopy.kicker}
            </p>
            {isEditing && customer ? (
              <div className="mt-1">
                <h2
                  id={titleId}
                  className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
                >
                  {drawerCopy.editTitle}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {drawerCopy.editSubtitle}
                </p>
              </div>
            ) : effectiveStatus === 'ready' && customer ? (
              <div className="mt-1.5 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2
                    id={titleId}
                    className="truncate text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50"
                  >
                    {customer.full_name}
                  </h2>
                  <CustomerTypeBadge
                    customerType={customer.customer_type}
                    label={copy.typeBadges[customer.customer_type]}
                  />
                </div>
                {customer.company_name ? (
                  <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                    {customer.company_name}
                  </p>
                ) : null}
              </div>
            ) : effectiveStatus === 'error' ? (
              <h2
                id={titleId}
                className="mt-1 text-base font-semibold tracking-tight text-slate-950 dark:text-slate-50"
              >
                {drawerCopy.errorTitle}
              </h2>
            ) : (
              <div className="mt-1.5 space-y-2">
                <h2 id={titleId} className="sr-only">
                  {drawerCopy.loadingTitle}
                </h2>
                <div className="h-6 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
              </div>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            disabled={isSavingEdit}
            aria-label={drawerCopy.closeAriaLabel}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Edit Mode or Read-Only View */}
        {isEditing && customer ? (
          <EditCustomerForm
            key={customer.id}
            customer={customer}
            onCancel={handleCancelEdit}
            onSaved={handleEditSaved}
            onSubmittingChange={setIsSavingEdit}
          />
        ) : (
          <>
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {showUpdateSuccessBanner ? (
                <div
                  role="status"
                  className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className="h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span>{drawerCopy.updateSuccessBanner}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUpdatedBannerCustomerId(null)}
                    className="rounded text-xs font-medium underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 cursor-pointer"
                  >
                    {copy.dismissBannerLabel}
                  </button>
                </div>
              ) : null}

              {effectiveStatus === 'loading' ? (
                <div
                  role="status"
                  aria-label={drawerCopy.loadingAriaLabel}
                  className="space-y-6"
                >
                  {[0, 1, 2, 3].map((sectionIndex) => (
                    <div
                      key={sectionIndex}
                      className="space-y-3 border-b border-slate-100 pb-5 last:border-b-0 dark:border-slate-800/80"
                    >
                      <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <div className="h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                          <div className="h-4 w-36 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                        </div>
                        <div className="space-y-1.5">
                          <div className="h-3 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
                          <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : effectiveStatus === 'error' ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="space-y-3">
                      <p className="leading-relaxed">
                        {errorMessage ?? drawerCopy.errorTitle}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={handleRetry}
                        >
                          <RefreshCw
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          <span>{drawerCopy.retryLabel}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : customer ? (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {/* Identity */}
                  <section className="pb-5">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {drawerCopy.sectionIdentity}
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.customerTypeLabel}
                        </dt>
                        <dd className="mt-1">
                          <CustomerTypeBadge
                            customerType={customer.customer_type}
                            label={copy.typeBadges[customer.customer_type]}
                          />
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.fullNameLabel}
                        </dt>
                        <dd className="mt-1 text-sm font-medium text-slate-950 dark:text-slate-100">
                          {customer.full_name}
                        </dd>
                      </div>

                      {showCompanyRow ? (
                        <div className="sm:col-span-2">
                          <dt className="text-xs text-slate-500 dark:text-slate-400">
                            {drawerCopy.companyNameLabel}
                          </dt>
                          <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                            {customer.company_name ? (
                              customer.company_name
                            ) : (
                              <span className="text-slate-400 dark:text-slate-500">
                                {copy.notProvided}
                              </span>
                            )}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  {/* Contact */}
                  <section className="py-5">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {drawerCopy.sectionContact}
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.phoneLabel}
                        </dt>
                        <dd className="mt-1 font-mono text-sm text-slate-950 tabular-nums dark:text-slate-100">
                          <span dir="ltr" className="inline-block">
                            {customer.phone}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.emailLabel}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                          {customer.email ? (
                            <span dir="ltr" className="inline-block break-all">
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {copy.notProvided}
                            </span>
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* Address & Country */}
                  <section className="py-5">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {drawerCopy.sectionAddress}
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.addressLabel}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                          {customer.address ? (
                            customer.address
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {copy.notProvided}
                            </span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.cityLabel}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                          {customer.city ? (
                            customer.city
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {copy.notProvided}
                            </span>
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.countryLabel}
                        </dt>
                        <dd className="mt-1 text-sm text-slate-900 dark:text-slate-100">
                          {getCustomerCountryLabel(customer.country_code)}
                        </dd>
                      </div>
                    </dl>
                  </section>

                  {/* Internal Notes */}
                  <section className="py-5">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {drawerCopy.sectionNotes}
                    </h3>
                    <div className="mt-2.5 text-sm leading-relaxed text-slate-900 dark:text-slate-100">
                      {customer.notes ? (
                        <p className="whitespace-pre-wrap break-words">
                          {customer.notes}
                        </p>
                      ) : (
                        <p className="text-slate-400 dark:text-slate-500">
                          {drawerCopy.noNotesLabel}
                        </p>
                      )}
                    </div>
                  </section>

                  {/* Authorized Drivers (Read-Only) */}
                  <CustomerDriversSection
                    customerId={customer.id}
                    role={role}
                  />

                  {/* Timestamps */}
                  <section className="pt-5">
                    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {drawerCopy.sectionTimestamps}
                    </h3>
                    <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.createdAtLabel}
                        </dt>
                        <dd className="mt-1 font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                          {formatDetailTimestamp(
                            customer.created_at,
                            locale,
                            timeZone
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-xs text-slate-500 dark:text-slate-400">
                          {drawerCopy.updatedAtLabel}
                        </dt>
                        <dd className="mt-1 font-mono text-xs text-slate-700 tabular-nums dark:text-slate-300">
                          {formatDetailTimestamp(
                            customer.updated_at,
                            locale,
                            timeZone
                          )}
                        </dd>
                      </div>
                    </dl>
                  </section>
                </div>
              ) : null}
            </div>

            {/* Read-Only Footer */}
            <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
              <Button variant="secondary" onClick={handleClose}>
                {drawerCopy.closeLabel}
              </Button>
              {canEdit && effectiveStatus === 'ready' && customer ? (
                <Button variant="primary" onClick={handleStartEdit}>
                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{drawerCopy.editButtonLabel}</span>
                </Button>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
