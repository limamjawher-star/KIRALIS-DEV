import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DICTIONARIES, SUPPORTED_LOCALES } from '@/lib/i18n/dictionaries';
import type { AgencyRole } from '@/lib/supabase/database.types';
import {
  createAgencyCustomerWithClient,
  CUSTOMER_SELECT_COLUMNS,
  getAgencyCustomerByIdWithClient,
  updateAgencyCustomerByIdWithClient,
} from './server';
import {
  buildCustomerPatchDiff,
  createCustomerDetailController,
  createSingleFlightGuard,
  fetchAgencyCustomerDetails,
  fetchAgencyCustomersDirectory,
  INITIAL_CUSTOMER_DETAIL_STATE,
  submitCreateCustomer,
  submitUpdateCustomer,
  type CustomerDetailViewState,
  type FetchLike,
} from './client';
import {
  canManageCustomers,
  createEmptyCustomerFormValues,
  customerRecordToFormValues,
  DEFAULT_CUSTOMER_FILTERS,
  type CustomerRecord,
} from './types';
import {
  computeCustomerSummary,
  filterAndSortCustomers,
  validateCustomerPatchPayload,
  validateCustomerPayload,
} from './validation';

const VALID_CUSTOMER_ID = '11111111-2222-4333-8444-555555555555';
const AGENCY_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENCY_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function makeMockSelectOneClient(records: CustomerRecord[], forcedError?: {
  code?: string;
  message?: string;
  details?: string;
}) {
  let queryCount = 0;
  let capturedTable = '';
  let capturedSelect = '';
  const filters: Record<string, string> = {};

  const client = {
    from(table: string) {
      queryCount += 1;
      capturedTable = table;
      return {
        select(columns: string) {
          capturedSelect = columns;
          const chain = {
            eq(column: string, value: string) {
              filters[column] = value;
              return chain;
            },
            async maybeSingle() {
              if (forcedError) {
                return { data: null, error: forcedError };
              }
              const match =
                records.find(
                  (row) =>
                    row.id === filters.id && row.agency_id === filters.agency_id
                ) ?? null;
              return { data: match, error: null };
            },
          };
          return chain;
        },
      };
    },
  } as unknown as Pick<SupabaseClient, 'from'>;

  return {
    client,
    getCaptured: () => ({ queryCount, capturedTable, capturedSelect, filters }),
  };
}

function makeMockUpdateClient(
  records: CustomerRecord[],
  forcedError?: {
    code?: string;
    message?: string;
    details?: string;
  }
) {
  let queryCount = 0;
  let capturedTable = '';
  let capturedUpdate: Record<string, unknown> | null = null;
  let capturedSelect = '';
  const filters: Record<string, string> = {};

  const client = {
    from(table: string) {
      queryCount += 1;
      capturedTable = table;
      return {
        update(payload: Record<string, unknown>) {
          capturedUpdate = payload;
          const chain = {
            eq(column: string, value: string) {
              filters[column] = value;
              return chain;
            },
            select(columns: string) {
              capturedSelect = columns;
              return {
                async maybeSingle() {
                  if (forcedError) {
                    return { data: null, error: forcedError };
                  }
                  const existing = records.find(
                    (row) =>
                      row.id === filters.id &&
                      row.agency_id === filters.agency_id
                  );
                  if (!existing) {
                    return { data: null, error: null };
                  }
                  const updated: CustomerRecord = {
                    ...existing,
                    ...(capturedUpdate as Partial<CustomerRecord>),
                    updated_at: '2026-11-26T12:00:00Z',
                  };
                  return { data: updated, error: null };
                },
              };
            },
          };
          return chain;
        },
      };
    },
  } as unknown as Pick<SupabaseClient, 'from'>;

  return {
    client,
    getCaptured: () => ({
      queryCount,
      capturedTable,
      capturedUpdate,
      capturedSelect,
      filters,
    }),
  };
}

function makeMockInsertClient(outcome: {
  data: CustomerRecord | null;
  error: { code?: string; message?: string; details?: string } | null;
}) {
  let capturedTable = '';
  let capturedInsert: Record<string, unknown> | null = null;
  let capturedSelect = '';

  const client = {
    from(table: string) {
      capturedTable = table;
      return {
        insert(payload: Record<string, unknown>) {
          capturedInsert = payload;
          return {
            select(columns: string) {
              capturedSelect = columns;
              return {
                async single() {
                  return outcome;
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Pick<SupabaseClient, 'from'>;

  return {
    client,
    getCaptured: () => ({ capturedTable, capturedInsert, capturedSelect }),
  };
}

test('validateCustomerPayload normalizes valid individual and corporate payloads and ignores client tenant fields', () => {
  const result = validateCustomerPayload({
    agency_id: '00000000-0000-0000-0000-000000000999',
    created_by: '00000000-0000-0000-0000-000000000888',
    customer_type: 'corporate',
    full_name: '  Sami   Ben  Ali  ',
    company_name: '  Atlas   Mobility  SARL ',
    email: '  CONTACT@AtlasMobility.TN  ',
    phone: '  +216   22  123   456  ',
    address: '  12 Avenue Habib Bourguiba  ',
    city: '  Tunis  ',
    country_code: 'tn',
    notes: '  Client entreprise synthétique  ',
  });

  assert.equal(result.valid, true);
  assert.ok(result.data);
  assert.equal(result.data.customer_type, 'corporate');
  assert.equal(result.data.full_name, 'Sami Ben Ali');
  assert.equal(result.data.company_name, 'Atlas Mobility SARL');
  assert.equal(result.data.email, 'contact@atlasmobility.tn');
  assert.equal(result.data.phone, '+216 22 123 456');
  assert.equal(result.data.country_code, 'TN');
  assert.equal('agency_id' in result.data, false);
  assert.equal('created_by' in result.data, false);
});

test('validateCustomerPayload rejects invalid fields with field-level errors', () => {
  const result = validateCustomerPayload({
    customer_type: 'vip',
    full_name: 'A',
    email: 'not-an-email',
    phone: '123',
    country_code: 'TUN',
  });

  assert.equal(result.valid, false);
  assert.ok(result.errors.customer_type);
  assert.ok(result.errors.full_name);
  assert.ok(result.errors.email);
  assert.ok(result.errors.phone);
  assert.ok(result.errors.country_code);
});

test('createAgencyCustomerWithClient binds server agency_id and created_by and returns 201 on success', async () => {
  const validation = validateCustomerPayload({
    customer_type: 'individual',
    full_name: 'Nadia Trabelsi',
    email: 'NADIA@EXAMPLE.TN',
    phone: '+216 55 000 111',
    country_code: 'TN',
  });
  assert.equal(validation.valid, true);
  assert.ok(validation.data);

  const createdRow: CustomerRecord = {
    id: 'cust-001',
    agency_id: 'agency-verified-1',
    customer_type: 'individual',
    full_name: 'Nadia Trabelsi',
    company_name: null,
    email: 'nadia@example.tn',
    phone: '+216 55 000 111',
    address: null,
    city: null,
    country_code: 'TN',
    notes: null,
    created_by: 'user-verified-1',
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
  };

  const { client, getCaptured } = makeMockInsertClient({
    data: createdRow,
    error: null,
  });

  const result = await createAgencyCustomerWithClient(client, {
    agencyId: 'agency-verified-1',
    createdByUserId: 'user-verified-1',
    payload: validation.data,
  });

  assert.equal(result.status, 201);
  assert.equal(result.error, null);
  assert.deepEqual(result.customer, createdRow);

  const captured = getCaptured();
  assert.equal(captured.capturedTable, 'customers');
  assert.equal(captured.capturedSelect, CUSTOMER_SELECT_COLUMNS);
  assert.equal(captured.capturedInsert?.agency_id, 'agency-verified-1');
  assert.equal(captured.capturedInsert?.created_by, 'user-verified-1');
  assert.equal(captured.capturedInsert?.email, 'nadia@example.tn');
});

test('createAgencyCustomerWithClient maps duplicate email (23505) to 409 and RLS denial (42501) to 403', async () => {
  const validation = validateCustomerPayload({
    customer_type: 'individual',
    full_name: 'Karim Gharbi',
    email: 'duplicate@example.tn',
    phone: '+216 20 111 222',
  });
  assert.ok(validation.data);

  const dupMock = makeMockInsertClient({
    data: null,
    error: {
      code: '23505',
      message: 'duplicate key value violates unique constraint "idx_customers_agency_email_unique"',
    },
  });
  const dupRes = await createAgencyCustomerWithClient(dupMock.client, {
    agencyId: 'agency-1',
    createdByUserId: 'user-1',
    payload: validation.data,
  });
  assert.equal(dupRes.status, 409);
  assert.equal(dupRes.customer, null);
  assert.ok(dupRes.fieldErrors?.email);

  const rlsMock = makeMockInsertClient({
    data: null,
    error: {
      code: '42501',
      message: 'new row violates row-level security policy for table "customers"',
    },
  });
  const rlsRes = await createAgencyCustomerWithClient(rlsMock.client, {
    agencyId: 'agency-1',
    createdByUserId: 'user-1',
    payload: validation.data,
  });
  assert.equal(rlsRes.status, 403);
  assert.equal(rlsRes.customer, null);
});

test('canManageCustomers matches existing RLS active agency roles (owner, manager, agent) and rejects unauthorized roles', () => {
  assert.equal(canManageCustomers('owner'), true);
  assert.equal(canManageCustomers('manager'), true);
  assert.equal(canManageCustomers('agent'), true);
  assert.equal(canManageCustomers('guest' as AgencyRole), false);
});

test('getAgencyCustomerByIdWithClient returns 200 for an authorized read within the active agency', async () => {
  const customerInAgencyA: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_A_ID,
    customer_type: 'individual',
    full_name: 'Youssef Mansour',
    company_name: null,
    email: 'youssef@example.tn',
    phone: '+216 22 999 000',
    address: '5 Rue de Marseille',
    city: 'Tunis',
    country_code: 'TN',
    notes: null,
    created_by: 'user-1',
    created_at: '2026-11-26T10:15:00Z',
    updated_at: '2026-11-26T10:15:00Z',
  };

  const { client, getCaptured } = makeMockSelectOneClient([customerInAgencyA]);
  const res = await getAgencyCustomerByIdWithClient(client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
  });

  assert.equal(res.status, 200);
  assert.equal(res.error, null);
  assert.deepEqual(res.customer, customerInAgencyA);

  const captured = getCaptured();
  assert.equal(captured.queryCount, 1);
  assert.equal(captured.capturedTable, 'customers');
  assert.equal(captured.capturedSelect, CUSTOMER_SELECT_COLUMNS);
  assert.equal(captured.filters.id, VALID_CUSTOMER_ID);
  assert.equal(captured.filters.agency_id, AGENCY_A_ID);
});

test('getAgencyCustomerByIdWithClient rejects invalid UUID with 400 without querying the database', async () => {
  const { client, getCaptured } = makeMockSelectOneClient([]);
  const res = await getAgencyCustomerByIdWithClient(client, {
    agencyId: AGENCY_A_ID,
    customerId: 'not-a-valid-uuid',
  });

  assert.equal(res.status, 400);
  assert.equal(res.customer, null);
  assert.ok(res.error);
  assert.equal(getCaptured().queryCount, 0);
});

test('getAgencyCustomerByIdWithClient returns 404 for missing customers and blocks cross-agency access', async () => {
  const customerInAgencyB: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_B_ID,
    customer_type: 'corporate',
    full_name: 'Amira Khelifi',
    company_name: 'Carthage Fleet',
    email: 'amira@example.tn',
    phone: '+216 29 123 456',
    address: null,
    city: 'Sousse',
    country_code: 'TN',
    notes: null,
    created_by: 'user-b',
    created_at: '2026-11-26T10:20:00Z',
    updated_at: '2026-11-26T10:20:00Z',
  };

  const missingMock = makeMockSelectOneClient([]);
  const missingRes = await getAgencyCustomerByIdWithClient(missingMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
  });
  assert.equal(missingRes.status, 404);
  assert.equal(missingRes.customer, null);

  const crossTenantMock = makeMockSelectOneClient([customerInAgencyB]);
  const crossRes = await getAgencyCustomerByIdWithClient(crossTenantMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
  });
  assert.equal(crossRes.status, 404);
  assert.equal(crossRes.customer, null);
  assert.equal(crossTenantMock.getCaptured().filters.agency_id, AGENCY_A_ID);
});

test('getAgencyCustomerByIdWithClient maps RLS 42501 to 403 and unexpected DB errors to safe 500', async () => {
  const rlsMock = makeMockSelectOneClient([], {
    code: '42501',
    message: 'permission denied for table customers',
  });
  const rlsRes = await getAgencyCustomerByIdWithClient(rlsMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
  });
  assert.equal(rlsRes.status, 403);
  assert.equal(rlsRes.customer, null);

  const dbErrMock = makeMockSelectOneClient([], {
    code: '08006',
    message: 'connection failure internal details',
  });
  const dbErrRes = await getAgencyCustomerByIdWithClient(dbErrMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
  });
  assert.equal(dbErrRes.status, 500);
  assert.equal(dbErrRes.customer, null);
  assert.equal(dbErrRes.error?.includes('connection failure'), false);
});

test('PATCH validation & updateAgencyCustomerByIdWithClient perform partial update while preserving omitted fields', async () => {
  const existingCustomer: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_A_ID,
    customer_type: 'corporate',
    full_name: 'Sami Ben Ali',
    company_name: 'Atlas Mobility SARL',
    email: 'contact@atlasmobility.tn',
    phone: '+216 22 123 456',
    address: '12 Avenue Habib Bourguiba',
    city: 'Tunis',
    country_code: 'TN',
    notes: 'Client régulier',
    created_by: 'user-1',
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
  };

  const patchValidation = validateCustomerPatchPayload({
    email: '  NOUVEAU@AtlasMobility.TN ',
    phone: ' +216   98  765  432 ',
  });
  assert.equal(patchValidation.valid, true);
  assert.deepEqual(patchValidation.data, {
    email: 'nouveau@atlasmobility.tn',
    phone: '+216 98 765 432',
  });

  const { client, getCaptured } = makeMockUpdateClient([existingCustomer]);
  const res = await updateAgencyCustomerByIdWithClient(client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
    patch: patchValidation.data!,
  });

  assert.equal(res.status, 200);
  assert.equal(res.error, null);
  assert.ok(res.customer);
  assert.equal(res.customer.email, 'nouveau@atlasmobility.tn');
  assert.equal(res.customer.phone, '+216 98 765 432');
  // Omitted fields must remain intact
  assert.equal(res.customer.full_name, 'Sami Ben Ali');
  assert.equal(res.customer.company_name, 'Atlas Mobility SARL');
  assert.equal(res.customer.notes, 'Client régulier');
  assert.equal(res.customer.agency_id, AGENCY_A_ID);

  const captured = getCaptured();
  assert.equal(captured.capturedTable, 'customers');
  assert.equal(captured.capturedSelect, CUSTOMER_SELECT_COLUMNS);
  assert.deepEqual(captured.capturedUpdate, {
    email: 'nouveau@atlasmobility.tn',
    phone: '+216 98 765 432',
  });
  assert.equal(captured.filters.id, VALID_CUSTOMER_ID);
  assert.equal(captured.filters.agency_id, AGENCY_A_ID);
});

test('validateCustomerPatchPayload rejects immutable and unknown fields and invalid field values', () => {
  for (const forbidden of [
    { id: VALID_CUSTOMER_ID, full_name: 'Test' },
    { agency_id: AGENCY_B_ID, full_name: 'Test' },
    { created_by: 'user-2', full_name: 'Test' },
    { created_at: '2026-01-01T00:00:00Z', full_name: 'Test' },
    { updated_at: '2026-01-01T00:00:00Z', full_name: 'Test' },
    { passport_number: 'TN12345', full_name: 'Test' },
    {},
  ]) {
    const res = validateCustomerPatchPayload(forbidden);
    assert.equal(res.valid, false);
    assert.ok(res.error);
  }

  const invalidFields = validateCustomerPatchPayload({
    customer_type: 'vip',
    full_name: 'A',
    email: 'bad-email',
    phone: '12',
    country_code: 'TUN',
  });
  assert.equal(invalidFields.valid, false);
  assert.ok(invalidFields.errors.customer_type);
  assert.ok(invalidFields.errors.full_name);
  assert.ok(invalidFields.errors.email);
  assert.ok(invalidFields.errors.phone);
  assert.ok(invalidFields.errors.country_code);
});

test('updateAgencyCustomerByIdWithClient rejects invalid UUID, blocks cross-agency updates with 404, and maps 23505/42501', async () => {
  const customerInAgencyB: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_B_ID,
    customer_type: 'individual',
    full_name: 'Amira Khelifi',
    company_name: null,
    email: 'amira@example.tn',
    phone: '+216 29 123 456',
    address: null,
    city: 'Sousse',
    country_code: 'TN',
    notes: null,
    created_by: 'user-b',
    created_at: '2026-11-26T10:20:00Z',
    updated_at: '2026-11-26T10:20:00Z',
  };

  // Invalid UUID -> 400 without querying DB
  const invalidUuidMock = makeMockUpdateClient([]);
  const invalidUuidRes = await updateAgencyCustomerByIdWithClient(
    invalidUuidMock.client,
    {
      agencyId: AGENCY_A_ID,
      customerId: 'bad-uuid',
      patch: { city: 'Sfax' },
    }
  );
  assert.equal(invalidUuidRes.status, 400);
  assert.equal(invalidUuidMock.getCaptured().queryCount, 0);

  // Cross-agency update -> 404 without exposing existence
  const crossAgencyMock = makeMockUpdateClient([customerInAgencyB]);
  const crossAgencyRes = await updateAgencyCustomerByIdWithClient(
    crossAgencyMock.client,
    {
      agencyId: AGENCY_A_ID,
      customerId: VALID_CUSTOMER_ID,
      patch: { city: 'Sfax' },
    }
  );
  assert.equal(crossAgencyRes.status, 404);
  assert.equal(crossAgencyRes.customer, null);
  assert.equal(crossAgencyMock.getCaptured().filters.agency_id, AGENCY_A_ID);

  // Duplicate normalized email conflict -> 409 with fieldErrors.email
  const dupMock = makeMockUpdateClient([], {
    code: '23505',
    message: 'duplicate key value violates unique constraint "idx_customers_agency_email_unique"',
  });
  const dupRes = await updateAgencyCustomerByIdWithClient(dupMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
    patch: { email: 'taken@example.tn' },
  });
  assert.equal(dupRes.status, 409);
  assert.ok(dupRes.fieldErrors?.email);

  // RLS / unauthorized role -> 403
  const rlsMock = makeMockUpdateClient([], {
    code: '42501',
    message: 'new row violates row-level security policy for table "customers"',
  });
  const rlsRes = await updateAgencyCustomerByIdWithClient(rlsMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: VALID_CUSTOMER_ID,
    patch: { city: 'Tunis' },
  });
  assert.equal(rlsRes.status, 403);
  assert.equal(rlsRes.customer, null);
});

test('filterAndSortCustomers searches by name, company, email, phone and filters/sorts accurately', () => {
  const rows: CustomerRecord[] = [
    {
      id: 'c1',
      agency_id: AGENCY_A_ID,
      customer_type: 'individual',
      full_name: 'Zied Bouazizi',
      company_name: null,
      email: 'zied@example.tn',
      phone: '+216 22 100 200',
      address: null,
      city: 'Tunis',
      country_code: 'TN',
      notes: null,
      created_by: 'u1',
      created_at: '2026-11-20T09:00:00Z',
      updated_at: '2026-11-20T09:00:00Z',
    },
    {
      id: 'c2',
      agency_id: AGENCY_A_ID,
      customer_type: 'corporate',
      full_name: 'Amine Ben Salem',
      company_name: 'Carthage Logistics SARL',
      email: 'fleet@carthagelogistics.tn',
      phone: '+216 98 444 555',
      address: null,
      city: 'Sousse',
      country_code: 'TN',
      notes: null,
      created_by: 'u1',
      created_at: '2026-11-25T15:00:00Z',
      updated_at: '2026-11-25T15:00:00Z',
    },
    {
      id: 'c3',
      agency_id: AGENCY_A_ID,
      customer_type: 'individual',
      full_name: 'Meriem Chaabane',
      company_name: null,
      email: null,
      phone: '+216 55 777 888',
      address: null,
      city: 'Sfax',
      country_code: 'TN',
      notes: null,
      created_by: 'u1',
      created_at: '2026-11-22T12:00:00Z',
      updated_at: '2026-11-22T12:00:00Z',
    },
  ];

  assert.deepEqual(
    filterAndSortCustomers(rows, DEFAULT_CUSTOMER_FILTERS).map((c) => c.id),
    ['c2', 'c3', 'c1']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, sortBy: 'oldest' }).map((c) => c.id),
    ['c1', 'c3', 'c2']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, sortBy: 'name_asc' }).map((c) => c.id),
    ['c2', 'c3', 'c1']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, sortBy: 'name_desc' }).map((c) => c.id),
    ['c1', 'c3', 'c2']
  );

  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, customerType: 'corporate' }).map((c) => c.id),
    ['c2']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, customerType: 'individual' }).map((c) => c.id),
    ['c3', 'c1']
  );

  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, search: 'bouazizi' }).map((c) => c.id),
    ['c1']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, search: 'logistics' }).map((c) => c.id),
    ['c2']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, search: 'fleet@carthage' }).map((c) => c.id),
    ['c2']
  );
  assert.deepEqual(
    filterAndSortCustomers(rows, { ...DEFAULT_CUSTOMER_FILTERS, search: '55 777' }).map((c) => c.id),
    ['c3']
  );
});

test('computeCustomerSummary returns exact counts including honest zeros on empty list', () => {
  assert.deepEqual(computeCustomerSummary([]), {
    totalCount: 0,
    individualCount: 0,
    corporateCount: 0,
    withEmailCount: 0,
  });

  const summary = computeCustomerSummary([
    {
      id: 'c1',
      agency_id: AGENCY_A_ID,
      customer_type: 'individual',
      full_name: 'Client 1',
      company_name: null,
      email: 'c1@example.tn',
      phone: '+216 22 000 001',
      address: null,
      city: null,
      country_code: 'TN',
      notes: null,
      created_by: 'u1',
      created_at: '2026-11-20T09:00:00Z',
      updated_at: '2026-11-20T09:00:00Z',
    },
    {
      id: 'c2',
      agency_id: AGENCY_A_ID,
      customer_type: 'corporate',
      full_name: 'Client 2',
      company_name: 'Société Test',
      email: null,
      phone: '+216 22 000 002',
      address: null,
      city: null,
      country_code: 'TN',
      notes: null,
      created_by: 'u1',
      created_at: '2026-11-21T09:00:00Z',
      updated_at: '2026-11-21T09:00:00Z',
    },
  ]);

  assert.deepEqual(summary, {
    totalCount: 2,
    individualCount: 1,
    corporateCount: 1,
    withEmailCount: 1,
  });
});

test('customersDirectory translations are defined across FR, EN, and AR dictionaries', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const dirCopy = DICTIONARIES[locale].customersDirectory;
    assert.ok(dirCopy.title.length > 0);
    assert.ok(dirCopy.searchPlaceholder.length > 0);
    assert.ok(dirCopy.typeBadges.individual.length > 0);
    assert.ok(dirCopy.typeBadges.corporate.length > 0);
    assert.ok(dirCopy.emptyAgencyTitle.length > 0);
    assert.ok(dirCopy.addButtonLabel.length > 0);
    assert.ok(dirCopy.addFirstButtonLabel.length > 0);
    assert.ok(dirCopy.createSuccessBanner.length > 0);
    assert.ok(dirCopy.addModal.title.length > 0);
    assert.ok(dirCopy.addModal.submitLabel.length > 0);
    assert.ok(dirCopy.addModal.fullNameLabel.length > 0);
    assert.ok(dirCopy.addModal.companyNameLabel.length > 0);
    assert.ok(dirCopy.addModal.phoneLabel.length > 0);
    assert.ok(dirCopy.addModal.emailLabel.length > 0);
    assert.ok(dirCopy.addModal.countryLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.kicker.length > 0);
    assert.ok(dirCopy.detailDrawer.closeLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.retryLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.createdAtLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.updatedAtLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.noNotesLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.editButtonLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.editTitle.length > 0);
    assert.ok(dirCopy.detailDrawer.saveLabel.length > 0);
    assert.ok(dirCopy.detailDrawer.updateSuccessBanner.length > 0);
  }
});

test('submitCreateCustomer submits valid normalized payload without client-controlled agency_id or created_by', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const createdCustomer: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_A_ID,
    customer_type: 'individual',
    full_name: 'Nadia Trabelsi',
    company_name: null,
    email: 'nadia.trabelsi@example.tn',
    phone: '+216 22 456 789',
    address: '14 Rue de Marseille',
    city: 'Tunis',
    country_code: 'TN',
    notes: 'Client fidèle',
    created_by: 'user-1',
    created_at: '2026-11-26T10:00:00Z',
    updated_at: '2026-11-26T10:00:00Z',
  };

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(
      JSON.stringify({ ok: true, customer: createdCustomer }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const formValues = {
    ...createEmptyCustomerFormValues('TN'),
    customer_type: 'individual' as const,
    full_name: '  Nadia   Trabelsi  ',
    company_name: 'Ignorée pour particulier',
    email: '  Nadia.Trabelsi@Example.TN ',
    phone: '+216 22 456 789',
    address: '14 Rue de Marseille',
    city: 'Tunis',
    country_code: 'tn',
    notes: 'Client fidèle',
  };

  const result = await submitCreateCustomer(formValues, mockFetch);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, 201);
    assert.equal(result.customer.id, VALID_CUSTOMER_ID);
  }
  assert.equal(capturedUrl, '/api/customers');
  assert.equal(capturedInit?.method, 'POST');
  assert.equal(capturedInit?.cache, 'no-store');

  const sentBody = JSON.parse(String(capturedInit?.body)) as Record<
    string,
    unknown
  >;
  assert.equal(sentBody.customer_type, 'individual');
  assert.equal(sentBody.full_name, 'Nadia Trabelsi');
  assert.equal(sentBody.company_name, null);
  assert.equal(sentBody.email, 'nadia.trabelsi@example.tn');
  assert.equal(sentBody.phone, '+216 22 456 789');
  assert.equal(sentBody.country_code, 'TN');
  assert.equal('agency_id' in sentBody, false);
  assert.equal('created_by' in sentBody, false);
});

test('submitCreateCustomer rejects missing required fields without calling the API', async () => {
  let fetchCalled = false;
  const mockFetch: FetchLike = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 201 });
  };

  const result = await submitCreateCustomer(
    createEmptyCustomerFormValues('TN'),
    mockFetch
  );

  assert.equal(fetchCalled, false);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.ok(result.fieldErrors?.full_name);
    assert.ok(result.fieldErrors?.phone);
  }
});

test('submitCreateCustomer preserves corporate company_name and strips it for individual customers', async () => {
  const sentPayloads: Record<string, unknown>[] = [];
  const mockFetch: FetchLike = async (_input, init) => {
    const parsed = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sentPayloads.push(parsed);
    return new Response(
      JSON.stringify({
        ok: true,
        customer: {
          id: VALID_CUSTOMER_ID,
          agency_id: AGENCY_A_ID,
          customer_type: parsed.customer_type,
          full_name: parsed.full_name,
          company_name: parsed.company_name,
          email: parsed.email,
          phone: parsed.phone,
          address: parsed.address,
          city: parsed.city,
          country_code: parsed.country_code,
          notes: parsed.notes,
          created_by: 'user-1',
          created_at: '2026-11-26T10:00:00Z',
          updated_at: '2026-11-26T10:00:00Z',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const corporateResult = await submitCreateCustomer(
    {
      ...createEmptyCustomerFormValues('TN'),
      customer_type: 'corporate',
      full_name: 'Karim Mansour',
      company_name: '  Carthage Logistique SARL  ',
      phone: '+216 71 234 567',
      email: 'contact@carthage-logistique.tn',
      city: 'Sfax',
    },
    mockFetch
  );

  const individualResult = await submitCreateCustomer(
    {
      ...createEmptyCustomerFormValues('TN'),
      customer_type: 'individual',
      full_name: 'Salma Ben Ali',
      company_name: 'Should Be Stripped',
      phone: '+216 98 111 222',
    },
    mockFetch
  );

  assert.equal(corporateResult.ok, true);
  assert.equal(individualResult.ok, true);
  assert.equal(sentPayloads.length, 2);
  assert.equal(sentPayloads[0].customer_type, 'corporate');
  assert.equal(sentPayloads[0].company_name, 'Carthage Logistique SARL');
  assert.equal(sentPayloads[1].customer_type, 'individual');
  assert.equal(sentPayloads[1].company_name, null);
});

test('submitCreateCustomer surfaces clear French duplicate-email error on HTTP 409', async () => {
  const mockFetch: FetchLike = async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error:
          'Un client avec cette adresse e-mail existe déjà dans votre agence.',
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } }
    );

  const result = await submitCreateCustomer(
    {
      ...createEmptyCustomerFormValues('TN'),
      full_name: 'Amine Gharbi',
      phone: '+216 55 321 654',
      email: 'duplicate@example.tn',
    },
    mockFetch
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.match(result.error, /e-mail/i);
    assert.ok(result.fieldErrors?.email);
  }
});

test('createSingleFlightGuard prevents concurrent duplicate customer submissions', async () => {
  const guard = createSingleFlightGuard();
  let fetchCount = 0;
  let resolveRequest: ((response: Response) => void) | undefined;

  const mockFetch: FetchLike = () => {
    fetchCount += 1;
    return new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
  };

  const values = {
    ...createEmptyCustomerFormValues('TN'),
    full_name: 'Youssef Khelifi',
    phone: '+216 20 888 999',
  };

  const firstAttempt = guard.run(() => submitCreateCustomer(values, mockFetch));
  assert.equal(guard.isRunning(), true);

  const secondAttempt = await guard.run(() =>
    submitCreateCustomer(values, mockFetch)
  );
  assert.equal(secondAttempt, null);
  assert.equal(fetchCount, 1);

  resolveRequest?.(
    new Response(
      JSON.stringify({
        ok: true,
        customer: {
          id: VALID_CUSTOMER_ID,
          agency_id: AGENCY_A_ID,
          customer_type: 'individual',
          full_name: 'Youssef Khelifi',
          company_name: null,
          email: null,
          phone: '+216 20 888 999',
          address: null,
          city: null,
          country_code: 'TN',
          notes: null,
          created_by: 'user-1',
          created_at: '2026-11-26T10:00:00Z',
          updated_at: '2026-11-26T10:00:00Z',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  );

  const firstResult = await firstAttempt;
  assert.equal(firstResult?.ok, true);
  assert.equal(guard.isRunning(), false);
});

test('fetchAgencyCustomersDirectory refreshes real directory records after creation', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const refreshedCustomers: CustomerRecord[] = [
    {
      id: VALID_CUSTOMER_ID,
      agency_id: AGENCY_A_ID,
      customer_type: 'corporate',
      full_name: 'Ines Bouazizi',
      company_name: 'Medina Mobility',
      email: 'ines@medinamobility.tn',
      phone: '+216 29 100 200',
      address: 'Avenue Habib Bourguiba',
      city: 'Sousse',
      country_code: 'TN',
      notes: null,
      created_by: 'user-1',
      created_at: '2026-11-26T10:05:00Z',
      updated_at: '2026-11-26T10:05:00Z',
    },
  ];

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(
      JSON.stringify({ ok: true, customers: refreshedCustomers }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const result = await fetchAgencyCustomersDirectory(mockFetch);

  assert.equal(capturedUrl, '/api/customers');
  assert.equal(capturedInit?.method, 'GET');
  assert.equal(capturedInit?.cache, 'no-store');
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.customers.length, 1);
    assert.equal(result.customers[0].id, VALID_CUSTOMER_ID);
    assert.equal(result.customers[0].company_name, 'Medina Mobility');
  }
});

test('submitCreateCustomer handles unauthorized 401 and forbidden 403 responses without fake success', async () => {
  const validValues = {
    ...createEmptyCustomerFormValues('TN'),
    full_name: 'Mehdi Chaabane',
    phone: '+216 50 444 333',
  };

  const unauthorizedResult = await submitCreateCustomer(validValues, async () =>
    new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  );

  assert.equal(unauthorizedResult.ok, false);
  if (!unauthorizedResult.ok) {
    assert.equal(unauthorizedResult.status, 401);
    assert.match(unauthorizedResult.error, /session/i);
  }

  const forbiddenResult = await submitCreateCustomer(validValues, async () =>
    new Response(
      JSON.stringify({
        ok: false,
        error: 'Vous ne disposez pas des autorisations nécessaires.',
      }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  );

  assert.equal(forbiddenResult.ok, false);
  if (!forbiddenResult.ok) {
    assert.equal(forbiddenResult.status, 403);
    assert.match(forbiddenResult.error, /autorisations/i);
  }
});

const SECOND_CUSTOMER_ID = '22222222-3333-4444-8555-666666666666';

test('selecting a customer loads full real details from GET /api/customers/[id] with no-store', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const snapshots: CustomerDetailViewState[] = [];

  const detailRecord: CustomerRecord = {
    id: VALID_CUSTOMER_ID,
    agency_id: AGENCY_A_ID,
    customer_type: 'corporate',
    full_name: 'Hichem Jaziri',
    company_name: 'Maghreb Services SARL',
    email: 'hichem@maghreb-services.tn',
    phone: '+216 71 800 900',
    address: '25 Rue du Lac Léman',
    city: 'Tunis',
    country_code: 'TN',
    notes: 'Facturation mensuelle par virement',
    created_by: 'user-1',
    created_at: '2026-11-18T08:30:00Z',
    updated_at: '2026-11-25T15:45:00Z',
  };

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(
      JSON.stringify({ ok: true, customer: detailRecord }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const controller = createCustomerDetailController(mockFetch, (next) => {
    snapshots.push(next);
  });

  const finalState = await controller.selectCustomer(VALID_CUSTOMER_ID);

  assert.equal(capturedUrl, `/api/customers/${VALID_CUSTOMER_ID}`);
  assert.equal(capturedInit?.method, 'GET');
  assert.equal(capturedInit?.cache, 'no-store');
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[0].status, 'loading');
  assert.equal(snapshots[0].selectedCustomerId, VALID_CUSTOMER_ID);
  assert.equal(snapshots[0].customer, null);

  assert.equal(finalState.status, 'ready');
  assert.equal(finalState.customer?.id, VALID_CUSTOMER_ID);
  assert.equal(finalState.customer?.company_name, 'Maghreb Services SARL');
  assert.equal(finalState.customer?.notes, 'Facturation mensuelle par virement');
  assert.equal(finalState.customer?.updated_at, '2026-11-25T15:45:00Z');
});

test('fetchAgencyCustomerDetails rejects invalid UUID and handles 401, 403, 404, and 500 safely', async () => {
  let fetchCalled = false;
  const invalidResult = await fetchAgencyCustomerDetails('not-a-uuid', async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  });
  assert.equal(fetchCalled, false);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.status, 400);
  }

  for (const status of [401, 403, 404, 500] as const) {
    const controller = createCustomerDetailController(async () =>
      new Response(JSON.stringify({ ok: false }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const state = await controller.selectCustomer(VALID_CUSTOMER_ID);
    assert.equal(state.status, 'error');
    assert.equal(state.customer, null);
    assert.equal(state.errorStatus, status);
    assert.ok(state.error && state.error.length > 0);
  }
});

test('switching between customers cancels previous fetch and prevents stale data from overwriting the drawer', async () => {
  const signals: Array<AbortSignal | null | undefined> = [];
  let resolveFirst: ((response: Response) => void) | undefined;
  let resolveSecond: ((response: Response) => void) | undefined;
  const snapshots: CustomerDetailViewState[] = [];

  const mockFetch: FetchLike = (input, init) => {
    signals.push(init?.signal);
    return new Promise<Response>((resolve) => {
      if (input.includes(VALID_CUSTOMER_ID)) {
        resolveFirst = resolve;
      } else {
        resolveSecond = resolve;
      }
    });
  };

  const controller = createCustomerDetailController(mockFetch, (next) => {
    snapshots.push(next);
  });

  const firstPromise = controller.selectCustomer(VALID_CUSTOMER_ID);
  assert.equal(controller.getState().status, 'loading');
  assert.equal(controller.getState().selectedCustomerId, VALID_CUSTOMER_ID);

  // Switch immediately to second customer while first request is still pending
  const secondPromise = controller.selectCustomer(SECOND_CUSTOMER_ID);
  assert.equal(signals[0]?.aborted, true);
  assert.equal(controller.getState().selectedCustomerId, SECOND_CUSTOMER_ID);
  assert.equal(controller.getState().customer, null);
  assert.equal(controller.getState().status, 'loading');

  // Second customer resolves first
  resolveSecond?.(
    new Response(
      JSON.stringify({
        ok: true,
        customer: {
          id: SECOND_CUSTOMER_ID,
          agency_id: AGENCY_A_ID,
          customer_type: 'individual',
          full_name: 'Sonia Ben Youssef',
          company_name: null,
          email: 'sonia@example.tn',
          phone: '+216 25 123 456',
          address: '8 Rue de Rome',
          city: 'Sousse',
          country_code: 'TN',
          notes: null,
          created_by: 'user-1',
          created_at: '2026-11-22T09:00:00Z',
          updated_at: '2026-11-22T09:00:00Z',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
  await secondPromise;

  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().customer?.id, SECOND_CUSTOMER_ID);
  assert.equal(controller.getState().customer?.full_name, 'Sonia Ben Youssef');

  // Stale response from first customer arrives late — must be completely ignored
  resolveFirst?.(
    new Response(
      JSON.stringify({
        ok: true,
        customer: {
          id: VALID_CUSTOMER_ID,
          agency_id: AGENCY_A_ID,
          customer_type: 'individual',
          full_name: 'Ancien Client Stale',
          company_name: null,
          email: null,
          phone: '+216 20 000 000',
          address: null,
          city: null,
          country_code: 'TN',
          notes: null,
          created_by: 'user-1',
          created_at: '2026-11-10T09:00:00Z',
          updated_at: '2026-11-10T09:00:00Z',
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
  await firstPromise;

  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().selectedCustomerId, SECOND_CUSTOMER_ID);
  assert.equal(controller.getState().customer?.id, SECOND_CUSTOMER_ID);
  assert.equal(controller.getState().customer?.full_name, 'Sonia Ben Youssef');
  assert.equal(
    snapshots.some((snap) => snap.customer?.id === VALID_CUSTOMER_ID),
    false
  );
});

test('closing the customer details drawer aborts in-flight requests, clears state, and preserves directory filtering', async () => {
  let capturedSignal: AbortSignal | null | undefined;
  let resolveSlowFetch: ((response: Response) => void) | undefined;

  const controller = createCustomerDetailController((_input, init) => {
    capturedSignal = init?.signal;
    return new Promise<Response>((resolve) => {
      resolveSlowFetch = resolve;
    });
  });

  const directoryRecords: CustomerRecord[] = [
    {
      id: VALID_CUSTOMER_ID,
      agency_id: AGENCY_A_ID,
      customer_type: 'corporate',
      full_name: 'Hichem Jaziri',
      company_name: 'Maghreb Services',
      email: 'hichem@maghreb.tn',
      phone: '+216 71 800 900',
      address: null,
      city: 'Tunis',
      country_code: 'TN',
      notes: null,
      created_by: 'user-1',
      created_at: '2026-11-20T09:00:00Z',
      updated_at: '2026-11-20T09:00:00Z',
    },
    {
      id: SECOND_CUSTOMER_ID,
      agency_id: AGENCY_A_ID,
      customer_type: 'individual',
      full_name: 'Sonia Ben Youssef',
      company_name: null,
      email: null,
      phone: '+216 25 123 456',
      address: null,
      city: 'Sousse',
      country_code: 'TN',
      notes: null,
      created_by: 'user-1',
      created_at: '2026-11-22T09:00:00Z',
      updated_at: '2026-11-22T09:00:00Z',
    },
  ];
  const activeFilters = {
    search: 'maghreb',
    customerType: 'corporate' as const,
    sortBy: 'name_asc' as const,
  };
  const filteredBefore = filterAndSortCustomers(directoryRecords, activeFilters);

  const pendingRequest = controller.selectCustomer(VALID_CUSTOMER_ID);
  assert.equal(controller.getState().status, 'loading');

  const closedState = controller.close();
  assert.equal(capturedSignal?.aborted, true);
  assert.deepEqual(closedState, INITIAL_CUSTOMER_DETAIL_STATE);

  // Even if the cancelled request later resolves, state stays cleanly closed
  resolveSlowFetch?.(
    new Response(
      JSON.stringify({ ok: true, customer: directoryRecords[0] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );
  await pendingRequest;

  assert.deepEqual(controller.getState(), INITIAL_CUSTOMER_DETAIL_STATE);

  // Directory filters and results remain untouched
  const filteredAfter = filterAndSortCustomers(directoryRecords, activeFilters);
  assert.deepEqual(filteredAfter, filteredBefore);
  assert.equal(filteredAfter.length, 1);
  assert.equal(filteredAfter[0].id, VALID_CUSTOMER_ID);
});

const BASE_EDIT_CUSTOMER: CustomerRecord = {
  id: VALID_CUSTOMER_ID,
  agency_id: AGENCY_A_ID,
  customer_type: 'corporate',
  full_name: 'Hichem Jaziri',
  company_name: 'Maghreb Services SARL',
  email: 'hichem@maghreb-services.tn',
  phone: '+216 71 800 900',
  address: '25 Rue du Lac Léman',
  city: 'Tunis',
  country_code: 'TN',
  notes: 'Facturation mensuelle',
  created_by: 'user-1',
  created_at: '2026-11-18T08:30:00Z',
  updated_at: '2026-11-25T15:45:00Z',
};

test('1. customerRecordToFormValues prefills editable fields and excludes immutable metadata', () => {
  const prefilled = customerRecordToFormValues(BASE_EDIT_CUSTOMER);

  assert.deepEqual(prefilled, {
    customer_type: 'corporate',
    full_name: 'Hichem Jaziri',
    company_name: 'Maghreb Services SARL',
    email: 'hichem@maghreb-services.tn',
    phone: '+216 71 800 900',
    address: '25 Rue du Lac Léman',
    city: 'Tunis',
    country_code: 'TN',
    notes: 'Facturation mensuelle',
  });
  assert.equal('id' in prefilled, false);
  assert.equal('agency_id' in prefilled, false);
  assert.equal('created_by' in prefilled, false);
  assert.equal('created_at' in prefilled, false);
  assert.equal('updated_at' in prefilled, false);

  const nullablePrefilled = customerRecordToFormValues({
    ...BASE_EDIT_CUSTOMER,
    customer_type: 'individual',
    company_name: null,
    email: null,
    address: null,
    city: null,
    notes: null,
  });
  assert.equal(nullablePrefilled.company_name, '');
  assert.equal(nullablePrefilled.email, '');
  assert.equal(nullablePrefilled.address, '');
  assert.equal(nullablePrefilled.city, '');
  assert.equal(nullablePrefilled.notes, '');
});

test('2. submitUpdateCustomer sends normalized PATCH request with no-store and no immutable fields', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;

  const updatedRecord: CustomerRecord = {
    ...BASE_EDIT_CUSTOMER,
    full_name: 'Hichem Ben Jaziri',
    phone: '+216 71 999 888',
    email: 'hichem.new@maghreb-services.tn',
    updated_at: '2026-11-26T12:00:00Z',
  };

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = input;
    capturedInit = init;
    return new Response(
      JSON.stringify({ ok: true, customer: updatedRecord }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const formValues = {
    ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
    full_name: '  Hichem   Ben Jaziri ',
    phone: '  +216   71 999 888 ',
    email: '  Hichem.New@Maghreb-Services.TN ',
  };

  const result = await submitUpdateCustomer(
    BASE_EDIT_CUSTOMER.id,
    BASE_EDIT_CUSTOMER,
    formValues,
    mockFetch
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, 200);
    assert.equal(result.customer.updated_at, '2026-11-26T12:00:00Z');
  }
  assert.equal(capturedUrl, `/api/customers/${VALID_CUSTOMER_ID}`);
  assert.equal(capturedInit?.method, 'PATCH');
  assert.equal(capturedInit?.cache, 'no-store');

  const sentBody = JSON.parse(String(capturedInit?.body)) as Record<
    string,
    unknown
  >;
  assert.deepEqual(sentBody, {
    full_name: 'Hichem Ben Jaziri',
    phone: '+216 71 999 888',
    email: 'hichem.new@maghreb-services.tn',
  });
  assert.equal('id' in sentBody, false);
  assert.equal('agency_id' in sentBody, false);
  assert.equal('created_by' in sentBody, false);
  assert.equal('created_at' in sentBody, false);
  assert.equal('updated_at' in sentBody, false);
});

test('3. buildCustomerPatchDiff & submitUpdateCustomer send strict partial updates and preserve omitted fields', async () => {
  let sentPayload: Record<string, unknown> | null = null;

  const onlyCityDiff = buildCustomerPatchDiff(BASE_EDIT_CUSTOMER, {
    ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
    city: 'Sfax',
  });
  assert.deepEqual(onlyCityDiff, { city: 'Sfax' });

  const result = await submitUpdateCustomer(
    BASE_EDIT_CUSTOMER.id,
    BASE_EDIT_CUSTOMER,
    {
      ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
      customer_type: 'individual',
      company_name: 'Should Be Cleared',
    },
    async (_input, init) => {
      sentPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          ok: true,
          customer: {
            ...BASE_EDIT_CUSTOMER,
            customer_type: 'individual',
            company_name: null,
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }
  );

  assert.equal(result.ok, true);
  assert.deepEqual(sentPayload, {
    customer_type: 'individual',
    company_name: null,
  });
});

test('4. submitUpdateCustomer rejects missing/invalid fields, invalid UUID, and no-op edits without calling API', async () => {
  let fetchCalled = false;
  const mockFetch: FetchLike = async () => {
    fetchCalled = true;
    return new Response('{}', { status: 200 });
  };

  const noChangesResult = await submitUpdateCustomer(
    BASE_EDIT_CUSTOMER.id,
    BASE_EDIT_CUSTOMER,
    customerRecordToFormValues(BASE_EDIT_CUSTOMER),
    mockFetch
  );
  assert.equal(fetchCalled, false);
  assert.equal(noChangesResult.ok, false);
  if (!noChangesResult.ok) {
    assert.equal(noChangesResult.noChanges, true);
  }

  const invalidFieldsResult = await submitUpdateCustomer(
    BASE_EDIT_CUSTOMER.id,
    BASE_EDIT_CUSTOMER,
    {
      ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
      full_name: ' ',
      phone: '12',
      email: 'not-an-email',
    },
    mockFetch
  );
  assert.equal(fetchCalled, false);
  assert.equal(invalidFieldsResult.ok, false);
  if (!invalidFieldsResult.ok) {
    assert.equal(invalidFieldsResult.status, 400);
    assert.ok(invalidFieldsResult.fieldErrors?.full_name);
    assert.ok(invalidFieldsResult.fieldErrors?.phone);
    assert.ok(invalidFieldsResult.fieldErrors?.email);
  }

  const invalidIdResult = await submitUpdateCustomer(
    'invalid-id',
    BASE_EDIT_CUSTOMER,
    { ...customerRecordToFormValues(BASE_EDIT_CUSTOMER), city: 'Bizerte' },
    mockFetch
  );
  assert.equal(fetchCalled, false);
  assert.equal(invalidIdResult.ok, false);
});

test('5. submitUpdateCustomer surfaces duplicate email conflict (409) clearly', async () => {
  const result = await submitUpdateCustomer(
    BASE_EDIT_CUSTOMER.id,
    BASE_EDIT_CUSTOMER,
    {
      ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
      email: 'existing.other@example.tn',
    },
    async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error:
            'Un client avec cette adresse e-mail existe déjà dans votre agence.',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      )
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 409);
    assert.match(result.error, /e-mail/i);
    assert.ok(result.fieldErrors?.email);
  }
});

test('6. submitUpdateCustomer handles unauthorized (401/403), missing (404), and server (500) responses safely', async () => {
  const editedValues = {
    ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
    city: 'Monastir',
  };

  for (const status of [401, 403, 404, 500] as const) {
    const result = await submitUpdateCustomer(
      BASE_EDIT_CUSTOMER.id,
      BASE_EDIT_CUSTOMER,
      editedValues,
      async () =>
        new Response(JSON.stringify({ ok: false }), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
    );

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.status, status);
      assert.ok(result.error.length > 0);
    }
  }
});

test('7. createSingleFlightGuard prevents duplicate concurrent PATCH submissions', async () => {
  const guard = createSingleFlightGuard();
  let patchCalls = 0;
  let resolvePatch: ((response: Response) => void) | undefined;

  const mockFetch: FetchLike = () => {
    patchCalls += 1;
    return new Promise<Response>((resolve) => {
      resolvePatch = resolve;
    });
  };

  const editedValues = {
    ...customerRecordToFormValues(BASE_EDIT_CUSTOMER),
    notes: 'Mise à jour prioritaire',
  };

  const firstAttempt = guard.run(() =>
    submitUpdateCustomer(
      BASE_EDIT_CUSTOMER.id,
      BASE_EDIT_CUSTOMER,
      editedValues,
      mockFetch
    )
  );
  assert.equal(guard.isRunning(), true);

  const secondAttempt = await guard.run(() =>
    submitUpdateCustomer(
      BASE_EDIT_CUSTOMER.id,
      BASE_EDIT_CUSTOMER,
      editedValues,
      mockFetch
    )
  );
  assert.equal(secondAttempt, null);
  assert.equal(patchCalls, 1);

  resolvePatch?.(
    new Response(
      JSON.stringify({
        ok: true,
        customer: { ...BASE_EDIT_CUSTOMER, notes: 'Mise à jour prioritaire' },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );

  const firstResult = await firstAttempt;
  assert.equal(firstResult?.ok, true);
  assert.equal(guard.isRunning(), false);
});

test('8. directory refresh after customer edit reloads real records and preserves active filters', async () => {
  const updatedCustomer: CustomerRecord = {
    ...BASE_EDIT_CUSTOMER,
    city: 'Nabeul',
    updated_at: '2026-11-26T12:10:00Z',
  };

  const refreshed = await fetchAgencyCustomersDirectory(async (input, init) => {
    assert.equal(input, '/api/customers');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.cache, 'no-store');
    return new Response(
      JSON.stringify({ ok: true, customers: [updatedCustomer] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  assert.equal(refreshed.ok, true);
  if (refreshed.ok) {
    const filtered = filterAndSortCustomers(refreshed.customers, {
      search: 'maghreb',
      customerType: 'corporate',
      sortBy: 'name_asc',
    });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].city, 'Nabeul');
    assert.equal(filtered[0].updated_at, '2026-11-26T12:10:00Z');
  }
});

test('9. details drawer updates immediately with saved customer and ignores stale updates for another ID', async () => {
  const controller = createCustomerDetailController(async () =>
    new Response(
      JSON.stringify({ ok: true, customer: BASE_EDIT_CUSTOMER }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  );

  await controller.selectCustomer(BASE_EDIT_CUSTOMER.id);
  assert.equal(controller.getState().customer?.city, 'Tunis');

  // Stale update for another customer ID must be ignored
  controller.applyUpdatedCustomer({
    ...BASE_EDIT_CUSTOMER,
    id: SECOND_CUSTOMER_ID,
    full_name: 'Autre Client Stale',
  });
  assert.equal(controller.getState().customer?.id, BASE_EDIT_CUSTOMER.id);
  assert.equal(controller.getState().customer?.full_name, 'Hichem Jaziri');

  // Valid update for active customer refreshes the drawer immediately
  const savedCustomer: CustomerRecord = {
    ...BASE_EDIT_CUSTOMER,
    city: 'Hammamet',
    phone: '+216 72 111 222',
    updated_at: '2026-11-26T12:15:00Z',
  };
  controller.applyUpdatedCustomer(savedCustomer);

  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().customer?.city, 'Hammamet');
  assert.equal(controller.getState().customer?.phone, '+216 72 111 222');
  assert.equal(
    controller.getState().customer?.updated_at,
    '2026-11-26T12:15:00Z'
  );
});

test('10. cancelling edit discards unsaved form changes without calling PATCH and preserves loaded customer', async () => {
  let patchCount = 0;
  const controller = createCustomerDetailController(async (_input, init) => {
    if (init?.method === 'PATCH') {
      patchCount += 1;
    }
    return new Response(
      JSON.stringify({ ok: true, customer: BASE_EDIT_CUSTOMER }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  });

  await controller.selectCustomer(BASE_EDIT_CUSTOMER.id);
  const loadedBeforeCancel = controller.getState().customer;
  assert.ok(loadedBeforeCancel);

  // User edits draft values locally then cancels without submitting
  const draftValues = {
    ...customerRecordToFormValues(loadedBeforeCancel),
    full_name: 'Brouillon Non Enregistré',
    city: 'Gabès',
  };
  assert.equal(draftValues.full_name, 'Brouillon Non Enregistré');

  // Re-opening edit after cancel prefills original untouched record
  const freshPrefillAfterCancel = customerRecordToFormValues(
    controller.getState().customer!
  );
  assert.equal(patchCount, 0);
  assert.equal(freshPrefillAfterCancel.full_name, 'Hichem Jaziri');
  assert.equal(freshPrefillAfterCancel.city, 'Tunis');
});
