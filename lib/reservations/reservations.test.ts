import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  agencyDateForInstant,
  agencyLocalTimeToUtc,
  canTransitionReservation,
  validateReservationDraft,
} from './domain';
import { getReservationCopy } from './copy';

const vehicleId = '11111111-1111-4111-8111-111111111111';
const customerId = '22222222-2222-4222-8222-222222222222';
const validDraft = {
  vehicleId, customerId,
  pickupAt: '2026-12-01T12:00:00.000Z',
  returnAt: '2026-12-04T12:00:00.000Z',
  pickupLocation: 'Airport',
  returnLocation: null,
  notes: 'Key pickup',
};

test('Agency-local time transforms correctly across Tunis and Paris daylight saving', () => {
  assert.equal(agencyLocalTimeToUtc('2026-12-01T10:30', 'Africa/Tunis'),
    '2026-12-01T09:30:00.000Z');
  assert.equal(agencyLocalTimeToUtc('2026-07-01T10:30', 'Europe/Paris'),
    '2026-07-01T08:30:00.000Z');
  assert.equal(agencyLocalTimeToUtc('2026-01-01T10:30', 'Europe/Paris'),
    '2026-01-01T09:30:00.000Z');
  assert.equal(agencyLocalTimeToUtc('2026-03-29T02:30', 'Europe/Paris'), null,
    'DST skipped hour must be rejected');
});

test('Invalid dates, malformed offsets and unrealistically long bookings fail', () => {
  assert.equal(agencyLocalTimeToUtc('2026-02-30T10:00', 'Africa/Tunis'), null);
  assert.equal(agencyLocalTimeToUtc('2026-12-01T25:00', 'Africa/Tunis'), null);
  assert.equal(agencyLocalTimeToUtc('2026-12-01T10:00', 'No/Such_Zone'), null);
  assert.equal(agencyDateForInstant('2026-12-01T23:30:00Z', 'Africa/Tunis'), '2026-12-02');
  assert.equal(validateReservationDraft({ ...validDraft, pickupAt: '2026-12-01T12:00' }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, returnAt: validDraft.pickupAt }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, returnAt: '2038-12-04T12:00:00Z' }, 'Africa/Tunis').valid, false);
});

test('Reservation draft rejects monetary and agency/user spoofing', () => {
  assert.equal(validateReservationDraft({ ...validDraft, agency_id: 'evil' }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, daily_rate_minor: 0 }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, status: 'confirmed' }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, customerId: 'other-agency' }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft({ ...validDraft, notes: 'A'.repeat(1201) }, 'Africa/Tunis').valid, false);
  assert.equal(validateReservationDraft(validDraft, 'Africa/Tunis').valid, true);
});

test('Server-RPC status machine protects confirmations and terminal reservations', () => {
  assert.equal(canTransitionReservation('draft', 'pending', 'agent'), true);
  assert.equal(canTransitionReservation('pending', 'confirmed', 'agent'), false);
  assert.equal(canTransitionReservation('pending', 'confirmed', 'owner'), true);
  assert.equal(canTransitionReservation('pending', 'cancelled', 'manager'), true);
  assert.equal(canTransitionReservation('confirmed', 'active', 'agent'), true);
  assert.equal(canTransitionReservation('confirmed', 'cancelled', 'agent'), false);
  assert.equal(canTransitionReservation('active', 'completed', 'agent'), true);
  assert.equal(canTransitionReservation('completed', 'active', 'owner'), false);
  assert.equal(canTransitionReservation('cancelled', 'pending', 'owner'), false);
});

test('Reservation language copy includes all statuses for FR/EN/AR', () => {
  for (const locale of ['fr', 'en', 'ar'] as const) {
    const copy = getReservationCopy(locale);
    assert.ok(copy.newBooking && copy.quote && copy.taxNotice);
    for (const status of ['draft', 'pending', 'confirmed', 'active', 'completed', 'cancelled'] as const) {
      assert.ok(copy.statuses[status]);
    }
  }
});

test('Reservation API enforces agency scope, server quotation and RPC confirmation', () => {
  const read = (filename: string) => fs.readFileSync(path.join(process.cwd(), filename), 'utf8');
  const server = read('lib/reservations/server.ts');
  const route = read('app/api/reservations/route.ts');
  const patch = read('app/api/reservations/[id]/route.ts');
  const page = read('app/reservations/page.tsx');
  assert.match(server, /quoteAgencyReservation/);
  assert.match(server, /calculateRentalPricePreview/);
  assert.match(server, /vehicle_seasonal_rates/);
  assert.match(server, /\.eq\('agency_id', params\.agencyId\)/);
  assert.match(server, /create_agency_reservation_secure/);
  assert.match(server, /expectedSubtotalMinor/);
  assert.match(server, /expectedDepositMinor/);
  assert.match(server, /Rates changed/);
  assert.doesNotMatch(server, /\.insert\(payload\)/);
  assert.match(route, /resolveAuthenticatedAgencyForApi/);
  assert.match(route, /isTrustedOriginRequest/);
  assert.match(patch, /transition_reservation_status/);
  assert.match(patch, /canTransitionReservation/);
  assert.match(page, /key=\{activeAgency\.id\}/);
});
