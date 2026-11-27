'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { AlertBanner } from '@/components/ui/alert-banner';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Skeleton } from '@/components/ui/skeleton';
import { StatStrip } from '@/components/ui/stat-strip';
import { Surface } from '@/components/ui/surface';
import type { AgencyRecord, AgencyRole } from '@/lib/agency/types';
import { DEFAULT_TIMEZONE, type SupportedLocale } from '@/lib/currency';
import { fetchAgencyCustomersDirectory } from '@/lib/customers/client';
import {
  canManageCustomers,
  CUSTOMER_SORT_OPTIONS,
  DEFAULT_CUSTOMER_FILTERS,
  type CustomerFilterState,
  type CustomerRecord,
  type CustomerSortKey,
  type CustomerType,
} from '@/lib/customers/types';
import {
  computeCustomerSummary,
  filterAndSortCustomers,
} from '@/lib/customers/validation';
import { cn } from '@/lib/utils';
import { AddCustomerModal } from './add-customer-modal';
import { CustomerDetailDrawer } from './customer-detail-drawer';
import { CustomerTypeBadge } from './customer-type-badge';

export interface CustomersDirectoryProps {
  agency: AgencyRecord;
  role: AgencyRole;
  initialCustomers: CustomerRecord[];
  initialError: string | null;
}

const INTL_LOCALE_BY_SUPPORTED: Record<SupportedLocale, string> = {
  fr: 'fr-TN',
  en: 'en-GB',
  ar: 'ar-TN',
};

function formatCreatedDate(
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
      timeZone,
    }).format(parsed);
  } catch {
    return isoDate.slice(0, 10);
  }
}

function getCustomerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return (name.slice(0, 2) || 'CL').toUpperCase();
}

export function CustomersDirectory({
  agency,
  role,
  initialCustomers,
  initialError,
}: CustomersDirectoryProps) {
  const router = useRouter();
  const { dict, locale } = useAppPreferences();
  const copy = dict.customersDirectory;
  const agencyTimeZone = agency.timezone || DEFAULT_TIMEZONE;
  const canManage = canManageCustomers(role);

  const [customers, setCustomers] =
    useState<CustomerRecord[]>(initialCustomers);
  const [loadError, setLoadError] = useState<string | null>(initialError);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [filters, setFilters] = useState<CustomerFilterState>(
    DEFAULT_CUSTOMER_FILTERS
  );

  const summary = useMemo(
    () => computeCustomerSummary(customers),
    [customers]
  );

  const filteredCustomers = useMemo(
    () => filterAndSortCustomers(customers, filters),
    [customers, filters]
  );

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.customerType !== 'all' ||
    filters.sortBy !== 'newest';

  const typeFilterOptions: readonly {
    value: 'all' | CustomerType;
    label: string;
  }[] = useMemo(
    () => [
      { value: 'all', label: copy.typeFilters.all },
      { value: 'individual', label: copy.typeFilters.individual },
      { value: 'corporate', label: copy.typeFilters.corporate },
    ],
    [copy.typeFilters]
  );

  async function refreshCustomers() {
    setRefreshing(true);
    setLoadError(null);
    const result = await fetchAgencyCustomersDirectory(
      fetch,
      copy.loadErrorFallback,
      copy.networkError
    );

    if (!result.ok) {
      setLoadError(result.error);
      setRefreshing(false);
      return;
    }

    setCustomers(result.customers);
    setRefreshing(false);
  }

  function openAddModal() {
    setFeedbackBanner(null);
    setSelectedCustomerId(null);
    setIsAddModalOpen(true);
  }

  const openCustomerDetail = useCallback((customerId: string) => {
    setSelectedCustomerId(customerId);
  }, []);

  const closeCustomerDetail = useCallback(() => {
    setSelectedCustomerId(null);
  }, []);

  async function handleCustomerCreated() {
    setIsAddModalOpen(false);
    setFeedbackBanner(copy.createSuccessBanner);
    await refreshCustomers();
    router.refresh();
  }

  async function handleCustomerUpdated() {
    await refreshCustomers();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={copy.title}
        description={copy.description}
        meta={`${agency.name} · ${copy.roles[role]}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={refreshCustomers}
              disabled={refreshing}
              aria-label={copy.refreshAriaLabel}
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span>
                {refreshing ? copy.refreshingLabel : copy.refreshLabel}
              </span>
            </Button>
            {canManage ? (
              <Button variant="primary" onClick={openAddModal}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{copy.addButtonLabel}</span>
              </Button>
            ) : null}
          </div>
        }
      />

      {feedbackBanner ? (
        <AlertBanner
          variant="success"
          onDismiss={() => setFeedbackBanner(null)}
          dismissLabel={copy.dismissBannerLabel}
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
              onClick={refreshCustomers}
              disabled={refreshing}
            >
              {copy.retryLabel}
            </Button>
          }
        >
          {loadError}
        </AlertBanner>
      ) : null}

      <StatStrip
        items={[
          {
            id: 'total',
            label: copy.stats.totalLabel,
            value: String(summary.totalCount),
            note: copy.stats.totalNote,
            tone: 'brand',
          },
          {
            id: 'individual',
            label: copy.stats.individualLabel,
            value: String(summary.individualCount),
            note: copy.stats.individualNote,
          },
          {
            id: 'corporate',
            label: copy.stats.corporateLabel,
            value: String(summary.corporateCount),
            note: copy.stats.corporateNote,
          },
          {
            id: 'with-email',
            label: copy.stats.withEmailLabel,
            value: String(summary.withEmailCount),
            note: copy.stats.withEmailNote,
          },
        ]}
      />

      <Surface className="overflow-hidden" aria-busy={refreshing}>
        {/* Search, customer type filter & sort toolbar */}
        <div className="space-y-3 border-b border-slate-200/90 p-4 sm:px-5 dark:border-slate-800/90">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search
                className="pointer-events-none absolute top-1/2 start-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchAriaLabel}
                className="h-11 sm:h-10 w-full rounded-xl border border-slate-200/95 bg-white ps-10 pe-3.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-[border-color,box-shadow] focus:border-[#1D4ED8] focus:outline-none focus:ring-3 focus:ring-blue-600/15 dark:border-slate-700/90 dark:bg-slate-950/90 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                options={typeFilterOptions}
                value={filters.customerType}
                onChange={(nextType) =>
                  setFilters((prev) => ({ ...prev, customerType: nextType }))
                }
                ariaLabel={copy.typeFilterAriaLabel}
              />

              <select
                aria-label={copy.sortAriaLabel}
                value={filters.sortBy}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    sortBy: e.target.value as CustomerSortKey,
                  }))
                }
                className="h-10 rounded-xl border border-slate-200/95 bg-white px-3 text-xs font-medium text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-slate-300 focus:border-[#1D4ED8] focus:outline-none focus:ring-3 focus:ring-blue-600/15 dark:border-slate-700/90 dark:bg-slate-950/90 dark:text-slate-200 dark:hover:border-slate-600 dark:focus:border-blue-400 cursor-pointer"
              >
                {CUSTOMER_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {copy.sortPrefix} : {copy.sortOptions[opt.value]}
                  </option>
                ))}
              </select>

              {hasActiveFilters ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setFilters(DEFAULT_CUSTOMER_FILTERS)}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{copy.resetFiltersLabel}</span>
                </Button>
              ) : null}
            </div>
          </div>

          <div
            aria-live="polite"
            className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
          >
            <span className="font-mono text-[11px] font-medium tabular-nums">
              {filteredCustomers.length} / {customers.length}
            </span>
            {refreshing ? <span>{copy.loadingLabel}</span> : null}
          </div>
        </div>

        {/* Loading skeleton when refreshing an empty dataset */}
        {refreshing && customers.length === 0 ? (
          <div
            role="status"
            aria-label={copy.loadingLabel}
            className="divide-y divide-slate-200/80 dark:divide-slate-800/80"
          >
            {[0, 1, 2, 3].map((rowIndex) => (
              <div
                key={rowIndex}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton rounded="lg" className="h-9 w-9 shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <div className="hidden items-center gap-6 md:flex">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" aria-hidden="true" />}
            title={copy.emptyAgencyTitle}
            description={copy.emptyAgencyDescription}
            action={
              canManage ? (
                <Button variant="primary" onClick={openAddModal}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{copy.addFirstButtonLabel}</span>
                </Button>
              ) : undefined
            }
          />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" aria-hidden="true" />}
            title={copy.emptyFilterTitle}
            description={copy.emptyFilterDescription}
            action={
              <Button
                variant="secondary"
                onClick={() => setFilters(DEFAULT_CUSTOMER_FILTERS)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>{copy.resetFiltersLabel}</span>
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table
                aria-label={copy.tableAriaLabel}
                className="w-full border-collapse text-sm"
              >
                <thead>
                  <tr className="border-b border-slate-200/90 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-[0.04em] text-slate-500 dark:border-slate-800/90 dark:bg-slate-950/50 dark:text-slate-400">
                    <th scope="col" className="px-5 py-3 text-start">
                      {copy.columns.customer}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {copy.columns.type}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {copy.columns.phone}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {copy.columns.email}
                    </th>
                    <th scope="col" className="px-4 py-3 text-start">
                      {copy.columns.city}
                    </th>
                    <th scope="col" className="px-5 py-3 text-end">
                      {copy.columns.createdAt}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/80">
                  {filteredCustomers.map((customer) => {
                    const formattedDate = formatCreatedDate(
                      customer.created_at,
                      locale,
                      agencyTimeZone
                    );
                    const isSelected = selectedCustomerId === customer.id;
                    const initials = getCustomerInitials(customer.full_name);

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => openCustomerDetail(customer.id)}
                        className={cn(
                          'group cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/45',
                          isSelected && 'bg-blue-50/60 dark:bg-blue-950/35'
                        )}
                      >
                        <td className="px-5 py-3.5 align-middle">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className={cn(
                                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold transition-colors',
                                customer.customer_type === 'corporate'
                                  ? 'bg-blue-50 text-[#1D4ED8] ring-1 ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900/60'
                                  : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/70'
                              )}
                            >
                              {initials}
                            </span>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openCustomerDetail(customer.id);
                                }}
                                aria-label={`${copy.detailDrawer.openDetailAriaPrefix} ${customer.full_name}`}
                                className="rounded text-start font-semibold text-slate-950 transition-colors group-hover:text-[#1D4ED8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer dark:text-slate-100 dark:group-hover:text-blue-400 dark:focus-visible:ring-offset-slate-900"
                              >
                                {customer.full_name}
                              </button>
                              {customer.company_name ? (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                  <Building2
                                    className="h-3 w-3 shrink-0 opacity-70"
                                    aria-hidden="true"
                                  />
                                  <span className="truncate">
                                    {customer.company_name}
                                  </span>
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 align-middle">
                          <CustomerTypeBadge
                            customerType={customer.customer_type}
                            label={copy.typeBadges[customer.customer_type]}
                          />
                        </td>

                        <td className="px-4 py-3.5 align-middle font-mono text-xs text-slate-800 tabular-nums dark:text-slate-200">
                          <span dir="ltr" className="inline-block">
                            {customer.phone}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-middle text-xs text-slate-600 dark:text-slate-300">
                          {customer.email ? (
                            <span dir="ltr" className="inline-block break-all">
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3.5 align-middle text-xs text-slate-700 dark:text-slate-300">
                          {customer.city ? (
                            <span>
                              {customer.city}
                              {customer.country_code ? (
                                <span className="ms-1 text-slate-400 dark:text-slate-500">
                                  · {customer.country_code}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 align-middle text-end font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap dark:text-slate-400">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span>{formattedDate}</span>
                            <ChevronRight
                              className="h-4 w-4 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-[#1D4ED8] rtl:rotate-180 rtl:group-hover:-translate-x-0.5 dark:text-slate-500 dark:group-hover:text-blue-400"
                              aria-hidden="true"
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile touch-friendly customer cards */}
            <ul
              aria-label={copy.tableAriaLabel}
              className="divide-y divide-slate-200/80 md:hidden dark:divide-slate-800/80"
            >
              {filteredCustomers.map((customer) => {
                const formattedDate = formatCreatedDate(
                  customer.created_at,
                  locale,
                  agencyTimeZone
                );
                const isSelected = selectedCustomerId === customer.id;
                const initials = getCustomerInitials(customer.full_name);

                return (
                  <li
                    key={customer.id}
                    onClick={() => openCustomerDetail(customer.id)}
                    className={cn(
                      'cursor-pointer space-y-3 p-4 transition-colors active:bg-slate-100/80 dark:active:bg-slate-800/70',
                      isSelected && 'bg-blue-50/60 dark:bg-blue-950/35'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-xs font-bold',
                            customer.customer_type === 'corporate'
                              ? 'bg-blue-50 text-[#1D4ED8] ring-1 ring-blue-200/70 dark:bg-blue-950/60 dark:text-blue-300 dark:ring-blue-900/60'
                              : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700/70'
                          )}
                        >
                          {initials}
                        </span>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCustomerDetail(customer.id);
                            }}
                            aria-label={`${copy.detailDrawer.openDetailAriaPrefix} ${customer.full_name}`}
                            className="max-w-full truncate rounded text-start text-sm font-semibold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer dark:text-slate-100"
                          >
                            {customer.full_name}
                          </button>
                          {customer.company_name ? (
                            <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                              {customer.company_name}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <CustomerTypeBadge
                          customerType={customer.customer_type}
                          label={copy.typeBadges[customer.customer_type]}
                        />
                        <ChevronRight
                          className="h-4 w-4 text-slate-400 rtl:rotate-180 dark:text-slate-500"
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 rounded-xl bg-slate-50/80 px-3 py-2.5 text-xs dark:bg-slate-950/45">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 font-mono text-slate-900 tabular-nums dark:text-slate-100">
                          <Phone
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <span dir="ltr">{customer.phone}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <MapPin
                            className="h-3 w-3 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          <span>
                            {customer.city
                              ? `${customer.city}${customer.country_code ? ` · ${customer.country_code}` : ''}`
                              : copy.notProvided}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-0.5">
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-600 dark:text-slate-300">
                          <Mail
                            className="h-3.5 w-3.5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                          {customer.email ? (
                            <span dir="ltr" className="truncate">
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {copy.notProvided}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                          {formattedDate}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Surface>

      {isAddModalOpen ? (
        <AddCustomerModal
          open={isAddModalOpen}
          defaultCountryCode={agency.country_code}
          onClose={() => setIsAddModalOpen(false)}
          onCreated={handleCustomerCreated}
        />
      ) : null}

      <CustomerDetailDrawer
        customerId={selectedCustomerId}
        role={role}
        timeZone={agencyTimeZone}
        canEdit={canManage}
        onClose={closeCustomerDetail}
        onCustomerUpdated={handleCustomerUpdated}
      />
    </div>
  );
}
