import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  buildCreateDriverRequestBody,
  buildDriverDetailsPatchPayload,
  buildDriverVerificationPatchPayload,
  createCustomerDriversController,
  createDriverSingleFlightGuard,
  createEmptyDriverFormValues,
  driverRecordToDetailsFormValues,
  driverRecordToVerificationFormValues,
  fetchCustomerDrivers,
  formatDriverExpiryDate,
  hasDriverLicenceMetadataChanged,
  hasDriverVerificationSensitiveDetailsChanged,
  INITIAL_CUSTOMER_DRIVERS_STATE,
  sanitizeDriversForRole,
  submitCreateCustomerDriver,
  submitToggleDriverActive,
  submitUpdateDriverDetails,
  submitUpdateDriverVerification,
  type CreateCustomerDriverFormValues,
  type CustomerDriverClientItem,
  type CustomerDriversViewState,
  type DriverVerificationFormValues,
  type EditDriverDetailsFormValues,
  type FetchLike,
} from './client';
import { canManageCustomerDrivers } from './types';
import {
  evaluateDriverEligibility,
  summarizeCustomerDriversEligibility,
} from './eligibility';
import type {
  DriverEligibilityFlagCode,
  DriverEligibilityPrecheckStatus,
  DriverVerificationStatus,
} from './types';
import { DICTIONARIES, SUPPORTED_LOCALES } from '../i18n/dictionaries';

const AGENCY_ID = '11111111-1111-4111-8111-111111111111';
const CUSTOMER_A_ID = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_B_ID = '33333333-3333-4333-8333-333333333333';
const USER_ID = '44444444-4444-4444-8444-444444444444';
const REFERENCE_NOW = new Date('2026-11-26T10:00:00Z');

function makeDriverItem(
  overrides: Partial<CustomerDriverClientItem> = {}
): CustomerDriverClientItem {
  const base = {
    id: '55555555-5555-4555-8555-555555555555',
    agency_id: AGENCY_ID,
    customer_id: CUSTOMER_A_ID,
    full_name: 'Youssef Trabelsi',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-06-30',
    verification_status: 'verified' as DriverVerificationStatus,
    verification_notes: 'Permis original vérifié en agence.',
    is_active: true,
    created_by: USER_ID,
    created_at: '2026-11-20T09:00:00Z',
    updated_at: '2026-11-21T09:00:00Z',
    ...overrides,
  };

  const eligibility =
    overrides.eligibility ??
    evaluateDriverEligibility(
      {
        licence_issuing_country: base.licence_issuing_country,
        licence_category: base.licence_category,
        licence_expires_on: base.licence_expires_on,
        verification_status: base.verification_status,
        is_active: base.is_active,
      },
      { now: REFERENCE_NOW, timeZone: 'Africa/Tunis' }
    );

  return {
    ...base,
    eligibility,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('1. Customer with no drivers loads honest empty state from GET /api/customers/[id]/drivers', async () => {
  const requestedUrls: string[] = [];
  const requestedCaches: (RequestCache | undefined)[] = [];

  const mockFetch: FetchLike = async (input, init) => {
    requestedUrls.push(String(input));
    requestedCaches.push(init?.cache);
    return jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [],
      summary: summarizeCustomerDriversEligibility([]),
    });
  };

  const states: CustomerDriversViewState[] = [];
  const controller = createCustomerDriversController(mockFetch, (s) =>
    states.push(s)
  );

  await controller.loadForCustomer(CUSTOMER_A_ID, 'owner');

  assert.deepEqual(requestedUrls, [`/api/customers/${CUSTOMER_A_ID}/drivers`]);
  assert.deepEqual(requestedCaches, ['no-store']);
  assert.equal(states.length, 2);
  assert.equal(states[0].status, 'loading');
  assert.equal(states[1].status, 'ready');
  assert.equal(states[1].customerId, CUSTOMER_A_ID);
  assert.deepEqual(states[1].drivers, []);
  assert.equal(states[1].summary?.totalDrivers, 0);
  assert.equal(states[1].error, null);
});

test('2. Customer with multiple authorized drivers renders all real driver records', async () => {
  const driver1 = makeDriverItem({
    id: '55555555-5555-4555-8555-555555555501',
    full_name: 'Amine Gharbi',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-05-15',
    verification_status: 'verified',
    is_active: true,
  });
  const driver2 = makeDriverItem({
    id: '55555555-5555-4555-8555-555555555502',
    full_name: 'Salma Mansouri',
    licence_issuing_country: 'FR',
    licence_category: 'B',
    licence_expires_on: '2027-01-10',
    verification_status: 'pending',
    is_active: true,
  });

  const mockFetch: FetchLike = async () =>
    jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [driver1, driver2],
      summary: summarizeCustomerDriversEligibility([driver1, driver2], {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    });

  const result = await fetchCustomerDrivers(CUSTOMER_A_ID, {
    fetchFn: mockFetch,
    role: 'owner',
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.drivers.length, 2);
    assert.equal(result.drivers[0].full_name, 'Amine Gharbi');
    assert.equal(result.drivers[1].full_name, 'Salma Mansouri');
    assert.equal(result.summary?.totalDrivers, 2);
    assert.equal(result.summary?.activeDrivers, 2);
  }
});

test('3. Loading, API error statuses (400, 401, 403, 404, 500), network failures, and retry recovery', async () => {
  // Invalid UUID rejected without network request
  let fetchCount = 0;
  const invalidResult = await fetchCustomerDrivers('not-a-uuid', {
    fetchFn: async () => {
      fetchCount += 1;
      return jsonResponse({});
    },
  });
  assert.equal(fetchCount, 0);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.status, 400);
  }

  for (const status of [400, 401, 403, 404, 500] as const) {
    const res = await fetchCustomerDrivers(CUSTOMER_A_ID, {
      fetchFn: async () =>
        jsonResponse({ ok: false, error: `Erreur ${status}` }, status),
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, status);
      assert.equal(res.error, `Erreur ${status}`);
    }
  }

  // Network failure then retry recovery via controller
  let attempt = 0;
  const states: CustomerDriversViewState[] = [];
  const controller = createCustomerDriversController(async () => {
    attempt += 1;
    if (attempt === 1) {
      throw new TypeError('Failed to fetch');
    }
    const recovered = makeDriverItem();
    return jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [recovered],
      summary: summarizeCustomerDriversEligibility([recovered], {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    });
  }, (s) => states.push(s));

  await controller.loadForCustomer(CUSTOMER_A_ID, 'manager');
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().errorStatus, 0);
  assert.match(controller.getState().error ?? '', /réseau/i);

  await controller.retry();
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().drivers.length, 1);
  assert.equal(states.some((s) => s.status === 'loading'), true);
});

test('4. Switching customers cancels previous fetch and discards stale out-of-order responses; closing resets state', async () => {
  const deferredFirst: { resolve?: (res: Response) => void } = {};
  let firstSignal: AbortSignal | undefined;
  let secondSignal: AbortSignal | undefined;

  const driverA = makeDriverItem({
    id: '55555555-5555-4555-8555-555555555511',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Client A Driver',
  });
  const driverB = makeDriverItem({
    id: '55555555-5555-4555-8555-555555555522',
    customer_id: CUSTOMER_B_ID,
    full_name: 'Client B Driver',
  });

  const mockFetch: FetchLike = (input, init) => {
    const url = String(input);
    if (url.includes(CUSTOMER_A_ID)) {
      firstSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        deferredFirst.resolve = resolve;
      });
    }
    secondSignal = init?.signal ?? undefined;
    return Promise.resolve(
      jsonResponse({
        ok: true,
        customer_id: CUSTOMER_B_ID,
        drivers: [driverB],
        summary: summarizeCustomerDriversEligibility([driverB], {
          now: REFERENCE_NOW,
          timeZone: 'Africa/Tunis',
        }),
      })
    );
  };

  const controller = createCustomerDriversController(mockFetch, () => {});

  const firstPromise = controller.loadForCustomer(CUSTOMER_A_ID, 'owner');
  assert.equal(controller.getState().status, 'loading');
  assert.equal(controller.getState().customerId, CUSTOMER_A_ID);

  // Switch immediately to Customer B while Customer A is still pending
  await controller.loadForCustomer(CUSTOMER_B_ID, 'owner');
  assert.equal(firstSignal?.aborted, true);
  assert.equal(secondSignal?.aborted, false);
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().customerId, CUSTOMER_B_ID);
  assert.equal(controller.getState().drivers[0]?.full_name, 'Client B Driver');

  // Resolve the stale Customer A request late — must NOT overwrite Customer B
  deferredFirst.resolve?.(
    jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [driverA],
      summary: summarizeCustomerDriversEligibility([driverA], {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    })
  );
  await firstPromise;

  assert.equal(controller.getState().customerId, CUSTOMER_B_ID);
  assert.equal(controller.getState().drivers[0]?.full_name, 'Client B Driver');

  // Closing the drawer resets cleanly to initial state
  controller.close();
  assert.deepEqual(controller.getState(), INITIAL_CUSTOMER_DRIVERS_STATE);
});

test('5. Active and inactive driver statuses surface accurate operational indicators', () => {
  const activeDriver = makeDriverItem({
    is_active: true,
    verification_status: 'verified',
    licence_expires_on: '2029-12-31',
  });
  const inactiveDriver = makeDriverItem({
    is_active: false,
    verification_status: 'verified',
    licence_expires_on: '2029-12-31',
  });

  assert.equal(activeDriver.is_active, true);
  assert.equal(
    activeDriver.eligibility.status,
    'checks_passed_manual_review_required'
  );

  assert.equal(inactiveDriver.is_active, false);
  assert.equal(inactiveDriver.eligibility.status, 'blocked');
  assert.equal(
    inactiveDriver.eligibility.flags.some(
      (flag) => flag.code === 'driver_inactive' && flag.severity === 'blocking'
    ),
    true
  );
});

test('6. Expired licence triggers blocking eligibility warning and stable date formatting', () => {
  const expiredDriver = makeDriverItem({
    licence_expires_on: '2026-10-01',
    verification_status: 'verified',
    is_active: true,
  });

  assert.equal(expiredDriver.eligibility.status, 'blocked');
  assert.equal(expiredDriver.eligibility.licenceExpiryStatus, 'expired');
  assert.ok((expiredDriver.eligibility.daysUntilExpiry ?? 0) < 0);
  assert.equal(
    expiredDriver.eligibility.flags.some(
      (flag) => flag.code === 'licence_expired' && flag.severity === 'blocking'
    ),
    true
  );

  const formattedFr = formatDriverExpiryDate('2026-10-01', 'fr');
  const formattedEn = formatDriverExpiryDate('2026-10-01', 'en');
  assert.ok(formattedFr && formattedFr.includes('2026'));
  assert.ok(formattedEn && formattedEn.includes('2026'));
  assert.equal(formatDriverExpiryDate(null, 'fr'), null);
});

test('7. Unverified and rejected drivers expose operational warnings and legal non-proof flag', () => {
  const unverifiedDriver = makeDriverItem({
    verification_status: 'unverified',
    licence_expires_on: '2029-08-01',
  });
  const rejectedDriver = makeDriverItem({
    verification_status: 'rejected',
    licence_expires_on: '2029-08-01',
  });

  assert.equal(unverifiedDriver.eligibility.status, 'attention_required');
  assert.equal(
    unverifiedDriver.eligibility.requiresCountrySpecificVerification,
    true
  );
  assert.equal(
    unverifiedDriver.eligibility.flags.some(
      (flag) => flag.code === 'verification_unverified'
    ),
    true
  );

  assert.equal(rejectedDriver.eligibility.status, 'blocked');
  assert.equal(
    rejectedDriver.eligibility.requiresCountrySpecificVerification,
    true
  );
  assert.equal(
    rejectedDriver.eligibility.flags.some(
      (flag) =>
        flag.code === 'verification_rejected' && flag.severity === 'blocking'
    ),
    true
  );
});

test('8. Agent privacy restrictions: verification_notes stripped for agents and strictly gated in UI', async () => {
  const rawDriverWithNotes = makeDriverItem({
    verification_notes: 'Note interne confidentielle manager.',
  });

  // Defense-in-depth sanitizer strips verification_notes for agent
  const agentSanitized = sanitizeDriversForRole([rawDriverWithNotes], 'agent');
  assert.equal('verification_notes' in agentSanitized[0], false);
  assert.equal(agentSanitized[0].verification_notes, undefined);

  // Preserved for owner & manager
  const ownerSanitized = sanitizeDriversForRole([rawDriverWithNotes], 'owner');
  const managerSanitized = sanitizeDriversForRole(
    [rawDriverWithNotes],
    'manager'
  );
  assert.equal(
    ownerSanitized[0].verification_notes,
    'Note interne confidentielle manager.'
  );
  assert.equal(
    managerSanitized[0].verification_notes,
    'Note interne confidentielle manager.'
  );

  // Also verified through fetchCustomerDrivers
  const agentFetchResult = await fetchCustomerDrivers(CUSTOMER_A_ID, {
    role: 'agent',
    fetchFn: async () =>
      jsonResponse({
        ok: true,
        customer_id: CUSTOMER_A_ID,
        drivers: [rawDriverWithNotes],
        summary: summarizeCustomerDriversEligibility([rawDriverWithNotes], {
          now: REFERENCE_NOW,
          timeZone: 'Africa/Tunis',
        }),
      }),
  });
  assert.equal(agentFetchResult.ok, true);
  if (agentFetchResult.ok) {
    assert.equal('verification_notes' in agentFetchResult.drivers[0], false);
  }

  // Static audit of CustomerDriversSection component
  const sectionSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'components/customers/customer-drivers-section.tsx'
    ),
    'utf8'
  );
  assert.match(sectionSource, /canManageCustomerDrivers\(role\)/);
  assert.doesNotMatch(sectionSource, /@\/lib\/supabase\/(client|server)/);
  assert.doesNotMatch(sectionSource, /service_role/i);
  assert.doesNotMatch(sectionSource, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(sectionSource, /method:\s*['"](POST|PATCH|DELETE)['"]/);
});

test('9. Customer Details drawer integration regression and FR/EN/AR translation completeness', () => {
  const drawerSource = fs.readFileSync(
    path.join(process.cwd(), 'components/customers/customer-detail-drawer.tsx'),
    'utf8'
  );
  const directorySource = fs.readFileSync(
    path.join(process.cwd(), 'components/customers/customers-directory.tsx'),
    'utf8'
  );

  // CustomerDetailDrawer renders CustomerDriversSection while preserving edit & existing sections
  assert.match(drawerSource, /import \{ CustomerDriversSection \} from '\.\/customer-drivers-section'/);
  assert.match(drawerSource, /<CustomerDriversSection[\s\S]*customerId=\{customer\.id\}[\s\S]*role=\{role\}/);
  assert.match(drawerSource, /<EditCustomerForm/);
  assert.match(drawerSource, /createCustomerDetailController/);

  // CustomersDirectory passes role into CustomerDetailDrawer
  assert.match(directorySource, /<CustomerDetailDrawer[\s\S]*role=\{role\}/);

  // FR/EN/AR translations cover every status and flag code
  const verificationStatuses: DriverVerificationStatus[] = [
    'unverified',
    'pending',
    'verified',
    'rejected',
  ];
  const eligibilityStatuses: DriverEligibilityPrecheckStatus[] = [
    'blocked',
    'attention_required',
    'checks_passed_manual_review_required',
  ];
  const flagCodes: DriverEligibilityFlagCode[] = [
    'driver_inactive',
    'licence_expiry_missing',
    'licence_expired',
    'licence_expires_during_rental',
    'licence_expiring_soon',
    'verification_unverified',
    'verification_pending',
    'verification_rejected',
    'licence_category_missing',
    'licence_category_mismatch',
    'issuing_country_missing',
    'foreign_licence_manual_check',
  ];

  for (const locale of SUPPORTED_LOCALES) {
    const driversDict = DICTIONARIES[locale].customersDirectory.detailDrawer.drivers;
    assert.ok(driversDict.sectionTitle.trim().length > 0);
    assert.ok(driversDict.emptyTitle.trim().length > 0);
    assert.ok(driversDict.legalNotice.trim().length > 0);

    for (const status of verificationStatuses) {
      assert.ok(driversDict.verificationStatuses[status].trim().length > 0);
    }
    for (const status of eligibilityStatuses) {
      assert.ok(driversDict.eligibilityStatuses[status].trim().length > 0);
    }
    for (const code of flagCodes) {
      assert.ok(driversDict.flagMessages[code].trim().length > 0);
    }
  }
});

test('10. Add Driver POST submits strictly the 4 allowed fields and confirms HTTP 201 with Unverified status', async () => {
  let capturedUrl = '';
  let capturedMethod = '';
  let capturedBody: Record<string, unknown> | null = null;

  const createdDriver = makeDriverItem({
    id: '66666666-6666-4666-8666-666666666666',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Nadia Ben Salem',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2030-09-15',
    verification_status: 'unverified',
    verification_notes: undefined,
    is_active: true,
  });

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = String(input);
    capturedMethod = init?.method ?? '';
    capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<
      string,
      unknown
    >;
    return jsonResponse({ ok: true, driver: createdDriver }, 201);
  };

  // Even if caller passes extra forbidden fields via type cast, they MUST never be sent
  const dirtyValues = {
    full_name: '  Nadia   Ben Salem ',
    licence_issuing_country: 'tn',
    licence_category: ' b ',
    licence_expires_on: '2030-09-15',
    agency_id: '99999999-9999-4999-8999-999999999999',
    created_by: '88888888-8888-4888-8888-888888888888',
    verification_status: 'verified',
    is_active: false,
  } as unknown as CreateCustomerDriverFormValues;

  const result = await submitCreateCustomerDriver(CUSTOMER_A_ID, dirtyValues, {
    fetchFn: mockFetch,
  });

  assert.equal(capturedUrl, `/api/customers/${CUSTOMER_A_ID}/drivers`);
  assert.equal(capturedMethod, 'POST');
  assert.deepEqual(Object.keys(capturedBody ?? {}).sort(), [
    'full_name',
    'licence_category',
    'licence_expires_on',
    'licence_issuing_country',
  ]);
  assert.deepEqual(capturedBody, {
    full_name: 'Nadia Ben Salem',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2030-09-15',
  });
  assert.equal('agency_id' in (capturedBody ?? {}), false);
  assert.equal('created_by' in (capturedBody ?? {}), false);
  assert.equal('verification_status' in (capturedBody ?? {}), false);
  assert.equal('is_active' in (capturedBody ?? {}), false);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, 201);
    assert.equal(result.driver.verification_status, 'unverified');
    assert.equal(result.driver.is_active, true);
    assert.equal(result.driver.eligibility.status, 'attention_required');
  }
});

test('11. Add Driver client validation reuses driver validation helpers and normalizes optional empty fields to null', async () => {
  let fetchCalled = false;
  const guardFetch: FetchLike = async () => {
    fetchCalled = true;
    return jsonResponse({}, 201);
  };

  // Missing required full_name
  const emptyResult = await submitCreateCustomerDriver(
    CUSTOMER_A_ID,
    createEmptyDriverFormValues(),
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCalled, false);
  assert.equal(emptyResult.ok, false);
  if (!emptyResult.ok) {
    assert.equal(emptyResult.status, 400);
    assert.ok(emptyResult.fieldErrors.full_name);
  }

  // Invalid optional metadata rejected before hitting network
  const invalidOptionalResult = await submitCreateCustomerDriver(
    CUSTOMER_A_ID,
    {
      full_name: 'Karim Haddad',
      licence_issuing_country: 'TUN',
      licence_category: 'INVALID CATEGORY!',
      licence_expires_on: '2026-02-30',
    },
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCalled, false);
  assert.equal(invalidOptionalResult.ok, false);
  if (!invalidOptionalResult.ok) {
    assert.ok(invalidOptionalResult.fieldErrors.licence_issuing_country);
    assert.ok(invalidOptionalResult.fieldErrors.licence_category);
    assert.ok(invalidOptionalResult.fieldErrors.licence_expires_on);
  }

  // Optional fields left blank normalize cleanly to null
  const minimalBody = buildCreateDriverRequestBody({
    full_name: 'Karim Haddad',
    licence_issuing_country: '',
    licence_category: '',
    licence_expires_on: '',
  });
  assert.deepEqual(minimalBody, {
    full_name: 'Karim Haddad',
    licence_issuing_country: null,
    licence_category: null,
    licence_expires_on: null,
  });
});

test('12. Add Driver POST handles 400 fieldErrors, 401/403/404/500 API errors, non-201, abort, and network errors', async () => {
  const validValues: CreateCustomerDriverFormValues = {
    full_name: 'Mehdi Khelifi',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-01-01',
  };

  // HTTP 400 with fieldErrors filtered strictly to allowed fields
  const res400 = await submitCreateCustomerDriver(CUSTOMER_A_ID, validValues, {
    fetchFn: async () =>
      jsonResponse(
        {
          ok: false,
          error: 'Validation échouée.',
          fieldErrors: {
            full_name: 'Nom invalide.',
            verification_status: 'Should be stripped',
          },
        },
        400
      ),
  });
  assert.equal(res400.ok, false);
  if (!res400.ok) {
    assert.equal(res400.status, 400);
    assert.equal(res400.fieldErrors.full_name, 'Nom invalide.');
    assert.equal('verification_status' in res400.fieldErrors, false);
  }

  // HTTP 401, 403 (Agent forbidden), 404, 500
  for (const status of [401, 403, 404, 500] as const) {
    const res = await submitCreateCustomerDriver(CUSTOMER_A_ID, validValues, {
      fetchFn: async () =>
        jsonResponse({ ok: false, error: `Refus ${status}` }, status),
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, status);
      assert.equal(res.error, `Refus ${status}`);
    }
  }

  // Non-201 HTTP 200 is NOT treated as confirmed creation
  const res200 = await submitCreateCustomerDriver(CUSTOMER_A_ID, validValues, {
    fetchFn: async () =>
      jsonResponse({ ok: true, driver: makeDriverItem() }, 200),
  });
  assert.equal(res200.ok, false);

  // Network failure
  const networkRes = await submitCreateCustomerDriver(
    CUSTOMER_A_ID,
    validValues,
    {
      fetchFn: async () => {
        throw new TypeError('Network down');
      },
    }
  );
  assert.equal(networkRes.ok, false);
  if (!networkRes.ok) {
    assert.equal(networkRes.status, 0);
    assert.match(networkRes.error, /réseau/i);
  }

  // Aborted request (e.g. customer switch or form unmount)
  const abortController = new AbortController();
  abortController.abort();
  const abortRes = await submitCreateCustomerDriver(CUSTOMER_A_ID, validValues, {
    signal: abortController.signal,
    fetchFn: async () => {
      const err = new Error('Aborted');
      err.name = 'AbortError';
      throw err;
    },
  });
  assert.equal(abortRes.ok, false);
  if (!abortRes.ok) {
    assert.equal(abortRes.aborted, true);
  }
});

test('13. Single-flight guard blocks duplicate concurrent Add Driver submissions until released', () => {
  const guard = createDriverSingleFlightGuard();
  assert.equal(guard.isLocked(), false);
  assert.equal(guard.tryAcquire(), true);
  assert.equal(guard.isLocked(), true);
  assert.equal(guard.tryAcquire(), false);
  guard.release();
  assert.equal(guard.isLocked(), false);
  assert.equal(guard.tryAcquire(), true);
  guard.release();
});

test('14. Confirmed HTTP 201 creation refreshes real driver list displaying newly created driver as Unverified', async () => {
  const persistedDrivers: CustomerDriverClientItem[] = [];
  const createdDriver = makeDriverItem({
    id: '77777777-7777-4777-8777-777777777777',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Sonia Jaziri',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-11-30',
    verification_status: 'unverified',
    verification_notes: undefined,
    is_active: true,
  });

  const mockFetch: FetchLike = async (_input, init) => {
    if (init?.method === 'POST') {
      persistedDrivers.push(createdDriver);
      return jsonResponse({ ok: true, driver: createdDriver }, 201);
    }
    return jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [...persistedDrivers],
      summary: summarizeCustomerDriversEligibility(persistedDrivers, {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    });
  };

  const controller = createCustomerDriversController(mockFetch, () => {});
  await controller.loadForCustomer(CUSTOMER_A_ID, 'owner');
  assert.equal(controller.getState().drivers.length, 0);

  const postResult = await submitCreateCustomerDriver(
    CUSTOMER_A_ID,
    {
      full_name: 'Sonia Jaziri',
      licence_issuing_country: 'TN',
      licence_category: 'B',
      licence_expires_on: '2029-11-30',
    },
    { fetchFn: mockFetch }
  );
  assert.equal(postResult.ok, true);

  await controller.retry();
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().drivers.length, 1);
  assert.equal(controller.getState().drivers[0]?.full_name, 'Sonia Jaziri');
  assert.equal(
    controller.getState().drivers[0]?.verification_status,
    'unverified'
  );
});

test('15. Add Driver UI preserves Owner/Manager RBAC, security boundaries, and FR/EN/AR translations', () => {
  const sectionSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'components/customers/customer-drivers-section.tsx'
    ),
    'utf8'
  );
  const addFormSource = fs.readFileSync(
    path.join(process.cwd(), 'components/customers/add-driver-form.tsx'),
    'utf8'
  );

  // Add button & AddDriverForm strictly gated behind canManageCustomerDrivers(role)
  assert.match(sectionSource, /const canManageDrivers = canManageCustomerDrivers\(role\)/);
  assert.match(sectionSource, /canManageDrivers && !isAddFormOpen/);
  assert.match(sectionSource, /canManageDrivers &&[\s\S]*activePanel\?\.kind === 'add'/);
  assert.match(sectionSource, /<AddDriverForm[\s\S]*key=\{customerId\}/);
  assert.match(sectionSource, /activeCustomerIdRef\.current !== customerId/);

  // AddDriverForm uses submitCreateCustomerDriver, single-flight guard, AbortController, no direct DB / service_role / PATCH
  assert.match(addFormSource, /submitCreateCustomerDriver/);
  assert.match(addFormSource, /createDriverSingleFlightGuard/);
  assert.match(addFormSource, /new AbortController\(\)/);
  assert.doesNotMatch(addFormSource, /@\/lib\/supabase\/(client|server)/);
  assert.doesNotMatch(addFormSource, /service_role/i);
  assert.doesNotMatch(addFormSource, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(addFormSource, /method:\s*['"](PATCH|DELETE)['"]/);
  assert.doesNotMatch(addFormSource, /verification_status|agency_id|created_by|is_active/);

  // FR/EN/AR translations complete for addForm
  for (const locale of SUPPORTED_LOCALES) {
    const addForm = DICTIONARIES[locale].customersDirectory.detailDrawer.drivers.addForm;
    assert.ok(addForm.addButtonLabel.trim().length > 0);
    assert.ok(addForm.title.trim().length > 0);
    assert.ok(addForm.subtitle.trim().length > 0);
    assert.ok(addForm.fullNameLabel.trim().length > 0);
    assert.ok(addForm.issuingCountryLabel.trim().length > 0);
    assert.ok(addForm.licenceCategoryLabel.trim().length > 0);
    assert.ok(addForm.licenceExpiresOnLabel.trim().length > 0);
    assert.ok(addForm.submitLabel.trim().length > 0);
    assert.ok(addForm.cancelLabel.trim().length > 0);
    assert.ok(addForm.createSuccessBanner.trim().length > 0);
  }

  // Exact French primary button copy requirement
  assert.equal(
    DICTIONARIES.fr.customersDirectory.detailDrawer.drivers.addForm.addButtonLabel,
    'Ajouter un conducteur'
  );
});

test('16. Edit Driver RBAC: Owner and Manager can edit; Agent remains strictly read-only', () => {
  assert.equal(canManageCustomerDrivers('owner'), true);
  assert.equal(canManageCustomerDrivers('manager'), true);
  assert.equal(canManageCustomerDrivers('agent'), false);

  const sectionSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'components/customers/customer-drivers-section.tsx'
    ),
    'utf8'
  );
  // Modifier button and EditDriverForm gated behind canManageDrivers
  assert.match(sectionSource, /canManageDrivers \? \([\s\S]*handleOpenEditForm\(driver\.id\)/);
  assert.match(
    sectionSource,
    /canManageDrivers &&[\s\S]*activePanel\?\.kind === 'edit'/
  );
  assert.equal(
    DICTIONARIES.fr.customersDirectory.detailDrawer.drivers.editForm.editButtonLabel,
    'Modifier'
  );
});

test('17. Edit Driver form prefills accurately and detects verified-driver licence metadata changes', () => {
  const verifiedDriver = makeDriverItem({
    full_name: 'Rami Chaabane',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-04-20',
    verification_status: 'verified',
  });

  const prefilled = driverRecordToDetailsFormValues(verifiedDriver);
  assert.deepEqual(prefilled, {
    full_name: 'Rami Chaabane',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-04-20',
  });

  // Name-only change does NOT flag licence metadata change
  assert.equal(
    hasDriverLicenceMetadataChanged(verifiedDriver, {
      ...prefilled,
      full_name: 'Rami M. Chaabane',
    }),
    false
  );

  // Changing expiry, country, or category flags licence metadata change
  assert.equal(
    hasDriverLicenceMetadataChanged(verifiedDriver, {
      ...prefilled,
      licence_expires_on: '2031-04-20',
    }),
    true
  );
  assert.equal(
    hasDriverLicenceMetadataChanged(verifiedDriver, {
      ...prefilled,
      licence_issuing_country: 'FR',
    }),
    true
  );
  assert.equal(
    hasDriverLicenceMetadataChanged(verifiedDriver, {
      ...prefilled,
      licence_category: '',
    }),
    true
  );

  // Null optional fields prefill as empty strings
  const sparseDriver = makeDriverItem({
    licence_issuing_country: null,
    licence_category: null,
    licence_expires_on: null,
  });
  assert.deepEqual(driverRecordToDetailsFormValues(sparseDriver), {
    full_name: sparseDriver.full_name,
    licence_issuing_country: '',
    licence_category: '',
    licence_expires_on: '',
  });
});

test('18. Edit Driver PATCH sends ONLY modified permitted fields and supports null clearing for optional fields', async () => {
  const driver = makeDriverItem({
    id: '88888888-8888-4888-8888-888888888881',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Ines Karray',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2028-12-31',
    verification_status: 'verified',
  });

  // 1) Partial update: change ONLY full_name -> omitted fields NOT sent
  const nameOnlyDiff = buildDriverDetailsPatchPayload(driver, {
    full_name: '  Ines   Karray-Ben Ali ',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2028-12-31',
  });
  assert.equal(nameOnlyDiff.valid, true);
  assert.equal(nameOnlyDiff.hasChanges, true);
  assert.equal(nameOnlyDiff.licenceMetadataChanged, false);
  assert.deepEqual(nameOnlyDiff.patch, { full_name: 'Ines Karray-Ben Ali' });

  // 2) Clearing optional licence fields emits explicit null while preserving unchanged fields
  let capturedUrl = '';
  let capturedMethod = '';
  let capturedCache: RequestCache | undefined;
  let capturedBody: Record<string, unknown> | null = null;

  const updatedFromServer = makeDriverItem({
    ...driver,
    licence_category: null,
    licence_expires_on: null,
  });

  const mockFetch: FetchLike = async (input, init) => {
    capturedUrl = String(input);
    capturedMethod = init?.method ?? '';
    capturedCache = init?.cache;
    capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<
      string,
      unknown
    >;
    return jsonResponse({ ok: true, driver: updatedFromServer }, 200);
  };

  // Even if extra forbidden properties are passed via cast, they are NEVER submitted
  const dirtyEditValues = {
    full_name: 'Ines Karray',
    licence_issuing_country: 'TN',
    licence_category: '',
    licence_expires_on: '',
    agency_id: '99999999-9999-4999-8999-999999999999',
    created_by: '99999999-9999-4999-8999-999999999998',
    verification_status: 'rejected',
    verification_notes: 'injected',
    is_active: false,
  } as unknown as EditDriverDetailsFormValues;

  const result = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    dirtyEditValues,
    { fetchFn: mockFetch }
  );

  assert.equal(
    capturedUrl,
    `/api/customers/${CUSTOMER_A_ID}/drivers/${driver.id}`
  );
  assert.equal(capturedMethod, 'PATCH');
  assert.equal(capturedCache, 'no-store');
  assert.deepEqual(capturedBody, {
    licence_category: null,
    licence_expires_on: null,
  });
  assert.equal('full_name' in (capturedBody ?? {}), false);
  assert.equal('licence_issuing_country' in (capturedBody ?? {}), false);
  assert.equal('agency_id' in (capturedBody ?? {}), false);
  assert.equal('created_by' in (capturedBody ?? {}), false);
  assert.equal('verification_status' in (capturedBody ?? {}), false);
  assert.equal('verification_notes' in (capturedBody ?? {}), false);
  assert.equal('is_active' in (capturedBody ?? {}), false);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.status, 200);
    assert.equal(result.licenceMetadataChanged, true);
    assert.equal(result.driver.licence_category, null);
    assert.equal(result.driver.licence_expires_on, null);
  }
});

test('19. Edit Driver rejects invalid fields and no-change saves without making network requests', async () => {
  const driver = makeDriverItem({
    id: '88888888-8888-4888-8888-888888888882',
    customer_id: CUSTOMER_A_ID,
  });

  let fetchCount = 0;
  const guardFetch: FetchLike = async () => {
    fetchCount += 1;
    return jsonResponse({ ok: true, driver }, 200);
  };

  // No changes -> noChanges=true, 0 network calls
  const noChangeResult = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    driverRecordToDetailsFormValues(driver),
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCount, 0);
  assert.equal(noChangeResult.ok, false);
  if (!noChangeResult.ok) {
    assert.equal(noChangeResult.noChanges, true);
  }

  // Invalid fields -> inline fieldErrors, 0 network calls
  const invalidResult = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    {
      full_name: 'A',
      licence_issuing_country: 'TUNISIA',
      licence_category: 'BAD CAT!',
      licence_expires_on: '2026-02-31',
    },
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCount, 0);
  assert.equal(invalidResult.ok, false);
  if (!invalidResult.ok) {
    assert.equal(invalidResult.status, 400);
    assert.ok(invalidResult.fieldErrors.full_name);
    assert.ok(invalidResult.fieldErrors.licence_issuing_country);
    assert.ok(invalidResult.fieldErrors.licence_category);
    assert.ok(invalidResult.fieldErrors.licence_expires_on);
  }

  // Customer / driver context mismatch rejected before fetch
  const mismatchResult = await submitUpdateDriverDetails(
    CUSTOMER_B_ID,
    driver.id,
    driver,
    { ...driverRecordToDetailsFormValues(driver), full_name: 'New Name' },
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCount, 0);
  assert.equal(mismatchResult.ok, false);
  if (!mismatchResult.ok) {
    assert.equal(mismatchResult.status, 400);
  }
});

test('20. Edit Driver PATCH handles 400/401/403/404/500, network errors, abort/stale safety, and real driver list refresh', async () => {
  const initialDriver = makeDriverItem({
    id: '88888888-8888-4888-8888-888888888883',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Hedi Bouazizi',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2028-06-01',
    verification_status: 'verified',
  });
  const editedValues: EditDriverDetailsFormValues = {
    full_name: 'Hedi Bouazizi',
    licence_issuing_country: 'FR',
    licence_category: 'BE',
    licence_expires_on: '2030-06-01',
  };

  // HTTP 400 with fieldErrors filtered strictly to editable detail fields
  const res400 = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    initialDriver.id,
    initialDriver,
    editedValues,
    {
      fetchFn: async () =>
        jsonResponse(
          {
            ok: false,
            error: 'Erreur de validation.',
            fieldErrors: {
              licence_category: 'Catégorie invalide.',
              is_active: 'Should be ignored',
            },
          },
          400
        ),
    }
  );
  assert.equal(res400.ok, false);
  if (!res400.ok) {
    assert.equal(res400.status, 400);
    assert.equal(res400.fieldErrors.licence_category, 'Catégorie invalide.');
    assert.equal('is_active' in res400.fieldErrors, false);
  }

  for (const status of [401, 403, 404, 500] as const) {
    const res = await submitUpdateDriverDetails(
      CUSTOMER_A_ID,
      initialDriver.id,
      initialDriver,
      editedValues,
      {
        fetchFn: async () =>
          jsonResponse({ ok: false, error: `Erreur ${status}` }, status),
      }
    );
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.status, status);
      assert.equal(res.error, `Erreur ${status}`);
    }
  }

  // Network error
  const netErr = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    initialDriver.id,
    initialDriver,
    editedValues,
    {
      fetchFn: async () => {
        throw new TypeError('Offline');
      },
    }
  );
  assert.equal(netErr.ok, false);
  if (!netErr.ok) {
    assert.equal(netErr.status, 0);
    assert.match(netErr.error, /réseau/i);
  }

  // Abort on customer switch / drawer close
  const ac = new AbortController();
  ac.abort();
  const aborted = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    initialDriver.id,
    initialDriver,
    editedValues,
    {
      signal: ac.signal,
      fetchFn: async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      },
    }
  );
  assert.equal(aborted.ok, false);
  if (!aborted.ok) {
    assert.equal(aborted.aborted, true);
  }

  // Confirmed HTTP 200 refreshes real driver list via GET /api/customers/[id]/drivers
  let persistedDriver = initialDriver;
  const refreshedDriver = makeDriverItem({
    ...initialDriver,
    licence_issuing_country: 'FR',
    licence_category: 'BE',
    licence_expires_on: '2030-06-01',
  });

  const liveFlowFetch: FetchLike = async (_input, init) => {
    if (init?.method === 'PATCH') {
      persistedDriver = refreshedDriver;
      return jsonResponse({ ok: true, driver: refreshedDriver }, 200);
    }
    return jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [persistedDriver],
      summary: summarizeCustomerDriversEligibility([persistedDriver], {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    });
  };

  const controller = createCustomerDriversController(liveFlowFetch, () => {});
  await controller.loadForCustomer(CUSTOMER_A_ID, 'manager');
  assert.equal(controller.getState().drivers[0]?.licence_issuing_country, 'TN');

  const patchRes = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    initialDriver.id,
    initialDriver,
    editedValues,
    { fetchFn: liveFlowFetch }
  );
  assert.equal(patchRes.ok, true);

  await controller.retry();
  assert.equal(controller.getState().drivers[0]?.licence_issuing_country, 'FR');
  assert.equal(controller.getState().drivers[0]?.licence_category, 'BE');
  assert.equal(
    controller.getState().drivers[0]?.licence_expires_on,
    '2030-06-01'
  );
});

test('21. Edit Driver static security audit, scope boundaries, and FR/EN/AR translations', () => {
  const editFormSource = fs.readFileSync(
    path.join(process.cwd(), 'components/customers/edit-driver-form.tsx'),
    'utf8'
  );

  // Uses submitUpdateDriverDetails, single-flight guard, AbortController, verified-driver warning
  assert.match(editFormSource, /submitUpdateDriverDetails/);
  assert.match(editFormSource, /createDriverSingleFlightGuard/);
  assert.match(editFormSource, /new AbortController\(\)/);
  assert.match(editFormSource, /hasDriverVerificationSensitiveDetailsChanged/);
  assert.match(editFormSource, /verifiedLicenceChangeWarning/);

  // Strict scope & security: NO verification/deactivation inputs, NO DELETE, NO direct DB, NO service_role, NO console.*
  assert.doesNotMatch(editFormSource, /@\/lib\/supabase\/(client|server)/);
  assert.doesNotMatch(editFormSource, /service_role/i);
  assert.doesNotMatch(editFormSource, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(editFormSource, /method:\s*['"]DELETE['"]/);
  assert.doesNotMatch(editFormSource, /name=["'](verification_status|verification_notes|is_active|agency_id|created_by)["']/);

  // FR/EN/AR translations complete for editForm
  for (const locale of SUPPORTED_LOCALES) {
    const editForm =
      DICTIONARIES[locale].customersDirectory.detailDrawer.drivers.editForm;
    assert.ok(editForm.editButtonLabel.trim().length > 0);
    assert.ok(editForm.title.trim().length > 0);
    assert.ok(editForm.subtitle.trim().length > 0);
    assert.ok(editForm.cancelLabel.trim().length > 0);
    assert.ok(editForm.saveLabel.trim().length > 0);
    assert.ok(editForm.savingLabel.trim().length > 0);
    assert.ok(editForm.noChangesMessage.trim().length > 0);
    assert.ok(editForm.verifiedLicenceChangeWarning.trim().length > 0);
    assert.ok(editForm.updateSuccessBanner.trim().length > 0);
    assert.ok(editForm.updateSuccessVerifiedReviewBanner.trim().length > 0);
  }
});

test('22. Verification PATCH updates status & notes with minimal payload and rejects invalid status/notes before fetch', async () => {
  const driver = makeDriverItem({
    id: '99999999-9999-4999-8999-999999999901',
    customer_id: CUSTOMER_A_ID,
    verification_status: 'unverified',
    verification_notes: null,
    is_active: true,
  });

  // Prefill check
  assert.deepEqual(driverRecordToVerificationFormValues(driver), {
    verification_status: 'unverified',
    verification_notes: '',
  });

  // Invalid verification status rejected client-side without fetch
  let fetchCalled = false;
  const guardFetch: FetchLike = async () => {
    fetchCalled = true;
    return jsonResponse({ ok: true, driver }, 200);
  };

  const invalidStatus = await submitUpdateDriverVerification(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    {
      verification_status: 'legally_approved' as DriverVerificationStatus,
      verification_notes: '',
    },
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCalled, false);
  assert.equal(invalidStatus.ok, false);
  if (!invalidStatus.ok) {
    assert.equal(invalidStatus.status, 400);
    assert.ok(invalidStatus.fieldErrors.verification_status);
  }

  // Overly long verification_notes (>1000 chars) rejected before fetch
  const longNotes = await submitUpdateDriverVerification(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    {
      verification_status: 'pending',
      verification_notes: 'x'.repeat(1001),
    },
    { fetchFn: guardFetch }
  );
  assert.equal(fetchCalled, false);
  assert.equal(longNotes.ok, false);
  if (!longNotes.ok) {
    assert.ok(longNotes.fieldErrors.verification_notes);
  }

  // Status-only change omits verification_notes and sends strictly { verification_status }
  const statusOnly = buildDriverVerificationPatchPayload(driver, {
    verification_status: 'pending',
    verification_notes: '',
  });
  assert.equal(statusOnly.valid, true);
  assert.equal(statusOnly.hasChanges, true);
  assert.deepEqual(statusOnly.patch, { verification_status: 'pending' });

  // Update both status -> verified and private notes -> sends ONLY those two permitted keys
  let capturedBody: Record<string, unknown> | null = null;
  let capturedCache: RequestCache | undefined;
  const verifiedDriver = makeDriverItem({
    ...driver,
    verification_status: 'verified',
    verification_notes: 'Permis original contrôlé au comptoir.',
  });

  const res = await submitUpdateDriverVerification(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    {
      verification_status: 'verified',
      verification_notes: '  Permis original contrôlé au comptoir. ',
    },
    {
      fetchFn: async (_input, init) => {
        capturedCache = init?.cache;
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<
          string,
          unknown
        >;
        return jsonResponse({ ok: true, driver: verifiedDriver }, 200);
      },
    }
  );

  assert.equal(capturedCache, 'no-store');
  assert.deepEqual(capturedBody, {
    verification_status: 'verified',
    verification_notes: 'Permis original contrôlé au comptoir.',
  });
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.driver.verification_status, 'verified');
    assert.equal(
      res.driver.verification_notes,
      'Permis original contrôlé au comptoir.'
    );
  }
});

test('23. Internal verification notes can be edited and cleared using explicit null without changing status', async () => {
  const driver = makeDriverItem({
    id: '99999999-9999-4999-8999-999999999902',
    customer_id: CUSTOMER_A_ID,
    verification_status: 'pending',
    verification_notes: 'En attente de copie physique.',
  });

  let capturedBody: Record<string, unknown> | null = null;
  const clearedDriver = makeDriverItem({
    ...driver,
    verification_notes: null,
  });

  const res = await submitUpdateDriverVerification(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    {
      verification_status: 'pending',
      verification_notes: '   ',
    },
    {
      fetchFn: async (_input, init) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}')) as Record<
          string,
          unknown
        >;
        return jsonResponse({ ok: true, driver: clearedDriver }, 200);
      },
    }
  );

  assert.deepEqual(capturedBody, { verification_notes: null });
  assert.equal('verification_status' in (capturedBody ?? {}), false);
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.driver.verification_notes, null);
    assert.equal(res.driver.verification_status, 'pending');
  }
});

test('24. Driver deactivation and reactivation send strictly { is_active }, preserve verification_status, never DELETE, and block inactive eligibility', async () => {
  const activeVerifiedDriver = makeDriverItem({
    id: '99999999-9999-4999-8999-999999999903',
    customer_id: CUSTOMER_A_ID,
    verification_status: 'verified',
    is_active: true,
    licence_expires_on: '2029-12-31',
  });

  const methods: string[] = [];
  const bodies: Record<string, unknown>[] = [];

  const deactivatedDriver = makeDriverItem({
    ...activeVerifiedDriver,
    is_active: false,
    eligibility: undefined,
  });

  // Deactivate (is_active = false)
  const deactivateRes = await submitToggleDriverActive(
    CUSTOMER_A_ID,
    activeVerifiedDriver.id,
    activeVerifiedDriver,
    false,
    {
      fetchFn: async (_input, init) => {
        methods.push(init?.method ?? '');
        bodies.push(
          JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>
        );
        return jsonResponse({ ok: true, driver: deactivatedDriver }, 200);
      },
    }
  );

  assert.deepEqual(methods, ['PATCH']);
  assert.deepEqual(bodies, [{ is_active: false }]);
  assert.equal(deactivateRes.ok, true);
  if (deactivateRes.ok) {
    assert.equal(deactivateRes.driver.is_active, false);
    assert.equal(deactivateRes.driver.verification_status, 'verified');
    // Inactive driver is NEVER operationally available
    assert.equal(deactivateRes.driver.eligibility.status, 'blocked');
    assert.equal(
      deactivateRes.driver.eligibility.flags.some(
        (flag) => flag.code === 'driver_inactive' && flag.severity === 'blocking'
      ),
      true
    );
  }

  // Reactivate (is_active = true) preserves verification_status
  const reactivatedDriver = makeDriverItem({
    ...deactivatedDriver,
    is_active: true,
    eligibility: undefined,
  });
  let reactivateBody: Record<string, unknown> | null = null;

  const reactivateRes = await submitToggleDriverActive(
    CUSTOMER_A_ID,
    deactivatedDriver.id,
    deactivatedDriver,
    true,
    {
      fetchFn: async (_input, init) => {
        reactivateBody = JSON.parse(String(init?.body ?? '{}')) as Record<
          string,
          unknown
        >;
        return jsonResponse({ ok: true, driver: reactivatedDriver }, 200);
      },
    }
  );

  assert.deepEqual(reactivateBody, { is_active: true });
  assert.equal(reactivateRes.ok, true);
  if (reactivateRes.ok) {
    assert.equal(reactivateRes.driver.is_active, true);
    assert.equal(reactivateRes.driver.verification_status, 'verified');
    assert.equal(
      reactivateRes.driver.eligibility.status,
      'checks_passed_manual_review_required'
    );
  }

  // No-op toggle returns noChanges without hitting network
  let noopFetchCount = 0;
  const noopRes = await submitToggleDriverActive(
    CUSTOMER_A_ID,
    activeVerifiedDriver.id,
    activeVerifiedDriver,
    true,
    {
      fetchFn: async () => {
        noopFetchCount += 1;
        return jsonResponse({}, 200);
      },
    }
  );
  assert.equal(noopFetchCount, 0);
  assert.equal(noopRes.ok, false);
  if (!noopRes.ok) {
    assert.equal(noopRes.noChanges, true);
  }
});

test('25. Verification & activation handle 400/401/403/404/500, network errors, abort/stale cancellation, and list refresh', async () => {
  const driver = makeDriverItem({
    id: '99999999-9999-4999-8999-999999999904',
    customer_id: CUSTOMER_A_ID,
    verification_status: 'unverified',
    verification_notes: null,
    is_active: true,
  });
  const values: DriverVerificationFormValues = {
    verification_status: 'rejected',
    verification_notes: 'Document illisible.',
  };

  for (const status of [400, 401, 403, 404, 500] as const) {
    const vErr = await submitUpdateDriverVerification(
      CUSTOMER_A_ID,
      driver.id,
      driver,
      values,
      {
        fetchFn: async () =>
          jsonResponse({ ok: false, error: `Refus ${status}` }, status),
      }
    );
    assert.equal(vErr.ok, false);
    if (!vErr.ok) {
      assert.equal(vErr.status, status);
    }

    const tErr = await submitToggleDriverActive(
      CUSTOMER_A_ID,
      driver.id,
      driver,
      false,
      {
        fetchFn: async () =>
          jsonResponse({ ok: false, error: `Refus ${status}` }, status),
      }
    );
    assert.equal(tErr.ok, false);
    if (!tErr.ok) {
      assert.equal(tErr.status, status);
    }
  }

  // Network error + Abort cancellation
  const ac = new AbortController();
  ac.abort();
  const abortedToggle = await submitToggleDriverActive(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    false,
    {
      signal: ac.signal,
      fetchFn: async () => {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      },
    }
  );
  assert.equal(abortedToggle.ok, false);
  if (!abortedToggle.ok) {
    assert.equal(abortedToggle.aborted, true);
  }

  // End-to-end mocked refresh recalculating operational eligibility
  let persisted = driver;
  const updated = makeDriverItem({
    ...driver,
    verification_status: 'rejected',
    verification_notes: 'Document illisible.',
    eligibility: undefined,
  });

  const flowFetch: FetchLike = async (_input, init) => {
    if (init?.method === 'PATCH') {
      persisted = updated;
      return jsonResponse({ ok: true, driver: updated }, 200);
    }
    return jsonResponse({
      ok: true,
      customer_id: CUSTOMER_A_ID,
      drivers: [persisted],
      summary: summarizeCustomerDriversEligibility([persisted], {
        now: REFERENCE_NOW,
        timeZone: 'Africa/Tunis',
      }),
    });
  };

  const controller = createCustomerDriversController(flowFetch, () => {});
  await controller.loadForCustomer(CUSTOMER_A_ID, 'owner');
  assert.equal(controller.getState().drivers[0]?.eligibility.status, 'attention_required');

  const patchRes = await submitUpdateDriverVerification(
    CUSTOMER_A_ID,
    driver.id,
    driver,
    values,
    { fetchFn: flowFetch }
  );
  assert.equal(patchRes.ok, true);

  await controller.retry();
  assert.equal(controller.getState().drivers[0]?.verification_status, 'rejected');
  assert.equal(controller.getState().drivers[0]?.eligibility.status, 'blocked');
});

test('26. Verification & activation UI enforces Owner/Manager RBAC, deactivation confirmation, Agent privacy, and FR/EN/AR i18n', () => {
  const sectionSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'components/customers/customer-drivers-section.tsx'
    ),
    'utf8'
  );
  const verifyFormSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'components/customers/driver-verification-form.tsx'
    ),
    'utf8'
  );

  // Deactivation requires explicit confirmation dialog before calling handleToggleActive(driver, false)
  assert.match(sectionSource, /handleRequestDeactivate\(driver\.id\)/);
  assert.match(sectionSource, /role="alertdialog"/);
  assert.match(sectionSource, /confirmDeactivateTitle/);
  assert.match(sectionSource, /handleToggleActive\(driver, false\)/);
  assert.match(sectionSource, /handleToggleActive\(driver, true\)/);

  // All management buttons and verification form gated behind canManageDrivers
  assert.match(sectionSource, /canManageDrivers &&[\s\S]*activePanel\?\.kind === 'verify'/);
  assert.match(sectionSource, /canManageDrivers &&[\s\S]*activePanel\?\.kind === 'confirm_deactivate'/);
  assert.match(sectionSource, /<DriverVerificationForm/);

  // DriverVerificationForm security & scope checks
  assert.match(verifyFormSource, /submitUpdateDriverVerification/);
  assert.match(verifyFormSource, /createDriverSingleFlightGuard/);
  assert.match(verifyFormSource, /new AbortController\(\)/);
  assert.match(verifyFormSource, /manualReviewNotice/);
  assert.doesNotMatch(verifyFormSource, /@\/lib\/supabase\/(client|server)/);
  assert.doesNotMatch(verifyFormSource, /service_role/i);
  assert.doesNotMatch(verifyFormSource, /console\.(log|info|warn|error|debug)/);
  assert.doesNotMatch(verifyFormSource, /method:\s*['"]DELETE['"]/);

  // Never DELETE anywhere in CustomerDriversSection either
  assert.doesNotMatch(sectionSource, /method:\s*['"]DELETE['"]/);

  // FR/EN/AR translations complete for verificationForm and activation
  for (const locale of SUPPORTED_LOCALES) {
    const driversDict =
      DICTIONARIES[locale].customersDirectory.detailDrawer.drivers;
    assert.ok(driversDict.verificationForm.buttonLabel.trim().length > 0);
    assert.ok(driversDict.verificationForm.title.trim().length > 0);
    assert.ok(driversDict.verificationForm.manualReviewNotice.trim().length > 0);
    assert.ok(driversDict.verificationForm.notesLabel.trim().length > 0);
    assert.ok(driversDict.verificationForm.clearNotesLabel.trim().length > 0);
    assert.ok(driversDict.verificationForm.saveLabel.trim().length > 0);
    assert.ok(driversDict.activation.deactivateButtonLabel.trim().length > 0);
    assert.ok(driversDict.activation.reactivateButtonLabel.trim().length > 0);
    assert.ok(driversDict.activation.confirmDeactivateTitle.trim().length > 0);
    assert.ok(driversDict.activation.confirmDeactivateBody.trim().length > 0);
    assert.ok(driversDict.activation.confirmDeactivateButton.trim().length > 0);
  }
});

test('27. Phase 6B.4A UI compatibility: all 4 material fields trigger verified-driver warning and PATCH surfaces DB-invalidated unverified state', async () => {
  const verifiedDriver = makeDriverItem({
    id: '99999999-9999-4999-8999-999999999905',
    customer_id: CUSTOMER_A_ID,
    full_name: 'Sami Ben Youssef',
    licence_issuing_country: 'TN',
    licence_category: 'B',
    licence_expires_on: '2029-10-15',
    verification_status: 'verified',
  });

  const prefilled = driverRecordToDetailsFormValues(verifiedDriver);

  // Unchanged values do not trigger warning
  assert.equal(
    hasDriverVerificationSensitiveDetailsChanged(verifiedDriver, prefilled),
    false
  );

  // Changing full_name OR any of the 3 licence fields triggers the warning
  assert.equal(
    hasDriverVerificationSensitiveDetailsChanged(verifiedDriver, {
      ...prefilled,
      full_name: 'Sami Ben Youssef-Trabelsi',
    }),
    true
  );
  assert.equal(
    hasDriverVerificationSensitiveDetailsChanged(verifiedDriver, {
      ...prefilled,
      licence_issuing_country: 'FR',
    }),
    true
  );
  assert.equal(
    hasDriverVerificationSensitiveDetailsChanged(verifiedDriver, {
      ...prefilled,
      licence_category: 'BE',
    }),
    true
  );
  assert.equal(
    hasDriverVerificationSensitiveDetailsChanged(verifiedDriver, {
      ...prefilled,
      licence_expires_on: '2031-10-15',
    }),
    true
  );

  // When DB migration 0008 resets verification_status to 'unverified' on name edit,
  // submitUpdateDriverDetails returns the actual persisted 'unverified' status & eligibility
  const dbInvalidatedDriver = makeDriverItem({
    ...verifiedDriver,
    full_name: 'Sami Ben Youssef-Trabelsi',
    verification_status: 'unverified',
    eligibility: undefined,
  });

  const result = await submitUpdateDriverDetails(
    CUSTOMER_A_ID,
    verifiedDriver.id,
    verifiedDriver,
    {
      ...prefilled,
      full_name: 'Sami Ben Youssef-Trabelsi',
    },
    {
      fetchFn: async () =>
        jsonResponse({ ok: true, driver: dbInvalidatedDriver }, 200),
    }
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.driver.verification_status, 'unverified');
    assert.equal(result.driver.eligibility.status, 'attention_required');
  }
});




