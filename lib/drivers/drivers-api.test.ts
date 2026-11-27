import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import type { AgencyRecord } from '@/lib/agency/types';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import type { CustomerRecord } from '@/lib/customers/types';
import type { AgencyRole } from '@/lib/supabase/database.types';
import type { ApiAgencyResolution } from '@/lib/vehicles/server';
import {
  createCustomerDriverWithClient,
  CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS,
  CUSTOMER_DRIVER_MANAGER_SELECT_COLUMNS,
  handleGetCustomerDrivers,
  handlePatchCustomerDriver,
  handlePostCustomerDriver,
  listCustomerDriversWithClient,
  updateCustomerDriverWithClient,
} from './server';
import type { CustomerDriverRecord } from './types';
import {
  validateCreateCustomerDriverPayload,
  validatePatchCustomerDriverPayload,
} from './validation';

const ROOT = process.cwd();
const AGENCY_A_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const AGENCY_B_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CUSTOMER_A_ID = '11111111-2222-4333-8444-555555555555';
const CUSTOMER_B_ID = '22222222-3333-4444-8555-666666666666';
const DRIVER_1_ID = '33333333-4444-4555-8666-777777777777';
const DRIVER_2_ID = '44444444-5555-4666-8777-888888888888';
const DRIVER_OTHER_AGENCY_ID = '55555555-6666-4777-8888-999999999999';
const REF_NOW = new Date('2026-06-15T10:00:00.000Z');

const AGENCY_A: AgencyRecord = {
  id: AGENCY_A_ID,
  name: 'Carthage Rent',
  legal_name: 'Carthage Rent SARL',
  slug: 'carthage-rent',
  tax_id: null,
  country_code: 'TN',
  currency_code: 'TND',
  currency_minor_unit: 3,
  timezone: 'Africa/Tunis',
  default_locale: 'fr',
  vat_rate_bps: 1900,
  phone: '+216 71 000 000',
  email: 'contact@carthagerent.tn',
  city: 'Tunis',
  address: 'Tunis',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const CUSTOMER_A: CustomerRecord = {
  id: CUSTOMER_A_ID,
  agency_id: AGENCY_A_ID,
  customer_type: 'corporate',
  full_name: 'Sami Ben Ali',
  company_name: 'Atlas Mobility SARL',
  email: 'sami@atlasmobility.tn',
  phone: '+216 22 123 456',
  address: null,
  city: 'Tunis',
  country_code: 'TN',
  notes: null,
  created_by: 'user-owner',
  created_at: '2026-05-01T10:00:00Z',
  updated_at: '2026-05-01T10:00:00Z',
};

const CUSTOMER_B: CustomerRecord = {
  ...CUSTOMER_A,
  id: CUSTOMER_B_ID,
  agency_id: AGENCY_B_ID,
  full_name: 'Nadia Trabelsi',
  email: 'nadia@otheragency.tn',
};

const SAMPLE_DRIVERS: CustomerDriverRecord[] = [
  {
    id: DRIVER_1_ID,
    agency_id: AGENCY_A_ID,
    customer_id: CUSTOMER_A_ID,
    full_name: 'Youssef Mansour',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2028-12-31',
    verification_status: 'verified',
    verification_notes: 'Permis original vérifié en agence (confidentiel).',
    is_active: true,
    created_by: 'user-owner',
    created_at: '2026-06-10T09:00:00Z',
    updated_at: '2026-06-10T09:00:00Z',
  },
  {
    id: DRIVER_2_ID,
    agency_id: AGENCY_A_ID,
    customer_id: CUSTOMER_A_ID,
    full_name: 'Amira Khelifi',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2026-06-25',
    verification_status: 'pending',
    verification_notes: 'Attente de contrôle visuel.',
    is_active: true,
    created_by: 'user-manager',
    created_at: '2026-06-05T09:00:00Z',
    updated_at: '2026-06-05T09:00:00Z',
  },
  {
    id: DRIVER_OTHER_AGENCY_ID,
    agency_id: AGENCY_B_ID,
    customer_id: CUSTOMER_A_ID,
    full_name: 'Conducteur Autre Agence',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-01-01',
    verification_status: 'verified',
    verification_notes: 'Ne doit jamais fuiter.',
    is_active: true,
    created_by: 'user-b',
    created_at: '2026-06-12T09:00:00Z',
    updated_at: '2026-06-12T09:00:00Z',
  },
];

interface MockQueryRecord {
  table: string;
  select: string;
  filters: Record<string, string>;
  orders: Array<{ column: string; ascending: boolean }>;
}

interface MockInsertRecord {
  table: string;
  payload: Record<string, unknown>;
  select: string;
}

interface MockUpdateRecord {
  table: string;
  payload: Record<string, unknown>;
  filters: Record<string, string>;
  select: string;
}

interface MockAuditEvent {
  action:
    | 'customer_driver.verification_status_changed'
    | 'customer_driver.deactivated'
    | 'customer_driver.reactivated'
    | 'customer_driver.updated';
  driver_id: string;
  from_verification_status: CustomerDriverRecord['verification_status'];
  to_verification_status: CustomerDriverRecord['verification_status'];
  from_is_active: boolean;
  to_is_active: boolean;
}

/**
 * In-memory simulation of migration 0008's BEFORE UPDATE trigger
 * `enforce_customer_driver_verification_integrity()` and migration 0007's
 * AFTER UPDATE trigger `audit_customer_driver_change()`.
 * Used strictly for deterministic unit tests (NOT a substitute for live PostgreSQL).
 */
function simulateMigration0008AndAuditTriggers(
  existing: CustomerDriverRecord,
  payload: Record<string, unknown>
):
  | {
      ok: true;
      persisted: CustomerDriverRecord;
      auditEvent: MockAuditEvent;
    }
  | {
      ok: false;
      error: { code: string; constraint: string; message: string };
    } {
  const candidate: CustomerDriverRecord = {
    ...existing,
    ...(payload as Partial<CustomerDriverRecord>),
    updated_at: '2026-06-15T12:00:00Z',
  };

  const materialChanged =
    candidate.full_name !== existing.full_name ||
    candidate.licence_issuing_country !== existing.licence_issuing_country ||
    candidate.licence_category !== existing.licence_category ||
    candidate.licence_expires_on !== existing.licence_expires_on;

  if (materialChanged) {
    if (
      candidate.verification_status === 'verified' &&
      existing.verification_status !== 'verified'
    ) {
      return {
        ok: false,
        error: {
          code: '23514',
          constraint: 'customer_drivers_verification_integrity_check',
          message:
            'Cannot mark a customer driver as verified in the same update that modifies driver identity or licence metadata.',
        },
      };
    }

    if (
      existing.verification_status === 'verified' &&
      candidate.verification_status === 'verified'
    ) {
      candidate.verification_status = 'unverified';
    }
  }

  let action: MockAuditEvent['action'];
  if (existing.verification_status !== candidate.verification_status) {
    action = 'customer_driver.verification_status_changed';
  } else if (existing.is_active && !candidate.is_active) {
    action = 'customer_driver.deactivated';
  } else if (!existing.is_active && candidate.is_active) {
    action = 'customer_driver.reactivated';
  } else {
    action = 'customer_driver.updated';
  }

  return {
    ok: true,
    persisted: candidate,
    auditEvent: {
      action,
      driver_id: candidate.id,
      from_verification_status: existing.verification_status,
      to_verification_status: candidate.verification_status,
      from_is_active: existing.is_active,
      to_is_active: candidate.is_active,
    },
  };
}

function makeMockDriversSupabase(options: {
  customers: CustomerRecord[];
  drivers: CustomerDriverRecord[];
  customerError?: { code?: string; message?: string };
  driversError?: { code?: string; message?: string };
  insertError?: { code?: string; message?: string; constraint?: string };
  updateError?: { code?: string; message?: string; constraint?: string };
}) {
  const queries: MockQueryRecord[] = [];
  const inserts: MockInsertRecord[] = [];
  const updates: MockUpdateRecord[] = [];
  const auditEvents: MockAuditEvent[] = [];
  const driverStore: CustomerDriverRecord[] = options.drivers.map((d) => ({
    ...d,
  }));

  const client = {
    from(table: string) {
      return {
        update(payload: Record<string, unknown>) {
          const updateRec: MockUpdateRecord = {
            table,
            payload,
            filters: {},
            select: '',
          };
          updates.push(updateRec);

          const chain = {
            eq(column: string, value: string) {
              updateRec.filters[column] = value;
              return chain;
            },
            select(columns: string) {
              updateRec.select = columns;
              return {
                async maybeSingle() {
                  if (options.updateError) {
                    return { data: null, error: options.updateError };
                  }
                  const existingIdx = driverStore.findIndex(
                    (d) =>
                      d.id === updateRec.filters.id &&
                      d.customer_id === updateRec.filters.customer_id &&
                      d.agency_id === updateRec.filters.agency_id
                  );
                  if (existingIdx === -1) {
                    return { data: null, error: null };
                  }
                  const triggerResult = simulateMigration0008AndAuditTriggers(
                    driverStore[existingIdx],
                    payload
                  );
                  if (!triggerResult.ok) {
                    return { data: null, error: triggerResult.error };
                  }
                  driverStore[existingIdx] = triggerResult.persisted;
                  auditEvents.push(triggerResult.auditEvent);

                  const requestedCols = columns
                    .split(',')
                    .map((col) => col.trim())
                    .filter(Boolean);
                  const projected: Record<string, unknown> = {};
                  for (const col of requestedCols) {
                    projected[col] = (
                      triggerResult.persisted as unknown as Record<string, unknown>
                    )[col];
                  }
                  return { data: projected, error: null };
                },
              };
            },
          };

          return chain;
        },
        insert(payload: Record<string, unknown>) {
          const insertRec: MockInsertRecord = {
            table,
            payload,
            select: '',
          };
          inserts.push(insertRec);
          return {
            select(columns: string) {
              insertRec.select = columns;
              return {
                async single() {
                  if (options.insertError) {
                    return { data: null, error: options.insertError };
                  }
                  const persisted: CustomerDriverRecord = {
                    id: '66666666-7777-4888-8999-aaaaaaaaaaaa',
                    agency_id: String(payload.agency_id),
                    customer_id: String(payload.customer_id),
                    full_name: String(payload.full_name),
                    licence_issuing_country:
                      (payload.licence_issuing_country as string | null) ?? null,
                    licence_category:
                      (payload.licence_category as string | null) ?? null,
                    licence_expires_on:
                      (payload.licence_expires_on as string | null) ?? null,
                    verification_status:
                      (payload.verification_status as CustomerDriverRecord['verification_status']) ??
                      'unverified',
                    verification_notes: 'NOTE_PRIVEE_NE_DOIT_PAS_FUITER',
                    is_active:
                      typeof payload.is_active === 'boolean'
                        ? payload.is_active
                        : true,
                    created_by: (payload.created_by as string | null) ?? null,
                    created_at: '2026-06-15T10:00:00Z',
                    updated_at: '2026-06-15T10:00:00Z',
                  };
                  const requestedCols = columns
                    .split(',')
                    .map((col) => col.trim())
                    .filter(Boolean);
                  const projected: Record<string, unknown> = {};
                  for (const col of requestedCols) {
                    projected[col] = (
                      persisted as unknown as Record<string, unknown>
                    )[col];
                  }
                  return { data: projected, error: null };
                },
              };
            },
          };
        },
        select(columns: string) {
          const record: MockQueryRecord = {
            table,
            select: columns,
            filters: {},
            orders: [],
          };
          queries.push(record);

          const chain = {
            eq(column: string, value: string) {
              record.filters[column] = value;
              return chain;
            },
            order(column: string, opts?: { ascending?: boolean }) {
              record.orders.push({
                column,
                ascending: opts?.ascending ?? true,
              });
              return chain;
            },
            async maybeSingle() {
              if (table === 'customers') {
                if (options.customerError) {
                  return { data: null, error: options.customerError };
                }
                const match =
                  options.customers.find(
                    (c) =>
                      c.id === record.filters.id &&
                      c.agency_id === record.filters.agency_id
                  ) ?? null;
                return { data: match, error: null };
              }
              return { data: null, error: null };
            },
            then<TResult1 = unknown, TResult2 = never>(
              onfulfilled?:
                | ((value: {
                    data: Record<string, unknown>[] | null;
                    error: { code?: string; message?: string } | null;
                  }) => TResult1 | PromiseLike<TResult1>)
                | null,
              onrejected?:
                | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
                | null
            ) {
              const promise = (async () => {
                if (table === 'customer_drivers') {
                  if (options.driversError) {
                    return { data: null, error: options.driversError };
                  }
                  const requestedCols = columns
                    .split(',')
                    .map((col) => col.trim())
                    .filter(Boolean);
                  const matched = driverStore
                    .filter(
                      (d) =>
                        d.agency_id === record.filters.agency_id &&
                        d.customer_id === record.filters.customer_id
                    )
                    .map((row) => {
                      const projected: Record<string, unknown> = {};
                      for (const col of requestedCols) {
                        projected[col] = (row as unknown as Record<string, unknown>)[
                          col
                        ];
                      }
                      return projected;
                    });
                  return { data: matched, error: null };
                }
                return { data: [], error: null };
              })();
              return promise.then(onfulfilled, onrejected);
            },
          };

          return chain;
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, queries, inserts, updates, auditEvents };
}

function makeJsonPostRequest(body: unknown): NextRequest {
  return new NextRequest(
    `https://kiralis.example/api/customers/${CUSTOMER_A_ID}/drivers`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://kiralis.example',
        Host: 'kiralis.example',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );
}

function makeJsonPatchRequest(
  body: unknown,
  customerId: string = CUSTOMER_A_ID,
  driverId: string = DRIVER_1_ID
): NextRequest {
  return new NextRequest(
    `https://kiralis.example/api/customers/${customerId}/drivers/${driverId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://kiralis.example',
        Host: 'kiralis.example',
      },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }
  );
}

function makeAuthCtx(
  role: AgencyRole,
  supabase: SupabaseClient
): ApiAgencyResolution {
  return {
    ok: true,
    supabase,
    user: { id: `user-${role}` } as User,
    activeMembership: {
      id: 'mem-1',
      agency_id: AGENCY_A_ID,
      role,
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      agency: AGENCY_A,
    },
    activeAgency: AGENCY_A,
  };
}

test('GET /api/customers/[id]/drivers returns authorized drivers with verification_notes for Owner and Manager and withholds verification_notes for read-only Agent', async () => {
  for (const role of ['owner', 'manager', 'agent'] as const) {
    const { client, queries } = makeMockDriversSupabase({
      customers: [CUSTOMER_A, CUSTOMER_B],
      drivers: SAMPLE_DRIVERS,
    });

    const response = await handleGetCustomerDrivers(CUSTOMER_A_ID, {
      resolveAuth: async () => makeAuthCtx(role, client),
      now: REF_NOW,
    });

    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get('cache-control'),
      NO_STORE_CACHE_HEADERS['Cache-Control']
    );

    const body = (await response.json()) as {
      ok: boolean;
      customer_id: string;
      drivers: Array<Record<string, unknown>>;
      summary: { totalDrivers: number; activeDrivers: number };
    };

    assert.equal(body.ok, true);
    assert.equal(body.customer_id, CUSTOMER_A_ID);
    assert.equal(body.drivers.length, 2);
    assert.equal(body.summary.totalDrivers, 2);
    assert.equal(body.summary.activeDrivers, 2);

    // Never expose drivers belonging to another agency
    assert.equal(
      body.drivers.some((d) => d.id === DRIVER_OTHER_AGENCY_ID),
      false
    );

    const driverQuery = queries.find((q) => q.table === 'customer_drivers');
    assert.ok(driverQuery);
    assert.equal(driverQuery.filters.agency_id, AGENCY_A_ID);
    assert.equal(driverQuery.filters.customer_id, CUSTOMER_A_ID);

    if (role === 'agent') {
      assert.equal(driverQuery.select, CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS);
      assert.equal(driverQuery.select.includes('verification_notes'), false);
      for (const driver of body.drivers) {
        assert.equal('verification_notes' in driver, false);
        assert.ok(driver.eligibility);
      }
    } else {
      assert.equal(driverQuery.select, CUSTOMER_DRIVER_MANAGER_SELECT_COLUMNS);
      assert.equal(driverQuery.select.includes('verification_notes'), true);
      assert.equal(
        body.drivers[0].verification_notes,
        'Permis original vérifié en agence (confidentiel).'
      );
    }
  }
});

test('GET /api/customers/[id]/drivers returns an empty array when a valid customer has no authorized drivers', async () => {
  const { client } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
  });

  const response = await handleGetCustomerDrivers(CUSTOMER_A_ID, {
    resolveAuth: async () => makeAuthCtx('owner', client),
    now: REF_NOW,
  });

  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    ok: boolean;
    drivers: unknown[];
    summary: { totalDrivers: number; activeDrivers: number };
  };
  assert.equal(body.ok, true);
  assert.deepEqual(body.drivers, []);
  assert.equal(body.summary.totalDrivers, 0);
  assert.equal(body.summary.activeDrivers, 0);
});

test('GET /api/customers/[id]/drivers rejects invalid customer UUID with 400 without querying the database', async () => {
  const { client, queries } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });

  const response = await handleGetCustomerDrivers('invalid-uuid-123', {
    resolveAuth: async () => makeAuthCtx('owner', client),
  });

  assert.equal(response.status, 400);
  assert.equal(
    response.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );
  assert.equal(queries.length, 0);

  const body = (await response.json()) as { ok: boolean; error: string };
  assert.equal(body.ok, false);
  assert.ok(body.error);
});

test('GET /api/customers/[id]/drivers returns 404 for a customer belonging to another agency without querying customer_drivers', async () => {
  const { client, queries } = makeMockDriversSupabase({
    customers: [CUSTOMER_B],
    drivers: SAMPLE_DRIVERS,
  });

  const response = await handleGetCustomerDrivers(CUSTOMER_B_ID, {
    resolveAuth: async () => makeAuthCtx('owner', client),
  });

  assert.equal(response.status, 404);
  assert.equal(
    response.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );
  // Customer lookup ran scoped to Agency A, and customer_drivers was never queried
  assert.equal(queries.length, 1);
  assert.equal(queries[0].table, 'customers');
  assert.equal(queries[0].filters.agency_id, AGENCY_A_ID);
  assert.equal(
    queries.some((q) => q.table === 'customer_drivers'),
    false
  );
});

test('GET /api/customers/[id]/drivers rejects unauthenticated requests (401) and missing active agency membership (403)', async () => {
  const unauthResponse = await handleGetCustomerDrivers(CUSTOMER_A_ID, {
    resolveAuth: async () => ({
      ok: false,
      status: 401,
      error: 'Authentification requise.',
    }),
  });
  assert.equal(unauthResponse.status, 401);
  assert.equal(
    unauthResponse.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );

  const noMembershipResponse = await handleGetCustomerDrivers(CUSTOMER_A_ID, {
    resolveAuth: async () => ({
      ok: false,
      status: 403,
      error: 'Aucune agence active associée à votre compte.',
    }),
  });
  assert.equal(noMembershipResponse.status, 403);
  assert.equal(
    noMembershipResponse.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );
});

test('listCustomerDriversWithClient maps PostgreSQL RLS denial (42501) to 403 and unexpected DB errors to safe 500 without leaking internals', async () => {
  const rlsMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
    driversError: {
      code: '42501',
      message: 'permission denied for table customer_drivers',
    },
  });

  const rlsResult = await listCustomerDriversWithClient(rlsMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: CUSTOMER_A_ID,
    role: 'agent',
  });
  assert.equal(rlsResult.status, 403);
  assert.deepEqual(rlsResult.drivers, []);
  assert.equal(rlsResult.error?.includes('permission denied'), false);

  const dbFailMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
    driversError: {
      code: '08006',
      message: 'internal postgres socket failure with secret details',
    },
  });

  const dbFailResult = await listCustomerDriversWithClient(dbFailMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: CUSTOMER_A_ID,
    role: 'owner',
  });
  assert.equal(dbFailResult.status, 500);
  assert.deepEqual(dbFailResult.drivers, []);
  assert.equal(dbFailResult.error?.includes('socket failure'), false);
});

test('POST /api/customers/[id]/drivers allows Owner and Manager creation, defaults verification_status=unverified & is_active=true, and omits verification_notes', async () => {
  for (const role of ['owner', 'manager'] as const) {
    const { client, inserts } = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: [],
    });

    const req = makeJsonPostRequest(
      role === 'owner'
        ? {
            full_name: '  Karim   Ben  Youssef  ',
            licence_issuing_country: ' tn ',
            licence_category: ' b e ',
            licence_expires_on: '2029-05-20',
          }
        : {
            full_name: 'Salma Gharbi',
          }
    );

    const response = await handlePostCustomerDriver(req, CUSTOMER_A_ID, {
      resolveAuth: async () => makeAuthCtx(role, client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    });

    assert.equal(response.status, 201);
    assert.equal(
      response.headers.get('cache-control'),
      NO_STORE_CACHE_HEADERS['Cache-Control']
    );

    const body = (await response.json()) as {
      ok: boolean;
      driver: Record<string, unknown>;
    };

    assert.equal(body.ok, true);
    assert.equal(body.driver.agency_id, AGENCY_A_ID);
    assert.equal(body.driver.customer_id, CUSTOMER_A_ID);
    assert.equal(body.driver.created_by, `user-${role}`);
    assert.equal(body.driver.verification_status, 'unverified');
    assert.equal(body.driver.is_active, true);
    assert.equal('verification_notes' in body.driver, false);
    assert.ok(body.driver.eligibility);

    assert.equal(inserts.length, 1);
    assert.equal(inserts[0].table, 'customer_drivers');
    assert.equal(inserts[0].select, CUSTOMER_DRIVER_AGENT_SELECT_COLUMNS);
    assert.equal(inserts[0].select.includes('verification_notes'), false);
    assert.equal(inserts[0].payload.agency_id, AGENCY_A_ID);
    assert.equal(inserts[0].payload.customer_id, CUSTOMER_A_ID);
    assert.equal(inserts[0].payload.created_by, `user-${role}`);
    assert.equal(inserts[0].payload.verification_status, 'unverified');
    assert.equal(inserts[0].payload.is_active, true);

    if (role === 'owner') {
      assert.equal(inserts[0].payload.full_name, 'Karim Ben Youssef');
      assert.equal(inserts[0].payload.licence_issuing_country, 'TN');
      assert.equal(inserts[0].payload.licence_category, 'BE');
      assert.equal(inserts[0].payload.licence_expires_on, '2029-05-20');
    } else {
      assert.equal(inserts[0].payload.full_name, 'Salma Gharbi');
      assert.equal(inserts[0].payload.licence_issuing_country, null);
      assert.equal(inserts[0].payload.licence_category, null);
      assert.equal(inserts[0].payload.licence_expires_on, null);
    }
  }
});

test('POST /api/customers/[id]/drivers rejects Agent with 403 and untrusted origin with 403 without touching DB', async () => {
  const { client, queries, inserts } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
  });

  const agentRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Hedi Mansouri' }),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => makeAuthCtx('agent', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(agentRes.status, 403);
  assert.equal(
    agentRes.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );
  assert.equal(queries.length, 0);
  assert.equal(inserts.length, 0);

  let authCalled = false;
  const csrfRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Hedi Mansouri' }),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => {
        authCalled = true;
        return makeAuthCtx('owner', client);
      },
      isTrustedOrigin: () => false,
    }
  );
  assert.equal(csrfRes.status, 403);
  assert.equal(authCalled, false);
});

test('POST /api/customers/[id]/drivers rejects unauthenticated (401), missing membership (403), invalid UUID (400), and foreign-agency customer (404)', async () => {
  const unauthRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Amine Trabelsi' }),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => ({
        ok: false,
        status: 401,
        error: 'Authentification requise.',
      }),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(unauthRes.status, 401);
  assert.equal(
    unauthRes.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );

  const noMembershipRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Amine Trabelsi' }),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => ({
        ok: false,
        status: 403,
        error: 'Aucune agence active.',
      }),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(noMembershipRes.status, 403);

  const badUuidMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
  });
  const badUuidRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Amine Trabelsi' }),
    'not-a-uuid',
    {
      resolveAuth: async () => makeAuthCtx('owner', badUuidMock.client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(badUuidRes.status, 400);
  assert.equal(badUuidMock.queries.length, 0);
  assert.equal(badUuidMock.inserts.length, 0);

  const foreignMock = makeMockDriversSupabase({
    customers: [CUSTOMER_B],
    drivers: [],
  });
  const foreignRes = await handlePostCustomerDriver(
    makeJsonPostRequest({ full_name: 'Amine Trabelsi' }),
    CUSTOMER_B_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', foreignMock.client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(foreignRes.status, 404);
  assert.equal(foreignMock.queries.length, 1);
  assert.equal(foreignMock.queries[0].table, 'customers');
  assert.equal(foreignMock.queries[0].filters.agency_id, AGENCY_A_ID);
  assert.equal(foreignMock.inserts.length, 0);
});

test('POST /api/customers/[id]/drivers rejects invalid full_name, invalid licence dates, malformed JSON, and client-controlled immutable or sensitive fields with 400', async () => {
  const { client, queries, inserts } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [],
  });

  // Invalid fields
  const invalidFieldsRes = await handlePostCustomerDriver(
    makeJsonPostRequest({
      full_name: 'A',
      licence_issuing_country: 'TUN',
      licence_category: '123-BAD',
      licence_expires_on: '2026-02-29',
    }),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(invalidFieldsRes.status, 400);
  const invalidFieldsBody = (await invalidFieldsRes.json()) as {
    ok: boolean;
    fieldErrors?: Record<string, string>;
  };
  assert.equal(invalidFieldsBody.ok, false);
  assert.ok(invalidFieldsBody.fieldErrors?.full_name);
  assert.ok(invalidFieldsBody.fieldErrors?.licence_issuing_country);
  assert.ok(invalidFieldsBody.fieldErrors?.licence_category);
  assert.ok(invalidFieldsBody.fieldErrors?.licence_expires_on);

  // Overly long full_name and out-of-range date
  const outOfRangeValidation = validateCreateCustomerDriverPayload({
    full_name: 'X'.repeat(141),
    licence_expires_on: '1979-12-31',
  });
  assert.equal(outOfRangeValidation.valid, false);
  assert.ok(outOfRangeValidation.errors.full_name);
  assert.ok(outOfRangeValidation.errors.licence_expires_on);

  // Malformed JSON
  const malformedRes = await handlePostCustomerDriver(
    makeJsonPostRequest('{invalid json'),
    CUSTOMER_A_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(malformedRes.status, 400);

  // Immutable, verification, and prohibited identity/document fields must all be rejected
  const forbiddenPayloads: Array<Record<string, unknown>> = [
    { full_name: 'Nadia Ben Ali', verification_status: 'verified' },
    { full_name: 'Nadia Ben Ali', verification_notes: 'Note privée' },
    { full_name: 'Nadia Ben Ali', is_active: false },
    { full_name: 'Nadia Ben Ali', agency_id: AGENCY_B_ID },
    { full_name: 'Nadia Ben Ali', customer_id: CUSTOMER_B_ID },
    { full_name: 'Nadia Ben Ali', created_by: 'other-user' },
    { full_name: 'Nadia Ben Ali', id: DRIVER_1_ID },
    { full_name: 'Nadia Ben Ali', created_at: '2026-01-01T00:00:00Z' },
    { full_name: 'Nadia Ben Ali', licence_number: 'TN-123456' },
    { full_name: 'Nadia Ben Ali', passport_number: 'P1234567' },
    { full_name: 'Nadia Ben Ali', national_id: '09123456' },
    { full_name: 'Nadia Ben Ali', scan_url: 'https://example.com/scan.png' },
  ];

  for (const payload of forbiddenPayloads) {
    const res = await handlePostCustomerDriver(
      makeJsonPostRequest(payload),
      CUSTOMER_A_ID,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
      }
    );
    assert.equal(res.status, 400);
  }

  assert.equal(queries.length, 0);
  assert.equal(inserts.length, 0);
});

test('createCustomerDriverWithClient maps PostgreSQL RLS and constraint errors safely without leaking internals', async () => {
  const validPayload = {
    full_name: 'Mehdi Chaabane',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-01-01',
  };

  const cases = [
    {
      insertError: {
        code: '42501',
        message: 'new row violates row-level security policy for table "customer_drivers"',
      },
      expectedStatus: 403,
      forbiddenLeak: 'row-level security',
    },
    {
      insertError: {
        code: '23503',
        message: 'insert violates foreign key "customer_drivers_customer_same_agency_fk"',
      },
      expectedStatus: 404,
      forbiddenLeak: 'same_agency_fk',
    },
    {
      insertError: {
        code: '23514',
        constraint: 'customer_drivers_licence_expires_on_check',
        message: 'new row violates check constraint',
      },
      expectedStatus: 400,
      forbiddenLeak: 'check constraint',
    },
    {
      insertError: {
        code: '08006',
        message: 'internal postgres connection terminated',
      },
      expectedStatus: 500,
      forbiddenLeak: 'connection terminated',
    },
  ];

  for (const tc of cases) {
    const mock = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: [],
      insertError: tc.insertError,
    });
    const res = await createCustomerDriverWithClient(mock.client, {
      agencyId: AGENCY_A_ID,
      customerId: CUSTOMER_A_ID,
      createdByUserId: 'user-owner',
      role: 'owner',
      payload: validPayload,
    });
    assert.equal(res.status, tc.expectedStatus);
    assert.equal(res.driver, null);
    assert.ok(res.error);
    assert.equal(res.error?.includes(tc.forbiddenLeak), false);
    if (tc.insertError.code === '23514') {
      assert.ok(res.fieldErrors?.licence_expires_on);
    }
  }
});

test('PATCH /api/customers/[id]/drivers/[driverId] allows Owner and Manager partial updates, preserves omitted fields, and keeps manual eligibility review required', async () => {
  // Owner: Step 1 edits licence details, Step 2 performs explicit manual verification
  {
    const { client, updates } = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: SAMPLE_DRIVERS,
    });

    const editRes = await handlePatchCustomerDriver(
      makeJsonPatchRequest(
        {
          licence_category: ' b e ',
          licence_expires_on: '2030-08-15',
        },
        CUSTOMER_A_ID,
        DRIVER_2_ID
      ),
      CUSTOMER_A_ID,
      DRIVER_2_ID,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
        now: REF_NOW,
      }
    );

    assert.equal(editRes.status, 200);
    assert.equal(
      editRes.headers.get('cache-control'),
      NO_STORE_CACHE_HEADERS['Cache-Control']
    );

    const editBody = (await editRes.json()) as {
      ok: boolean;
      driver: Record<string, unknown>;
    };
    assert.equal(editBody.ok, true);
    assert.deepEqual(updates[0].payload, {
      licence_category: 'BE',
      licence_expires_on: '2030-08-15',
    });
    assert.equal(updates[0].table, 'customer_drivers');
    assert.equal(updates[0].filters.id, DRIVER_2_ID);
    assert.equal(updates[0].filters.customer_id, CUSTOMER_A_ID);
    assert.equal(updates[0].filters.agency_id, AGENCY_A_ID);
    assert.equal('updated_at' in updates[0].payload, false);
    assert.equal('agency_id' in updates[0].payload, false);
    assert.equal('customer_id' in updates[0].payload, false);
    // Omitted fields preserved from existing record
    assert.equal(editBody.driver.full_name, 'Amira Khelifi');
    assert.equal(editBody.driver.licence_issuing_country, 'TN');
    assert.equal(editBody.driver.is_active, true);
    assert.equal(editBody.driver.verification_status, 'pending');

    // Step 2: Separate verification-only PATCH establishes verified status
    const verifyRes = await handlePatchCustomerDriver(
      makeJsonPatchRequest(
        {
          verification_status: 'verified',
          verification_notes: '  Permis vérifié en agence  ',
        },
        CUSTOMER_A_ID,
        DRIVER_2_ID
      ),
      CUSTOMER_A_ID,
      DRIVER_2_ID,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
        now: REF_NOW,
      }
    );

    assert.equal(verifyRes.status, 200);
    const verifyBody = (await verifyRes.json()) as {
      ok: boolean;
      driver: Record<string, unknown> & {
        eligibility: {
          status: string;
          requiresCountrySpecificVerification: boolean;
        };
      };
    };
    assert.equal(verifyBody.ok, true);
    assert.deepEqual(updates[1].payload, {
      verification_status: 'verified',
      verification_notes: 'Permis vérifié en agence',
    });
    assert.equal(verifyBody.driver.verification_status, 'verified');
    assert.equal(verifyBody.driver.verification_notes, 'Permis vérifié en agence');
    // Even when verified, driver is NEVER automatically declared legally eligible
    assert.equal(
      verifyBody.driver.eligibility.status,
      'checks_passed_manual_review_required'
    );
    assert.equal(
      verifyBody.driver.eligibility.requiresCountrySpecificVerification,
      true
    );
  }

  // Manager: partial name edit + non-verified status update
  {
    const { client, updates } = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: SAMPLE_DRIVERS,
    });

    const response = await handlePatchCustomerDriver(
      makeJsonPatchRequest(
        {
          full_name: '  Amira   Khelifi-Ben  Salah  ',
          verification_status: 'pending',
        },
        CUSTOMER_A_ID,
        DRIVER_2_ID
      ),
      CUSTOMER_A_ID,
      DRIVER_2_ID,
      {
        resolveAuth: async () => makeAuthCtx('manager', client),
        isTrustedOrigin: () => true,
        now: REF_NOW,
      }
    );

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      ok: boolean;
      driver: Record<string, unknown>;
    };
    assert.equal(body.ok, true);
    assert.deepEqual(updates[0].payload, {
      full_name: 'Amira Khelifi-Ben Salah',
      verification_status: 'pending',
    });
    assert.equal(body.driver.full_name, 'Amira Khelifi-Ben Salah');
    assert.equal(body.driver.licence_expires_on, '2026-06-25');
    assert.equal(body.driver.verification_notes, 'Attente de contrôle visuel.');
  }
});

test('PATCH /api/customers/[id]/drivers/[driverId] supports deactivation, reactivation, and explicitly clearing verification_notes with null', async () => {
  // Deactivate driver + clear verification_notes
  const deactivateMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });
  const deactivateRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({
      is_active: false,
      verification_notes: null,
    }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', deactivateMock.client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(deactivateRes.status, 200);
  const deactivateBody = (await deactivateRes.json()) as {
    ok: boolean;
    driver: {
      is_active: boolean;
      verification_notes: string | null;
      verification_status: string;
      eligibility: { status: string; flags: Array<{ code: string }> };
    };
  };
  assert.equal(deactivateBody.driver.is_active, false);
  assert.equal(deactivateBody.driver.verification_notes, null);
  // Existing verification_status is never overwritten or auto-changed
  assert.equal(deactivateBody.driver.verification_status, 'verified');
  assert.equal(deactivateBody.driver.eligibility.status, 'blocked');
  assert.ok(
    deactivateBody.driver.eligibility.flags.some(
      (f) => f.code === 'driver_inactive'
    )
  );
  assert.deepEqual(deactivateMock.updates[0].payload, {
    verification_notes: null,
    is_active: false,
  });

  // Reactivate inactive driver
  const inactiveDriver: CustomerDriverRecord = {
    ...SAMPLE_DRIVERS[0],
    is_active: false,
  };
  const reactivateMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: [inactiveDriver],
  });
  const reactivateRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: true }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('manager', reactivateMock.client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(reactivateRes.status, 200);
  const reactivateBody = (await reactivateRes.json()) as {
    ok: boolean;
    driver: { is_active: boolean; eligibility: { status: string } };
  };
  assert.equal(reactivateBody.driver.is_active, true);
  assert.equal(
    reactivateBody.driver.eligibility.status,
    'checks_passed_manual_review_required'
  );
});

test('PATCH /api/customers/[id]/drivers/[driverId] rejects Agent (403), untrusted origin (403), unauthenticated (401), and missing membership (403)', async () => {
  const { client, queries, updates } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });

  const agentRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ verification_status: 'verified' }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('agent', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(agentRes.status, 403);
  assert.equal(
    agentRes.headers.get('cache-control'),
    NO_STORE_CACHE_HEADERS['Cache-Control']
  );
  assert.equal(queries.length, 0);
  assert.equal(updates.length, 0);

  let authCalled = false;
  const csrfRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => {
        authCalled = true;
        return makeAuthCtx('owner', client);
      },
      isTrustedOrigin: () => false,
    }
  );
  assert.equal(csrfRes.status, 403);
  assert.equal(authCalled, false);

  const unauthRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => ({
        ok: false,
        status: 401,
        error: 'Authentification requise.',
      }),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(unauthRes.status, 401);

  const noMembershipRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => ({
        ok: false,
        status: 403,
        error: 'Aucune agence active.',
      }),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(noMembershipRes.status, 403);
});

test('PATCH /api/customers/[id]/drivers/[driverId] rejects invalid UUIDs, empty/malformed payloads, invalid verification status, and immutable or prohibited fields with 400', async () => {
  const { client, queries, updates } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });

  // Invalid customer UUID and invalid driver UUID
  const badCustRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }),
    'bad-customer-uuid',
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(badCustRes.status, 400);

  const badDriverRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }),
    CUSTOMER_A_ID,
    'bad-driver-uuid',
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(badDriverRes.status, 400);

  // Malformed JSON and empty payload
  const malformedRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest('{not-json'),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(malformedRes.status, 400);

  const emptyRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({}),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(emptyRes.status, 400);

  // Invalid verification status, invalid date, non-boolean is_active, too-long notes
  const invalidValidation = validatePatchCustomerDriverPayload({
    full_name: 'A',
    licence_issuing_country: 'TUN',
    licence_category: '123',
    licence_expires_on: '2026-02-29',
    verification_status: 'legally_approved',
    verification_notes: 'N'.repeat(1001),
    is_active: 'true',
  });
  assert.equal(invalidValidation.valid, false);
  assert.ok(invalidValidation.errors.full_name);
  assert.ok(invalidValidation.errors.licence_issuing_country);
  assert.ok(invalidValidation.errors.licence_category);
  assert.ok(invalidValidation.errors.licence_expires_on);
  assert.ok(invalidValidation.errors.verification_status);
  assert.ok(invalidValidation.errors.verification_notes);
  assert.ok(invalidValidation.errors.is_active);

  // Immutable and prohibited identity/document fields
  const forbiddenPatches: Array<Record<string, unknown>> = [
    { id: DRIVER_2_ID, is_active: false },
    { agency_id: AGENCY_B_ID, is_active: false },
    { customer_id: CUSTOMER_B_ID, is_active: false },
    { created_by: 'other-user', is_active: false },
    { created_at: '2026-01-01T00:00:00Z', is_active: false },
    { updated_at: '2026-01-01T00:00:00Z', is_active: false },
    { licence_number: 'TN-123456' },
    { passport_number: 'P123456' },
    { national_id: '09123456' },
    { document_url: 'https://example.com/id.pdf' },
    { scan_url: 'https://example.com/scan.png' },
  ];

  for (const payload of forbiddenPatches) {
    const res = await handlePatchCustomerDriver(
      makeJsonPatchRequest(payload),
      CUSTOMER_A_ID,
      DRIVER_1_ID,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
      }
    );
    assert.equal(res.status, 400);
  }

  assert.equal(queries.length, 0);
  assert.equal(updates.length, 0);
});

test('PATCH /api/customers/[id]/drivers/[driverId] enforces cross-agency and customer-driver isolation with 404 and safe DB error mapping', async () => {
  // Foreign-agency customer -> 404 without attempting update on customer_drivers
  const foreignCustomerMock = makeMockDriversSupabase({
    customers: [CUSTOMER_B],
    drivers: SAMPLE_DRIVERS,
  });
  const foreignCustRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }, CUSTOMER_B_ID, DRIVER_1_ID),
    CUSTOMER_B_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', foreignCustomerMock.client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(foreignCustRes.status, 404);
  assert.equal(foreignCustomerMock.updates.length, 0);

  // Driver belonging to Agency B queried under Agency A customer -> 404
  const foreignDriverMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });
  const foreignDriverRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest(
      { is_active: false },
      CUSTOMER_A_ID,
      DRIVER_OTHER_AGENCY_ID
    ),
    CUSTOMER_A_ID,
    DRIVER_OTHER_AGENCY_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', foreignDriverMock.client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(foreignDriverRes.status, 404);
  assert.equal(foreignDriverMock.updates.length, 1);
  assert.equal(foreignDriverMock.updates[0].filters.agency_id, AGENCY_A_ID);
  assert.equal(foreignDriverMock.updates[0].filters.customer_id, CUSTOMER_A_ID);

  // Driver belonging to a different customer within the same agency -> 404
  const otherCustomerInAgencyA: CustomerRecord = {
    ...CUSTOMER_A,
    id: '77777777-8888-4999-8aaa-bbbbbbbbbbbb',
  };
  const wrongCustomerMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A, otherCustomerInAgencyA],
    drivers: SAMPLE_DRIVERS,
  });
  const wrongCustRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest(
      { is_active: false },
      otherCustomerInAgencyA.id,
      DRIVER_1_ID
    ),
    otherCustomerInAgencyA.id,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', wrongCustomerMock.client),
      isTrustedOrigin: () => true,
    }
  );
  assert.equal(wrongCustRes.status, 404);

  // RLS 42501 -> 403 and unexpected DB error -> safe 500
  const rlsMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
    updateError: {
      code: '42501',
      message: 'permission denied for table customer_drivers',
    },
  });
  const rlsRes = await updateCustomerDriverWithClient(rlsMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: CUSTOMER_A_ID,
    driverId: DRIVER_1_ID,
    role: 'owner',
    patch: { is_active: false },
  });
  assert.equal(rlsRes.status, 403);
  assert.equal(rlsRes.error?.includes('permission denied'), false);

  const dbErrMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
    updateError: {
      code: '08006',
      message: 'internal database socket dropped',
    },
  });
  const dbErrRes = await updateCustomerDriverWithClient(dbErrMock.client, {
    agencyId: AGENCY_A_ID,
    customerId: CUSTOMER_A_ID,
    driverId: DRIVER_1_ID,
    role: 'owner',
    patch: { is_active: false },
  });
  assert.equal(dbErrRes.status, 500);
  assert.equal(dbErrRes.error?.includes('socket dropped'), false);
});

test('driver API routes preserve GET/POST, expose only PATCH on [driverId], enforce CSRF/no-store/RLS, rely on DB audit trigger, and never log PII or use service_role', () => {
  const collectionRouteSrc = fs.readFileSync(
    path.join(ROOT, 'app/api/customers/[id]/drivers/route.ts'),
    'utf8'
  );
  const itemRouteSrc = fs.readFileSync(
    path.join(ROOT, 'app/api/customers/[id]/drivers/[driverId]/route.ts'),
    'utf8'
  );
  const serverSrc = fs.readFileSync(
    path.join(ROOT, 'lib/drivers/server.ts'),
    'utf8'
  );
  const validationSrc = fs.readFileSync(
    path.join(ROOT, 'lib/drivers/validation.ts'),
    'utf8'
  );

  // Collection route preserves GET and POST only
  assert.match(collectionRouteSrc, /export async function GET\b/);
  assert.match(collectionRouteSrc, /export async function POST\b/);
  assert.doesNotMatch(
    collectionRouteSrc,
    /export async function (PATCH|PUT|DELETE)\b/
  );
  assert.match(collectionRouteSrc, /export const dynamic = 'force-dynamic';/);

  // Item route exposes ONLY PATCH (no DELETE/PUT/POST/GET)
  assert.match(itemRouteSrc, /export async function PATCH\b/);
  assert.doesNotMatch(
    itemRouteSrc,
    /export async function (GET|POST|PUT|DELETE)\b/
  );
  assert.match(itemRouteSrc, /export const dynamic = 'force-dynamic';/);

  // No service_role, no console logging, no manual audit_logs inserts (DB trigger owns audit)
  for (const src of [collectionRouteSrc, itemRouteSrc, serverSrc, validationSrc]) {
    assert.doesNotMatch(src, /service_role|SUPABASE_SERVICE_ROLE_KEY/i);
    assert.doesNotMatch(src, /console\.(log|info|warn|error|debug)/);
    assert.doesNotMatch(src, /audit_logs/);
  }

  // Uses existing Supabase Auth SSR agency resolver, trusted-origin check, and NO_STORE_CACHE_HEADERS
  assert.match(serverSrc, /resolveAuthenticatedAgencyForApi/);
  assert.match(serverSrc, /isTrustedOriginRequest/);
  assert.match(serverSrc, /NO_STORE_CACHE_HEADERS/);
  assert.match(serverSrc, /getAgencyCustomerByIdWithClient/);
});

test('Phase 6B.4A (mocked trigger): modifying full_name, licence_issuing_country, licence_category, or licence_expires_on on a verified driver resets verification_status to unverified, recalculates eligibility, and emits verification_status_changed audit event', async () => {
  const materialCases: Array<{
    label: string;
    patch: Record<string, unknown>;
  }> = [
    { label: 'licence_expires_on', patch: { licence_expires_on: '2031-05-01' } },
    { label: 'licence_category', patch: { licence_category: 'BE' } },
    { label: 'licence_issuing_country', patch: { licence_issuing_country: 'FR' } },
    { label: 'full_name', patch: { full_name: 'Youssef Ben Mansour' } },
  ];

  for (const tc of materialCases) {
    const { client, auditEvents } = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: SAMPLE_DRIVERS,
    });

    const response = await handlePatchCustomerDriver(
      makeJsonPatchRequest(tc.patch, CUSTOMER_A_ID, DRIVER_1_ID),
      CUSTOMER_A_ID,
      DRIVER_1_ID,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
        now: REF_NOW,
      }
    );

    assert.equal(response.status, 200, `Expected 200 for ${tc.label}`);
    const body = (await response.json()) as {
      ok: boolean;
      driver: {
        verification_status: string;
        eligibility: { status: string; flags: Array<{ code: string }> };
      };
    };

    assert.equal(body.ok, true);
    // PATCH response returns the persisted DB-invalidated status ('unverified')
    assert.equal(
      body.driver.verification_status,
      'unverified',
      `Expected verified -> unverified reset when ${tc.label} changed`
    );
    // Eligibility immediately reflects unverified state
    assert.equal(body.driver.eligibility.status, 'attention_required');
    assert.equal(
      body.driver.eligibility.flags.some(
        (f) => f.code === 'verification_unverified'
      ),
      true
    );

    // Transactional audit trigger sees verified -> unverified transition
    assert.equal(auditEvents.length, 1);
    assert.equal(
      auditEvents[0].action,
      'customer_driver.verification_status_changed'
    );
    assert.equal(auditEvents[0].from_verification_status, 'verified');
    assert.equal(auditEvents[0].to_verification_status, 'unverified');
  }
});

test('Phase 6B.4A: simultaneous material edit + verification_status=verified is rejected at PATCH validation (400) and DB trigger constraint (23514) without emitting audit logs', async () => {
  const combinedPayloads: Array<Record<string, unknown>> = [
    { licence_expires_on: '2030-01-01', verification_status: 'verified' },
    { licence_category: 'BE', verification_status: 'verified' },
    { licence_issuing_country: 'MA', verification_status: 'verified' },
    { full_name: 'Amira Ben Ali', verification_status: 'verified' },
  ];

  // 1. API validation layer rejects every combination before hitting DB (both verified & non-verified drivers)
  for (const targetDriverId of [DRIVER_1_ID, DRIVER_2_ID]) {
    for (const payload of combinedPayloads) {
      const { client, updates, auditEvents } = makeMockDriversSupabase({
        customers: [CUSTOMER_A],
        drivers: SAMPLE_DRIVERS,
      });

      const res = await handlePatchCustomerDriver(
        makeJsonPatchRequest(payload, CUSTOMER_A_ID, targetDriverId),
        CUSTOMER_A_ID,
        targetDriverId,
        {
          resolveAuth: async () => makeAuthCtx('owner', client),
          isTrustedOrigin: () => true,
          now: REF_NOW,
        }
      );

      assert.equal(res.status, 400);
      assert.equal(updates.length, 0);
      assert.equal(auditEvents.length, 0);
      const body = (await res.json()) as {
        ok: boolean;
        error: string;
        fieldErrors?: Record<string, string>;
      };
      assert.equal(body.ok, false);
      assert.ok(body.fieldErrors?.verification_status);
    }
  }

  // 2. Direct call bypassing API validation hits migration 0008 DB trigger (SQLSTATE 23514) -> mapped safely to 400
  const dbTriggerMock = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });
  const directDbRes = await updateCustomerDriverWithClient(
    dbTriggerMock.client,
    {
      agencyId: AGENCY_A_ID,
      customerId: CUSTOMER_A_ID,
      driverId: DRIVER_2_ID, // pending -> verified + licence change
      role: 'owner',
      patch: {
        licence_expires_on: '2031-01-01',
        verification_status: 'verified',
      },
      now: REF_NOW,
    }
  );
  assert.equal(directDbRes.status, 400);
  assert.equal(directDbRes.driver, null);
  assert.ok(directDbRes.fieldErrors?.verification_status);
  assert.equal(
    directDbRes.error?.includes('customer_drivers_verification_integrity_check'),
    false
  );
  assert.equal(dbTriggerMock.auditEvents.length, 0);
});

test('Phase 6B.4A (mocked trigger): verification_notes-only and is_active-only updates preserve verified status and emit accurate audit actions', async () => {
  const { client, auditEvents } = makeMockDriversSupabase({
    customers: [CUSTOMER_A],
    drivers: SAMPLE_DRIVERS,
  });

  // 1. Update verification_notes only on verified driver -> stays verified
  const notesEditRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest(
      { verification_notes: 'Contrôle complémentaire archivé.' },
      CUSTOMER_A_ID,
      DRIVER_1_ID
    ),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(notesEditRes.status, 200);
  const notesEditBody = (await notesEditRes.json()) as {
    driver: { verification_status: string; verification_notes: string | null };
  };
  assert.equal(notesEditBody.driver.verification_status, 'verified');
  assert.equal(
    notesEditBody.driver.verification_notes,
    'Contrôle complémentaire archivé.'
  );
  assert.equal(auditEvents[0].action, 'customer_driver.updated');

  // 2. Clear verification_notes with null -> stays verified
  const notesClearRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest(
      { verification_notes: null },
      CUSTOMER_A_ID,
      DRIVER_1_ID
    ),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('manager', client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(notesClearRes.status, 200);
  const notesClearBody = (await notesClearRes.json()) as {
    driver: { verification_status: string; verification_notes: string | null };
  };
  assert.equal(notesClearBody.driver.verification_status, 'verified');
  assert.equal(notesClearBody.driver.verification_notes, null);
  assert.equal(auditEvents[1].action, 'customer_driver.updated');

  // 3. Deactivate verified driver -> stays verified, audit action deactivated
  const deactivateRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: false }, CUSTOMER_A_ID, DRIVER_1_ID),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('owner', client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(deactivateRes.status, 200);
  const deactivateBody = (await deactivateRes.json()) as {
    driver: { verification_status: string; is_active: boolean };
  };
  assert.equal(deactivateBody.driver.verification_status, 'verified');
  assert.equal(deactivateBody.driver.is_active, false);
  assert.equal(auditEvents[2].action, 'customer_driver.deactivated');

  // 4. Reactivate verified driver -> stays verified, audit action reactivated
  const reactivateRes = await handlePatchCustomerDriver(
    makeJsonPatchRequest({ is_active: true }, CUSTOMER_A_ID, DRIVER_1_ID),
    CUSTOMER_A_ID,
    DRIVER_1_ID,
    {
      resolveAuth: async () => makeAuthCtx('manager', client),
      isTrustedOrigin: () => true,
      now: REF_NOW,
    }
  );
  assert.equal(reactivateRes.status, 200);
  const reactivateBody = (await reactivateRes.json()) as {
    driver: { verification_status: string; is_active: boolean };
  };
  assert.equal(reactivateBody.driver.verification_status, 'verified');
  assert.equal(reactivateBody.driver.is_active, true);
  assert.equal(auditEvents[3].action, 'customer_driver.reactivated');
});

test('Phase 6B.4A (mocked trigger): pending and rejected drivers preserve status across material edits and are never unintentionally converted into verified', async () => {
  const rejectedDriver: CustomerDriverRecord = {
    ...SAMPLE_DRIVERS[1],
    id: '88888888-9999-4aaa-8bbb-cccccccccccc',
    verification_status: 'rejected',
  };

  for (const driver of [SAMPLE_DRIVERS[1], rejectedDriver]) {
    const initialStatus = driver.verification_status;
    const { client, auditEvents } = makeMockDriversSupabase({
      customers: [CUSTOMER_A],
      drivers: [driver],
    });

    const editRes = await handlePatchCustomerDriver(
      makeJsonPatchRequest(
        {
          full_name: `${driver.full_name} Modifié`,
          licence_expires_on: '2030-12-31',
        },
        CUSTOMER_A_ID,
        driver.id
      ),
      CUSTOMER_A_ID,
      driver.id,
      {
        resolveAuth: async () => makeAuthCtx('owner', client),
        isTrustedOrigin: () => true,
        now: REF_NOW,
      }
    );

    assert.equal(editRes.status, 200);
    const editBody = (await editRes.json()) as {
      driver: { verification_status: string };
    };
    assert.equal(editBody.driver.verification_status, initialStatus);
    assert.notEqual(editBody.driver.verification_status, 'verified');
    assert.equal(auditEvents.length, 1);
    assert.equal(auditEvents[0].action, 'customer_driver.updated');
    assert.equal(auditEvents[0].from_verification_status, initialStatus);
    assert.equal(auditEvents[0].to_verification_status, initialStatus);
  }
});



