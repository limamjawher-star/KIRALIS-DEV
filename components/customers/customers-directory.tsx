'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Users,
} from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
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
          <div className="flex flex-wrap items-center gap-2.5">
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
            className="text-xs font-medium underline underline-offset-2 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded cursor-pointer"
          >
            {copy.dismissBannerLabel}
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
            onClick={refreshCustomers}
            disabled={refreshing}
          >
            {copy.retryLabel}
          </Button>
        </div>
      ) : null}

      <StatStrip
        items={[
          {
            id: 'total',
            label: copy.stats.totalLabel,
            value: String(summary.totalCount),
            note: copy.stats.totalNote,
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
        <div className="space-y-3 border-b border-slate-200 p-4 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
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
                placeholder={copy.searchPlaceholder}
                aria-label={copy.searchAriaLabel}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white ps-9 pe-3 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-blue-400"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
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
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-blue-400"
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
            <span className="tabular-nums">
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
            className="divide-y divide-slate-200 dark:divide-slate-800"
          >
            {[0, 1, 2, 3].map((rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-2 gap-4 px-4 py-4 md:grid-cols-6"
              >
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="h-4 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                <div className="hidden h-4 w-28 animate-pulse rounded bg-slate-200 md:block dark:bg-slate-800" />
                <div className="hidden h-4 w-36 animate-pulse rounded bg-slate-200 md:block dark:bg-slate-800" />
                <div className="hidden h-4 w-20 animate-pulse rounded bg-slate-200 md:block dark:bg-slate-800" />
                <div className="hidden h-4 w-24 animate-pulse rounded bg-slate-200 md:ms-auto md:block dark:bg-slate-800" />
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
            {/* Desktop responsive table */}
            <div className="hidden overflow-x-auto md:block">
              <table
                aria-label={copy.tableAriaLabel}
                className="w-full border-collapse text-sm"
              >
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
                    <th scope="col" className="px-4 py-3 text-start">
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
                    <th scope="col" className="px-4 py-3 text-end">
                      {copy.columns.createdAt}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredCustomers.map((customer) => {
                    const formattedDate = formatCreatedDate(
                      customer.created_at,
                      locale,
                      agencyTimeZone
                    );
                    const isSelected = selectedCustomerId === customer.id;

                    return (
                      <tr
                        key={customer.id}
                        onClick={() => openCustomerDetail(customer.id)}
                        className={cn(
                          'cursor-pointer transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50',
                          isSelected && 'bg-blue-50/60 dark:bg-blue-950/30'
                        )}
                      >
                        <td className="px-4 py-3.5 align-top">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openCustomerDetail(customer.id);
                            }}
                            aria-label={`${copy.detailDrawer.openDetailAriaPrefix} ${customer.full_name}`}
                            className="rounded text-start font-medium text-slate-950 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer dark:text-slate-100 dark:hover:text-blue-400 dark:focus-visible:ring-offset-slate-900"
                          >
                            {customer.full_name}
                          </button>
                          {customer.company_name ? (
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {customer.company_name}
                            </p>
                          ) : null}
                        </td>

                        <td className="px-4 py-3.5 align-top">
                          <CustomerTypeBadge
                            customerType={customer.customer_type}
                            label={copy.typeBadges[customer.customer_type]}
                          />
                        </td>

                        <td className="px-4 py-3.5 align-top font-mono text-xs text-slate-800 tabular-nums dark:text-slate-200">
                          <span dir="ltr" className="inline-block">
                            {customer.phone}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 align-top text-xs text-slate-700 dark:text-slate-300">
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

                        <td className="px-4 py-3.5 align-top text-xs text-slate-700 dark:text-slate-300">
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

                        <td className="px-4 py-3.5 align-top text-end font-mono text-xs text-slate-600 tabular-nums whitespace-nowrap dark:text-slate-400">
                          <span className="inline-flex items-center justify-end gap-1.5">
                            <span>{formattedDate}</span>
                            <ChevronRight
                              className="h-3.5 w-3.5 text-slate-400 rtl:rotate-180 dark:text-slate-500"
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

            {/* Mobile stacked customer cards */}
            <ul
              aria-label={copy.tableAriaLabel}
              className="divide-y divide-slate-200 md:hidden dark:divide-slate-800"
            >
              {filteredCustomers.map((customer) => {
                const formattedDate = formatCreatedDate(
                  customer.created_at,
                  locale,
                  agencyTimeZone
                );
                const isSelected = selectedCustomerId === customer.id;

                return (
                  <li
                    key={customer.id}
                    onClick={() => openCustomerDetail(customer.id)}
                    className={cn(
                      'cursor-pointer space-y-3 p-4 transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/50',
                      isSelected && 'bg-blue-50/60 dark:bg-blue-950/30'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openCustomerDetail(customer.id);
                          }}
                          aria-label={`${copy.detailDrawer.openDetailAriaPrefix} ${customer.full_name}`}
                          className="max-w-full truncate rounded text-start text-sm font-semibold text-slate-950 transition-colors hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 cursor-pointer dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {customer.full_name}
                        </button>
                        {customer.company_name ? (
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {customer.company_name}
                          </p>
                        ) : null}
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

                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">
                          {copy.columns.phone}
                        </dt>
                        <dd className="mt-0.5 font-mono text-slate-900 tabular-nums dark:text-slate-100">
                          <span dir="ltr" className="inline-block">
                            {customer.phone}
                          </span>
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500 dark:text-slate-400">
                          {copy.columns.city}
                        </dt>
                        <dd className="mt-0.5 text-slate-900 dark:text-slate-100">
                          {customer.city
                            ? `${customer.city}${customer.country_code ? ` · ${customer.country_code}` : ''}`
                            : copy.notProvided}
                        </dd>
                      </div>

                      <div className="col-span-2">
                        <dt className="text-slate-500 dark:text-slate-400">
                          {copy.columns.email}
                        </dt>
                        <dd className="mt-0.5 break-all text-slate-900 dark:text-slate-100">
                          {customer.email ? (
                            <span dir="ltr" className="inline-block">
                              {customer.email}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">
                              {copy.notProvided}
                            </span>
                          )}
                        </dd>
                      </div>

                      <div className="col-span-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-800/80">
                        <dt className="text-slate-500 dark:text-slate-400">
                          {copy.columns.createdAt}
                        </dt>
                        <dd className="font-mono text-slate-600 tabular-nums dark:text-slate-400">
                          {formattedDate}
                        </dd>
                      </div>
                    </dl>
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
