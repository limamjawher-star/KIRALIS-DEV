import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  formatAgencyRoleLabel,
  formatVatRateFromBps,
  isOnboardingPath,
  resolveSelectedMembership,
  type AgencyMembershipWithAgency,
  type AgencyRecord,
} from './types';
import {
  buildCreateAgencyRpcParams,
  mapCreateAgencyRpcError,
  slugifyAgencyName,
  validateOnboardingAgencyInput,
} from './validation';

function makeAgency(id: string, name: string, slug: string): AgencyRecord {
  return {
    id,
    name,
    legal_name: `${name} SARL`,
    slug,
    tax_id: '1234567/A/M/000',
    email: `contact@${slug}.tn`,
    phone: '+216 71 000 000',
    city: 'Tunis',
    address: 'Avenue Habib Bourguiba, Tunis',
    country_code: 'TN',
    currency_code: 'TND',
    currency_minor_unit: 3,
    timezone: 'Africa/Tunis',
    default_locale: 'fr',
    vat_rate_bps: 1900,
    created_at: '2026-11-21T10:00:00.000Z',
    updated_at: '2026-11-21T10:00:00.000Z',
  };
}

function makeMembership(
  agencyId: string,
  name: string,
  slug: string,
  role: 'owner' | 'manager' | 'agent' = 'owner',
  status: 'active' | 'invited' | 'suspended' = 'active'
): AgencyMembershipWithAgency {
  return {
    id: `m-${agencyId}`,
    agency_id: agencyId,
    role,
    status,
    created_at: '2026-11-21T10:00:00.000Z',
    agency: makeAgency(agencyId, name, slug),
  };
}

test('slugifyAgencyName normalizes French diacritics, whitespace, and punctuation cleanly', () => {
  assert.equal(slugifyAgencyName('Atlas Mobility Tunis'), 'atlas-mobility-tunis');
  assert.equal(slugifyAgencyName('Location Étoile — Sfax & Sud!'), 'location-etoile-sfax-sud');
  assert.equal(slugifyAgencyName('   --Carthage  2026--   '), 'carthage-2026');
  assert.ok(slugifyAgencyName('a'.repeat(120)).length <= 80);
});

test('validateOnboardingAgencyInput enforces server-side rules and defaults for Tunisia', () => {
  const emptyRes = validateOnboardingAgencyInput({});
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.name);
  assert.ok(emptyRes.errors.slug);
  assert.ok(emptyRes.errors.city);
  assert.ok(emptyRes.errors.phone);
  assert.ok(emptyRes.errors.email);
  assert.ok(emptyRes.errors.address);
  assert.equal(emptyRes.errors.legalName, undefined);
  assert.equal(emptyRes.errors.taxId, undefined);

  const validRes = validateOnboardingAgencyInput({
    name: '  Carthage Drive  ',
    legalName: '',
    slug: 'Carthage-Drive',
    city: 'Tunis',
    countryCode: 'tn',
    phone: '+216 71 234 567',
    email: 'Contact@CarthageDrive.tn',
    address: 'Les Berges du Lac 2, Tunis',
    taxId: '  1234567/A/M/000 ',
    vatRatePercent: '19',
  });

  assert.equal(validRes.valid, true);
  assert.ok(validRes.data);
  assert.equal(validRes.data.name, 'Carthage Drive');
  assert.equal(validRes.data.legalName, null);
  assert.equal(validRes.data.slug, 'carthage-drive');
  assert.equal(validRes.data.countryCode, 'TN');
  assert.equal(validRes.data.currencyCode, 'TND');
  assert.equal(validRes.data.currencyMinorUnit, 3);
  assert.equal(validRes.data.timezone, 'Africa/Tunis');
  assert.equal(validRes.data.defaultLocale, 'fr');
  assert.equal(validRes.data.vatRateBps, 1900);

  const rpcParams = buildCreateAgencyRpcParams(validRes.data);
  assert.deepEqual(rpcParams, {
    p_name: 'Carthage Drive',
    p_slug: 'carthage-drive',
    p_legal_name: null,
    p_tax_id: '1234567/A/M/000',
    p_email: 'contact@carthagedrive.tn',
    p_phone: '+216 71 234 567',
    p_city: 'Tunis',
    p_address: 'Les Berges du Lac 2, Tunis',
    p_country_code: 'TN',
    p_currency_code: 'TND',
    p_currency_minor_unit: 3,
    p_timezone: 'Africa/Tunis',
    p_default_locale: 'fr',
    p_vat_rate_bps: 1900,
  });
});

test('validateOnboardingAgencyInput rejects malformed slugs, emails, phones, and out-of-range VAT', () => {
  const res = validateOnboardingAgencyInput({
    name: 'A',
    slug: 'Invalid Slug!',
    city: 'T',
    countryCode: 'TUN',
    phone: '123',
    email: 'not-an-email',
    address: 'Rue',
    vatRatePercent: '150',
  });

  assert.equal(res.valid, false);
  assert.ok(res.errors.name);
  assert.ok(res.errors.slug);
  assert.ok(res.errors.city);
  assert.ok(res.errors.countryCode);
  assert.ok(res.errors.phone);
  assert.ok(res.errors.email);
  assert.ok(res.errors.address);
  assert.ok(res.errors.vatRatePercent);
});

test('mapCreateAgencyRpcError handles duplicate slugs (23505), auth failures (42501), and validation errors cleanly', () => {
  const dup = mapCreateAgencyRpcError({
    code: '23505',
    message: 'duplicate key value violates unique constraint "agencies_slug_unique"',
  });
  assert.equal(dup.status, 409);
  assert.ok(dup.fieldErrors?.slug);

  const unauth = mapCreateAgencyRpcError({
    code: '42501',
    message: 'Authentication required to create an agency.',
  });
  assert.equal(unauth.status, 401);

  const invalidSlug = mapCreateAgencyRpcError({
    code: '22023',
    message: 'Agency slug must be 2 to 80 lowercase alphanumeric characters with hyphens.',
  });
  assert.equal(invalidSlug.status, 400);
  assert.ok(invalidSlug.fieldErrors?.slug);
});

test('resolveSelectedMembership enforces active membership and never trusts unauthorized agency IDs', () => {
  const agencyA = '11111111-1111-4111-8111-111111111111';
  const agencyB = '22222222-2222-4222-8222-222222222222';
  const foreignAgency = '99999999-9999-4999-8999-999999999999';

  // 0 active memberships -> null (triggers redirect to /onboarding)
  assert.equal(resolveSelectedMembership([], agencyA), null);
  assert.equal(
    resolveSelectedMembership([
      makeMembership(agencyA, 'Suspended Co', 'suspended-co', 'owner', 'suspended'),
    ]),
    null
  );

  // 1 active membership -> always selects sole active agency, ignoring foreign cookie
  const single = [makeMembership(agencyA, 'Agence A', 'agence-a', 'owner')];
  assert.equal(resolveSelectedMembership(single, foreignAgency)?.agency_id, agencyA);

  // Multiple active memberships -> honors valid member agencyId, rejects foreign/tampered IDs
  const multi = [
    makeMembership(agencyA, 'Agence A', 'agence-a', 'owner'),
    makeMembership(agencyB, 'Agence B', 'agence-b', 'manager'),
  ];
  assert.equal(resolveSelectedMembership(multi, agencyB)?.agency_id, agencyB);
  assert.equal(resolveSelectedMembership(multi, foreignAgency)?.agency_id, agencyA);
  assert.equal(resolveSelectedMembership(multi, 'not-a-uuid')?.agency_id, agencyA);
});

test('formatting helpers and onboarding path detection work accurately', () => {
  assert.equal(formatAgencyRoleLabel('owner', 'fr'), 'Propriétaire');
  assert.equal(formatAgencyRoleLabel('manager', 'fr'), 'Gestionnaire');
  assert.equal(formatVatRateFromBps(1900, 'fr'), '19 %');
  assert.equal(isOnboardingPath('/onboarding'), true);
  assert.equal(isOnboardingPath('/onboarding/step'), true);
  assert.equal(isOnboardingPath('/'), false);
});

test('onboarding server & API routes use getUser(), call create_agency RPC exclusively, and never insert memberships manually or use service_role', () => {
  const root = process.cwd();
  const onboardingRouteSrc = fs.readFileSync(
    path.join(root, 'app/api/onboarding/agency/route.ts'),
    'utf8'
  );
  const selectRouteSrc = fs.readFileSync(
    path.join(root, 'app/api/agency/select/route.ts'),
    'utf8'
  );
  const serverAgencySrc = fs.readFileSync(
    path.join(root, 'lib/agency/server.ts'),
    'utf8'
  );

  // Must verify identity via getUser(), never getSession()
  assert.match(onboardingRouteSrc, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(onboardingRouteSrc, /getSession\(/);
  assert.match(onboardingRouteSrc, /supabase\.rpc\(\s*'create_agency'/);
  assert.doesNotMatch(onboardingRouteSrc, /\.from\(\s*'agency_memberships'\s*\)\s*\.insert/);
  assert.doesNotMatch(onboardingRouteSrc, /service_role|SUPABASE_SERVICE_ROLE/i);
  assert.match(onboardingRouteSrc, /NO_STORE_CACHE_HEADERS/);

  // Agency selection route must verify active membership against agency_memberships
  assert.match(selectRouteSrc, /supabase\.auth\.getUser\(\)/);
  assert.match(selectRouteSrc, /\.from\(\s*'agency_memberships'\s*\)/);
  assert.match(selectRouteSrc, /\.eq\(\s*'status'\s*,\s*'active'\s*\)/);
  assert.doesNotMatch(selectRouteSrc, /service_role|SUPABASE_SERVICE_ROLE/i);

  // Server helper must verify user via getUser() and filter active memberships
  assert.match(serverAgencySrc, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(serverAgencySrc, /getSession\(/);
  assert.match(serverAgencySrc, /\.eq\(\s*'status'\s*,\s*'active'\s*\)/);
  assert.doesNotMatch(serverAgencySrc, /service_role|SUPABASE_SERVICE_ROLE/i);
});
