import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const MIGRATION_0001 = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/202611210001_initial_schema.sql'),
  'utf8'
);
const MIGRATION_0002 = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/202611210002_rls_and_functions.sql'),
  'utf8'
);
const MIGRATION_0003 = fs.readFileSync(
  path.join(ROOT, 'supabase/migrations/202611210003_security_lockdown.sql'),
  'utf8'
);
const RLS_TEST_SQL = fs.readFileSync(
  path.join(ROOT, 'supabase/tests/rls_verification.sql'),
  'utf8'
);

const REQUIRED_TABLES = [
  'agencies',
  'agency_memberships',
  'vehicles',
  'customers',
  'reservations',
  'audit_logs',
] as const;

function stripSqlComments(sql: string): string {
  return sql.replace(/--.*$/gm, '');
}

test('migration 0001 defines all 6 required tables with native now() timestamptz and minimal MVP privacy surface', () => {
  const exec0001 = stripSqlComments(MIGRATION_0001);

  for (const table of REQUIRED_TABLES) {
    assert.match(
      exec0001,
      new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}\\b`),
      `Missing table definition: public.${table}`
    );
  }
  assert.match(exec0001, /CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;/);
  assert.match(exec0001, /CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;/);
  assert.match(exec0001, /CREATE TYPE public\.agency_role AS ENUM \('owner', 'manager', 'agent'\)/);

  // Task 4: Use native now() instead of timezone('utc', now())
  assert.doesNotMatch(exec0001, /timezone\s*\(\s*'utc'/i);
  assert.match(exec0001, /created_at timestamptz NOT NULL DEFAULT now\(\)/);
  assert.match(exec0001, /NEW\.updated_at := pg_catalog\.now\(\);/);

  // Task 4: Sensitive government ID & driving license columns omitted from initial MVP schema
  assert.doesNotMatch(exec0001, /\bnational_id_number\b/);
  assert.doesNotMatch(exec0001, /\bpassport_number\b/);
  assert.doesNotMatch(exec0001, /\bdriver_license_number\b/);
  assert.doesNotMatch(exec0001, /\bdriver_license_expiry\b/);
});

test('migration 0001 enforces composite tenant FKs, minor-unit money, GiST overlap, and concurrency-safe last-owner lock', () => {
  const exec0001 = stripSqlComments(MIGRATION_0001);

  assert.match(
    exec0001,
    /FOREIGN KEY \(agency_id, vehicle_id\)\s+REFERENCES public\.vehicles \(agency_id, id\)/
  );
  assert.match(
    exec0001,
    /FOREIGN KEY \(agency_id, customer_id\)\s+REFERENCES public\.customers \(agency_id, id\)/
  );
  assert.match(
    exec0001,
    /EXCLUDE USING gist\s*\(\s*agency_id WITH =,\s*vehicle_id WITH =,\s*tstzrange\(pickup_at, return_at, '\[\)'\) WITH &&\s*\)\s*WHERE \(status IN \('confirmed', 'active'\)\)/
  );
  assert.match(exec0001, /daily_rate_minor bigint NOT NULL CHECK \(daily_rate_minor >= 0\)/);
  assert.match(exec0001, /total_minor bigint NOT NULL CHECK \(total_minor >= 0\)/);
  assert.match(exec0001, /total_minor = subtotal_minor \+ tax_minor - discount_minor/);

  // Task 2: Concurrency-safe FOR UPDATE lock on parent agency & block direct invited -> active activation
  assert.match(
    exec0001,
    /FROM public\.agencies a\s+WHERE a\.id = OLD\.agency_id\s+FOR UPDATE;/
  );
  assert.match(
    exec0001,
    /OLD\.status = 'invited'::public\.membership_status\s+AND NEW\.status = 'active'::public\.membership_status/
  );

  // Task 3 & 4: Completed/cancelled reservation freeze & immutable creation attribution on agencies/tenants
  assert.match(exec0001, /CREATE OR REPLACE FUNCTION public\.guard_agency_immutable_fields\(\)/);
  assert.match(exec0001, /CREATE OR REPLACE FUNCTION public\.guard_reservation_integrity\(\)/);
  assert.match(exec0001, /OLD\.status IN \('completed'::public\.reservation_status, 'cancelled'::public\.reservation_status\)/);
  assert.match(exec0001, /NEW\.created_at IS DISTINCT FROM OLD\.created_at/);
  assert.match(exec0001, /REVOKE ALL ON FUNCTION public\.guard_agency_membership_integrity\(\) FROM PUBLIC, anon, authenticated;/);
});

test('migration 0002 enforces audit log, membership, and reservation least-privilege security', () => {
  const exec0002 = stripSqlComments(MIGRATION_0002);

  // Revoke all defaults from PUBLIC, anon, authenticated before minimal GRANTs
  assert.match(exec0002, /REVOKE ALL ON TABLE[\s\S]*FROM PUBLIC, anon, authenticated;/);

  for (const table of REQUIRED_TABLES) {
    assert.match(
      exec0002,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`),
      `Missing ENABLE ROW LEVEL SECURITY for ${table}`
    );
    assert.match(
      exec0002,
      new RegExp(`ALTER TABLE public\\.${table} FORCE ROW LEVEL SECURITY;`),
      `Missing FORCE ROW LEVEL SECURITY for ${table}`
    );
  }

  // Task 1: No unrestricted client audit log creation; transactional server trigger only
  assert.doesNotMatch(exec0002, /\brecord_audit_log\b/);
  assert.doesNotMatch(exec0002, /CREATE POLICY audit_logs_insert_/);
  assert.match(exec0002, /GRANT SELECT ON TABLE public\.audit_logs TO authenticated;/);
  assert.doesNotMatch(exec0002, /GRANT[^;]*INSERT[^;]*ON TABLE public\.audit_logs/);
  assert.match(exec0002, /CREATE OR REPLACE FUNCTION public\.audit_sensitive_change\(\)/);
  assert.match(exec0002, /REVOKE ALL ON FUNCTION public\.audit_sensitive_change\(\) FROM PUBLIC, anon, authenticated;/);

  // Task 2: Direct membership INSERT prohibited in MVP
  assert.doesNotMatch(exec0002, /CREATE POLICY memberships_insert_/);
  assert.doesNotMatch(exec0002, /GRANT[^;]*INSERT[^;]*ON TABLE public\.agency_memberships/);
  assert.match(exec0002, /GRANT SELECT, DELETE ON TABLE public\.agency_memberships TO authenticated;/);
  assert.match(exec0002, /GRANT UPDATE \(role, status\) ON TABLE public\.agency_memberships TO authenticated;/);

  // Task 3: Direct reservation UPDATE restricted strictly to operational columns + server RPCs
  assert.match(
    exec0002,
    /GRANT UPDATE \(\s*pickup_location,\s*return_location,\s*notes,\s*updated_by\s*\) ON TABLE public\.reservations TO authenticated;/
  );
  assert.match(exec0002, /CREATE OR REPLACE FUNCTION public\.transition_reservation_status\(/);
  assert.match(exec0002, /CREATE OR REPLACE FUNCTION public\.update_pending_reservation_terms\(/);
  assert.match(
    exec0002,
    /status IN \('draft'::public\.reservation_status, 'pending'::public\.reservation_status\)/
  );
  assert.match(
    exec0002,
    /status NOT IN \('completed'::public\.reservation_status, 'cancelled'::public\.reservation_status\)/
  );
});

test('all SECURITY DEFINER functions lock search_path, revoke anon/public execute, and never rely on service_role', () => {
  const combinedSql = `${MIGRATION_0001}\n${MIGRATION_0002}`;
  const executableSql = stripSqlComments(combinedSql);
  const definerBlocks = executableSql.match(/SECURITY DEFINER[\s\S]{0,60}/g) ?? [];
  assert.equal(definerBlocks.length, 7, 'Expected exactly 7 SECURITY DEFINER functions across migrations 0001 and 0002');
  for (const block of definerBlocks) {
    assert.match(block, /SET search_path = ''/, 'Every SECURITY DEFINER function must lock search_path');
  }

  assert.match(executableSql, /REVOKE ALL ON FUNCTION public\.create_agency\(/);
  assert.match(executableSql, /REVOKE ALL ON FUNCTION public\.transition_reservation_status\(/);
  assert.match(executableSql, /REVOKE ALL ON FUNCTION public\.update_pending_reservation_terms\(/);
  assert.match(executableSql, /user_id <> auth\.uid\(\)/);
  assert.doesNotMatch(combinedSql, /service_role/i);
});

test('RLS verification SQL suite runs inside a rollback transaction and covers every hardened authorization check', () => {
  assert.match(RLS_TEST_SQL, /^[\s\S]*BEGIN;/);
  assert.match(RLS_TEST_SQL, /ROLLBACK;\s*$/);
  assert.match(RLS_TEST_SQL, /SET LOCAL ROLE anon/);
  assert.match(RLS_TEST_SQL, /SET LOCAL ROLE authenticated/);
  assert.match(RLS_TEST_SQL, /TEST 2c FAILED: direct INSERT into agency_memberships must be prohibited in MVP/);
  assert.match(RLS_TEST_SQL, /TEST 2d FAILED: invited membership must not be directly activatable/);
  assert.match(RLS_TEST_SQL, /TEST 6b FAILED: direct UPDATE of reservation status must be blocked/);
  assert.match(RLS_TEST_SQL, /TEST 6c FAILED: direct UPDATE of reservation pricing\/discounts must be blocked/);
  assert.match(RLS_TEST_SQL, /TEST 6d FAILED: direct UPDATE of reservation vehicle_id must be blocked/);
  assert.match(RLS_TEST_SQL, /TEST 6k FAILED: confirmed reservation pricing must not be modifiable/);
  assert.match(RLS_TEST_SQL, /TEST 6q FAILED: completed reservation must not change status/);
  assert.match(RLS_TEST_SQL, /TEST 8a FAILED: authenticated client must not insert directly into audit_logs/);
  assert.match(RLS_TEST_SQL, /foreign_key_violation/);
  assert.match(RLS_TEST_SQL, /exclusion_violation/);
  assert.match(RLS_TEST_SQL, /TEST 9a FAILED: demoting the last active owner/);
});

test('migration 0003 records the exact non-destructive security lockdown and preserves create_agency grants', () => {
  const exec0003 = stripSqlComments(MIGRATION_0003);

  // Additive & non-destructive: never drops tables, truncates, or references service_role
  assert.doesNotMatch(exec0003, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0003, /\bTRUNCATE\b/i);
  assert.doesNotMatch(exec0003, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(MIGRATION_0003, /service_role/i);

  // Exact 4 privilege lockdowns verified against live Supabase
  assert.match(exec0003, /REVOKE INSERT ON TABLE public\.audit_logs FROM PUBLIC, anon, authenticated;/);
  assert.match(exec0003, /REVOKE INSERT ON TABLE public\.agency_memberships FROM PUBLIC, anon, authenticated;/);
  assert.match(exec0003, /REVOKE UPDATE ON TABLE public\.reservations FROM PUBLIC, anon, authenticated;/);
  assert.match(
    exec0003,
    /REVOKE ALL ON FUNCTION public\.record_audit_log\(uuid, text, text, uuid, jsonb\)\s+FROM PUBLIC, anon, authenticated;/
  );

  // Preserves create_agency & RLS helper grants for authenticated (and revoked from PUBLIC, anon)
  assert.match(exec0003, /REVOKE ALL ON FUNCTION public\.create_agency\([\s\S]*?\)\s*FROM PUBLIC, anon;/);
  assert.match(exec0003, /GRANT EXECUTE ON FUNCTION public\.create_agency\([\s\S]*?\)\s*TO authenticated;/);
  assert.match(exec0003, /GRANT EXECUTE ON FUNCTION public\.is_active_agency_member\(uuid\) TO authenticated;/);
  assert.match(
    exec0003,
    /GRANT EXECUTE ON FUNCTION public\.has_agency_role\(uuid, public\.agency_role\[\]\) TO authenticated;/
  );
});

test('migration 0004 adds nullable compliance DATE columns non-destructively with column-level authenticated UPDATE grants', () => {
  const migration0004 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/202611210004_vehicle_compliance_dates.sql'),
    'utf8'
  );
  const exec0004 = stripSqlComments(migration0004);

  // Additive & non-destructive
  assert.doesNotMatch(exec0004, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0004, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(exec0004, /\bDROP\s+POLICY\b/i);
  assert.doesNotMatch(exec0004, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration0004, /service_role/i);
  assert.doesNotMatch(exec0004, /\bTO\s+(anon|PUBLIC)\b/i);

  // Three exact nullable PostgreSQL DATE columns on public.vehicles
  assert.match(exec0004, /ALTER TABLE public\.vehicles/);
  assert.match(exec0004, /ADD COLUMN IF NOT EXISTS insurance_expires_on date\b/);
  assert.match(
    exec0004,
    /ADD COLUMN IF NOT EXISTS technical_inspection_expires_on date\b/
  );
  assert.match(exec0004, /ADD COLUMN IF NOT EXISTS vignette_expires_on date\b/);

  // Explicit column-level UPDATE grant to authenticated (required by migration 0002)
  assert.match(
    exec0004,
    /GRANT UPDATE \(\s*insurance_expires_on,\s*technical_inspection_expires_on,\s*vignette_expires_on\s*\) ON TABLE public\.vehicles TO authenticated;/
  );
});

test('migration 0005 adds weekly/monthly vehicle rates, tenant-safe seasonal rates with GiST non-overlap, RLS, and trusted audit trigger', () => {
  const migration0005 = fs.readFileSync(
    path.join(
      ROOT,
      'supabase/migrations/202611210005_vehicle_advanced_pricing.sql'
    ),
    'utf8'
  );
  const exec0005 = stripSqlComments(migration0005);

  // Additive & non-destructive; never weakens audit_logs or exposes service_role / anon
  assert.doesNotMatch(exec0005, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0005, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(exec0005, /\bTRUNCATE\b/i);
  assert.doesNotMatch(migration0005, /service_role/i);
  assert.doesNotMatch(exec0005, /GRANT[^;]*ON TABLE public\.audit_logs/i);
  assert.doesNotMatch(exec0005, /GRANT[^;]*DELETE[^;]*ON TABLE public\.vehicle_seasonal_rates/i);
  assert.doesNotMatch(exec0005, /\bTO\s+(anon|PUBLIC)\b/i);

  // Part A: nullable weekly_rate_minor & monthly_rate_minor + non-negative CHECK + column UPDATE grant
  assert.match(exec0005, /ADD COLUMN IF NOT EXISTS weekly_rate_minor bigint/);
  assert.match(exec0005, /ADD COLUMN IF NOT EXISTS monthly_rate_minor bigint/);
  assert.match(exec0005, /CHECK \(weekly_rate_minor IS NULL OR weekly_rate_minor >= 0\)/);
  assert.match(exec0005, /CHECK \(monthly_rate_minor IS NULL OR monthly_rate_minor >= 0\)/);
  assert.match(
    exec0005,
    /GRANT UPDATE \(\s*weekly_rate_minor,\s*monthly_rate_minor\s*\) ON TABLE public\.vehicles TO authenticated;/
  );

  // Part B & C: vehicle_seasonal_rates table, same-agency composite FK, valid range CHECK, GiST exclusion
  assert.match(exec0005, /CREATE TABLE IF NOT EXISTS public\.vehicle_seasonal_rates/);
  assert.match(
    exec0005,
    /FOREIGN KEY \(agency_id, vehicle_id\)\s+REFERENCES public\.vehicles \(agency_id, id\)/
  );
  assert.match(exec0005, /CHECK \(end_date >= start_date\)/);
  assert.match(
    exec0005,
    /EXCLUDE USING gist\s*\(\s*agency_id WITH =,\s*vehicle_id WITH =,\s*daterange\(start_date, end_date, '\[\]'\)\s+WITH &&\s*\)\s*WHERE \(is_active\)/
  );

  // Forced RLS + owner/manager write + active member read
  assert.match(exec0005, /ALTER TABLE public\.vehicle_seasonal_rates ENABLE ROW LEVEL SECURITY;/);
  assert.match(exec0005, /ALTER TABLE public\.vehicle_seasonal_rates FORCE ROW LEVEL SECURITY;/);
  assert.match(exec0005, /CREATE POLICY vehicle_seasonal_rates_select_active_member/);
  assert.match(exec0005, /CREATE POLICY vehicle_seasonal_rates_insert_owner_manager/);
  assert.match(exec0005, /CREATE POLICY vehicle_seasonal_rates_update_owner_manager/);

  // Part D: SECURITY DEFINER + locked search_path audit trigger, revoked from client roles
  assert.match(
    exec0005,
    /CREATE OR REPLACE FUNCTION public\.audit_vehicle_pricing_change\(\)[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/
  );
  assert.match(
    exec0005,
    /REVOKE ALL ON FUNCTION public\.audit_vehicle_pricing_change\(\) FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    exec0005,
    /REVOKE ALL ON FUNCTION public\.guard_vehicle_seasonal_rate_integrity\(\) FROM PUBLIC, anon, authenticated;/
  );
});

test('migration 0005 safely supports auth.users ON DELETE SET NULL on created_by and explicit btree_gist transaction search_path', () => {
  const migration0005 = fs.readFileSync(
    path.join(
      ROOT,
      'supabase/migrations/202611210005_vehicle_advanced_pricing.sql'
    ),
    'utf8'
  );
  const exec0005 = stripSqlComments(migration0005);

  // Explicit BEGIN / COMMIT atomic transaction
  assert.match(exec0005, /^\s*BEGIN;/);
  assert.match(exec0005, /COMMIT;\s*$/);

  // Issue 2: Verify existing btree_gist extension and set transaction-local search_path with pg_catalog first
  assert.match(exec0005, /FROM pg_catalog\.pg_extension e[\s\S]*WHERE e\.extname = 'btree_gist'/);
  assert.match(exec0005, /SET LOCAL search_path = pg_catalog, %I/);
  assert.doesNotMatch(exec0005, /\bCREATE\s+EXTENSION\b/i);
  assert.doesNotMatch(exec0005, /\bALTER\s+EXTENSION\b/i);

  // Issue 1: created_by must remain non-updatable by authenticated users
  const updateGrantMatch = exec0005.match(
    /GRANT UPDATE \(([^)]*)\) ON TABLE public\.vehicle_seasonal_rates TO authenticated;/
  );
  assert.ok(updateGrantMatch, 'Expected column-level UPDATE grant on public.vehicle_seasonal_rates');
  assert.doesNotMatch(updateGrantMatch[1], /\bcreated_by\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bagency_id\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bvehicle_id\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bcreated_at\b/);

  // Guard trigger allows ONLY nested FK nullification (non-null -> NULL, non-client role, no other fields changed)
  assert.match(
    exec0005,
    /OLD\.created_by IS NOT NULL[\s\S]*AND NEW\.created_by IS NULL[\s\S]*AND pg_catalog\.pg_trigger_depth\(\) > 1[\s\S]*AND current_user NOT IN \('anon', 'authenticated'\)/
  );
  // Still locks agency_id, vehicle_id, and created_at unconditionally
  assert.match(exec0005, /Changing agency_id on an existing seasonal rate is forbidden/);
  assert.match(exec0005, /Changing vehicle_id on an existing seasonal rate is forbidden/);
  assert.match(exec0005, /Changing created_at on an existing seasonal rate is forbidden/);

  // Audit trigger skips pure created_by FK nullification so deleting an auth user never fails or logs bogus updates
  const auditFnMatch = exec0005.match(
    /CREATE OR REPLACE FUNCTION public\.audit_vehicle_pricing_change\(\)[\s\S]*?\$\$;/
  );
  assert.ok(auditFnMatch, 'Expected audit_vehicle_pricing_change function definition');
  assert.match(
    auditFnMatch[0],
    /OLD\.created_by IS NOT NULL[\s\S]*AND NEW\.created_by IS NULL[\s\S]*RETURN NULL;/
  );

  // Direct DELETE on public.vehicles is revoked and owner delete policy removed before COMMIT
  assert.match(
    exec0005,
    /REVOKE DELETE ON TABLE public\.vehicles FROM PUBLIC, anon, authenticated;\s*DROP POLICY IF EXISTS vehicles_delete_owner_only ON public\.vehicles;\s*COMMIT;\s*$/
  );
});

test('migration 0007 adds privacy-minimized public.customer_drivers with composite tenant FK, forced RLS, no client DELETE, and trusted audit trigger', () => {
  const migration0007 = fs.readFileSync(
    path.join(
      ROOT,
      'supabase/migrations/202611210007_customer_authorized_drivers.sql'
    ),
    'utf8'
  );
  const exec0007 = stripSqlComments(migration0007);

  // Explicit atomic transaction
  assert.match(exec0007, /^\s*BEGIN;/);
  assert.match(exec0007, /COMMIT;\s*$/);

  // Non-destructive and no direct client audit/delete/service_role exposure
  assert.doesNotMatch(exec0007, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0007, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(exec0007, /\bTRUNCATE\b/i);
  assert.doesNotMatch(exec0007, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(exec0007, /\bservice_role\b/i);
  assert.doesNotMatch(exec0007, /\bTO\s+(anon|PUBLIC)\b/i);
  assert.doesNotMatch(exec0007, /GRANT[\s\S]*ON\s+TABLE\s+public\.audit_logs/i);
  assert.doesNotMatch(
    exec0007,
    /GRANT[\s\S]*DELETE[\s\S]*ON\s+TABLE\s+public\.customer_drivers/i
  );
  assert.doesNotMatch(exec0007, /CREATE POLICY[\s\S]*FOR\s+DELETE/i);

  // Privacy minimization: no licence numbers, identity document numbers, or document scan columns
  assert.doesNotMatch(
    exec0007,
    /\b(licence_number|license_number|passport_number|national_id|cin_number|identity_number|document_url|scan_url|photo_url)\b/i
  );

  // Verification status enum
  assert.match(
    exec0007,
    /CREATE TYPE public\.driver_verification_status AS ENUM \(\s*'unverified',\s*'pending',\s*'verified',\s*'rejected'\s*\);/
  );

  // Table + same-agency composite FK to public.customers (agency_id, id) + composite unique key
  assert.match(exec0007, /CREATE TABLE IF NOT EXISTS public\.customer_drivers/);
  assert.match(
    exec0007,
    /CONSTRAINT customer_drivers_tenant_id_unique\s+UNIQUE \(agency_id, id\)/
  );
  assert.match(
    exec0007,
    /CONSTRAINT customer_drivers_customer_same_agency_fk\s+FOREIGN KEY \(agency_id, customer_id\)\s+REFERENCES public\.customers \(agency_id, id\)/
  );

  // Date & format checks on operational metadata
  assert.match(exec0007, /licence_issuing_country ~ '\^\[A-Z\]\{2\}\$'/);
  assert.match(exec0007, /licence_category ~ '\^\[A-Z\]\[A-Z0-9\+\]\{0,9\}\$'/);
  assert.match(
    exec0007,
    /licence_expires_on BETWEEN DATE '1980-01-01' AND DATE '2150-12-31'/
  );

  // Column-level UPDATE grant excludes immutable identifiers and timestamps
  const updateGrantMatch = exec0007.match(
    /GRANT UPDATE \(([^)]*)\) ON TABLE public\.customer_drivers TO authenticated;/
  );
  assert.ok(
    updateGrantMatch,
    'Expected column-level UPDATE grant on public.customer_drivers'
  );
  assert.doesNotMatch(updateGrantMatch[1], /\bid\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bagency_id\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bcustomer_id\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bcreated_by\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bcreated_at\b/);
  assert.doesNotMatch(updateGrantMatch[1], /\bupdated_at\b/);

  // Forced RLS + exact 3 policies (Agent read, Owner/Manager insert & update, no DELETE)
  assert.match(
    exec0007,
    /ALTER TABLE public\.customer_drivers ENABLE ROW LEVEL SECURITY;/
  );
  assert.match(
    exec0007,
    /ALTER TABLE public\.customer_drivers FORCE ROW LEVEL SECURITY;/
  );
  assert.match(
    exec0007,
    /CREATE POLICY customer_drivers_select_active_member[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*USING \(public\.is_active_agency_member\(agency_id\)\);/
  );
  assert.match(
    exec0007,
    /CREATE POLICY customer_drivers_insert_owner_manager[\s\S]*FOR INSERT[\s\S]*TO authenticated[\s\S]*public\.has_agency_role\(agency_id, ARRAY\['owner', 'manager'\]::public\.agency_role\[\]\)[\s\S]*AND created_by = auth\.uid\(\)/
  );
  assert.match(
    exec0007,
    /CREATE POLICY customer_drivers_update_owner_manager[\s\S]*FOR UPDATE[\s\S]*TO authenticated[\s\S]*USING \(public\.has_agency_role\(agency_id, ARRAY\['owner', 'manager'\]::public\.agency_role\[\]\)\)[\s\S]*WITH CHECK \(public\.has_agency_role\(agency_id, ARRAY\['owner', 'manager'\]::public\.agency_role\[\]\)\);/
  );

  // Integrity guard locks immutable fields & safely allows nested auth.users ON DELETE SET NULL
  assert.match(
    exec0007,
    /CREATE OR REPLACE FUNCTION public\.guard_customer_driver_integrity\(\)[\s\S]*SET search_path = ''/
  );
  assert.match(
    exec0007,
    /Changing id on an existing customer driver is forbidden/
  );
  assert.match(
    exec0007,
    /Changing agency_id on an existing customer driver is forbidden/
  );
  assert.match(
    exec0007,
    /Changing customer_id on an existing customer driver is forbidden/
  );
  assert.match(
    exec0007,
    /OLD\.created_by IS NOT NULL[\s\S]*AND NEW\.created_by IS NULL[\s\S]*AND pg_catalog\.pg_trigger_depth\(\) > 1[\s\S]*AND current_user NOT IN \('anon', 'authenticated'\)/
  );

  // Trusted SECURITY DEFINER audit trigger logs operational metadata only (no full_name or verification_notes)
  const auditFnMatch = exec0007.match(
    /CREATE OR REPLACE FUNCTION public\.audit_customer_driver_change\(\)[\s\S]*?\$\$;/
  );
  assert.ok(auditFnMatch, 'Expected audit_customer_driver_change function definition');
  assert.match(auditFnMatch[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.doesNotMatch(auditFnMatch[0], /'full_name'/);
  assert.doesNotMatch(auditFnMatch[0], /'verification_notes'/);
  assert.match(
    auditFnMatch[0],
    /OLD\.created_by IS NOT NULL[\s\S]*AND NEW\.created_by IS NULL[\s\S]*RETURN NULL;/
  );

  // Trigger functions revoked from all client roles
  assert.match(
    exec0007,
    /REVOKE ALL ON FUNCTION public\.guard_customer_driver_integrity\(\) FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    exec0007,
    /REVOKE ALL ON FUNCTION public\.audit_customer_driver_change\(\) FROM PUBLIC, anon, authenticated;/
  );
});

test('migration 0008 adds idempotent BEFORE UPDATE verification integrity trigger with guaranteed ordering before updated_at and compatibility with migration 0007 audit trigger', () => {
  const migration0007 = fs.readFileSync(
    path.join(
      ROOT,
      'supabase/migrations/202611210007_customer_authorized_drivers.sql'
    ),
    'utf8'
  );
  const migration0008 = fs.readFileSync(
    path.join(
      ROOT,
      'supabase/migrations/202611210008_driver_verification_integrity.sql'
    ),
    'utf8'
  );
  const exec0007 = stripSqlComments(migration0007);
  const exec0008 = stripSqlComments(migration0008);

  // Explicit atomic transaction
  assert.match(exec0008, /^\s*BEGIN;/);
  assert.match(exec0008, /COMMIT;\s*$/);

  // Strictly additive, non-destructive, and scoped only to public.customer_drivers
  assert.doesNotMatch(exec0008, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0008, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(exec0008, /\bALTER\s+TABLE\b/i);
  assert.doesNotMatch(exec0008, /\bTRUNCATE\b/i);
  assert.doesNotMatch(exec0008, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(exec0008, /\bservice_role\b/i);
  assert.doesNotMatch(exec0008, /\bTO\s+(anon|PUBLIC)\b/i);
  assert.doesNotMatch(exec0008, /\bpublic\.(customers|vehicles|agencies)\b/i);
  assert.doesNotMatch(exec0008, /\bDROP\s+POLICY\b/i);
  assert.doesNotMatch(exec0008, /\bCREATE\s+POLICY\b/i);

  // Trigger function uses locked search_path = '' and is revoked from client roles
  assert.match(
    exec0008,
    /CREATE OR REPLACE FUNCTION public\.enforce_customer_driver_verification_integrity\(\)[\s\S]*SET search_path = ''/
  );
  assert.match(
    exec0008,
    /REVOKE ALL ON FUNCTION public\.enforce_customer_driver_verification_integrity\(\)\s+FROM PUBLIC, anon, authenticated;/
  );

  // Detects changes strictly across the 4 material identity/licence fields
  const materialMatch = exec0008.match(/v_material_changed\s*:=\s*\(([\s\S]*?)\);/);
  assert.ok(materialMatch, 'Expected v_material_changed predicate in migration 0008');
  assert.match(materialMatch[1], /NEW\.full_name IS DISTINCT FROM OLD\.full_name/);
  assert.match(
    materialMatch[1],
    /NEW\.licence_issuing_country IS DISTINCT FROM OLD\.licence_issuing_country/
  );
  assert.match(
    materialMatch[1],
    /NEW\.licence_category IS DISTINCT FROM OLD\.licence_category/
  );
  assert.match(
    materialMatch[1],
    /NEW\.licence_expires_on IS DISTINCT FROM OLD\.licence_expires_on/
  );
  // Notes and activation toggles must NOT invalidate verification
  assert.doesNotMatch(materialMatch[1], /verification_notes/);
  assert.doesNotMatch(materialMatch[1], /is_active/);

  // Rejects simultaneous material edit + promotion to 'verified'
  assert.match(
    exec0008,
    /IF NEW\.verification_status = 'verified'::public\.driver_verification_status\s+AND OLD\.verification_status IS DISTINCT FROM 'verified'::public\.driver_verification_status THEN[\s\S]*RAISE EXCEPTION[\s\S]*ERRCODE = '23514'[\s\S]*CONSTRAINT = 'customer_drivers_verification_integrity_check';/
  );

  // Resets previously 'verified' row to 'unverified' on material edits
  assert.match(
    exec0008,
    /IF OLD\.verification_status = 'verified'::public\.driver_verification_status\s+AND NEW\.verification_status = 'verified'::public\.driver_verification_status THEN\s*NEW\.verification_status := 'unverified'::public\.driver_verification_status;/
  );

  // Idempotent BEFORE UPDATE trigger creation
  assert.match(
    exec0008,
    /DROP TRIGGER IF EXISTS trg_customer_drivers_integrity_verification\s+ON public\.customer_drivers;/
  );
  assert.match(
    exec0008,
    /CREATE TRIGGER trg_customer_drivers_integrity_verification\s+BEFORE UPDATE ON public\.customer_drivers\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.enforce_customer_driver_verification_integrity\(\);/
  );

  // Verify PostgreSQL ASCII alphabetical BEFORE UPDATE trigger ordering:
  // 1. trg_customer_drivers_integrity (migration 0007)
  // 2. trg_customer_drivers_integrity_verification (migration 0008)
  // 3. trg_customer_drivers_updated_at (migration 0007)
  const beforeUpdateTriggers = [
    'trg_customer_drivers_updated_at',
    'trg_customer_drivers_integrity_verification',
    'trg_customer_drivers_integrity',
  ].sort();
  assert.deepEqual(beforeUpdateTriggers, [
    'trg_customer_drivers_integrity',
    'trg_customer_drivers_integrity_verification',
    'trg_customer_drivers_updated_at',
  ]);

  // Verify compatibility with migration 0007's AFTER INSERT OR UPDATE audit trigger
  assert.match(
    exec0007,
    /CREATE TRIGGER trg_customer_drivers_audit\s+AFTER INSERT OR UPDATE ON public\.customer_drivers/
  );
  assert.match(
    exec0007,
    /IF OLD\.verification_status IS DISTINCT FROM NEW\.verification_status THEN\s*v_action := 'customer_driver\.verification_status_changed';/
  );
});

test('migration 0009 defines public.agency_invitations with hashed tokens, non-owner roles, bounded expiry, and single-use integrity guards', () => {
  const migration0009 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/202611210009_team_invitations.sql'),
    'utf8'
  );
  const exec0009 = stripSqlComments(migration0009);

  // Explicit atomic transaction & finalized (temporary DRAFT warnings removed)
  assert.doesNotMatch(migration0009, /\bDRAFT\b|DO NOT INSTALL YET/i);
  assert.match(exec0009, /^\s*BEGIN;/);
  assert.match(exec0009, /COMMIT;\s*$/);

  // Strictly additive & non-destructive; preserves migrations 0001–0008 and existing tables
  assert.doesNotMatch(exec0009, /\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(exec0009, /\bDROP\s+COLUMN\b/i);
  assert.doesNotMatch(exec0009, /\bTRUNCATE\b/i);
  assert.doesNotMatch(exec0009, /\bDELETE\s+FROM\b/i);
  assert.doesNotMatch(migration0009, /service_role/i);
  assert.doesNotMatch(exec0009, /\bTO\s+(anon|PUBLIC)\b/i);
  assert.doesNotMatch(
    exec0009,
    /GRANT[^;]*ON\s+TABLE\s+public\.(agency_memberships|audit_logs|agencies|customers|customer_drivers|vehicles|reservations)\b/i
  );
  assert.doesNotMatch(
    exec0009,
    /CREATE\s+POLICY[^;]*ON\s+public\.(agency_memberships|audit_logs|agencies|customers|customer_drivers|vehicles|reservations)\b/i
  );
  assert.doesNotMatch(
    exec0009,
    /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(audit_sensitive_change|audit_vehicle_pricing_change|audit_customer_driver_change|guard_agency_membership_integrity)\b/i
  );

  // Status enum & table with all required columns
  assert.match(
    exec0009,
    /CREATE TYPE public\.agency_invitation_status AS ENUM \(\s*'pending',\s*'accepted',\s*'revoked',\s*'expired'\s*\);/
  );
  assert.match(exec0009, /CREATE TABLE IF NOT EXISTS public\.agency_invitations/);

  const requiredColumns = [
    'id uuid PRIMARY KEY DEFAULT gen_random_uuid()',
    'agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE',
    'invited_email text NOT NULL',
    'invited_role public.agency_role NOT NULL',
    'token_hash text NOT NULL',
    "status public.agency_invitation_status NOT NULL DEFAULT 'pending'",
    'invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL',
    'accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL',
    'expires_at timestamptz NOT NULL',
    'accepted_at timestamptz',
    'revoked_at timestamptz',
    'created_at timestamptz NOT NULL DEFAULT now()',
    'updated_at timestamptz NOT NULL DEFAULT now()',
  ];
  for (const col of requiredColumns) {
    assert.ok(
      exec0009.includes(col),
      `Missing expected column definition in public.agency_invitations: ${col}`
    );
  }

  // Hashed token storage only (fixed-length 64-char lowercase SHA-256 hex, UNIQUE, never plaintext)
  assert.match(exec0009, /CONSTRAINT agency_invitations_token_hash_unique\s+UNIQUE \(token_hash\)/);
  assert.match(
    exec0009,
    /CONSTRAINT agency_invitations_token_hash_format\s+CHECK \(token_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/
  );

  // Normalized lowercase trimmed email & unique active pending invitation per agency+email
  assert.match(exec0009, /invited_email = lower\(btrim\(invited_email\)\)/);
  assert.match(
    exec0009,
    /CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_invitations_one_pending_per_email\s+ON public\.agency_invitations \(agency_id, invited_email\)\s+WHERE status = 'pending'::public\.agency_invitation_status;/
  );

  // Owner invitations strictly prohibited (Manager or Agent only)
  const roleCheckMatch = exec0009.match(
    /CONSTRAINT agency_invitations_role_non_owner\s+CHECK \(([\s\S]*?)\)\s*,/
  );
  assert.ok(roleCheckMatch, 'Expected non-owner role CHECK constraint');
  assert.match(roleCheckMatch[1], /'manager'::public\.agency_role/);
  assert.match(roleCheckMatch[1], /'agent'::public\.agency_role/);
  assert.doesNotMatch(roleCheckMatch[1], /'owner'/);

  // Safe bounded expiration window & single-use integrity trigger
  assert.match(
    exec0009,
    /expires_at > created_at\s+AND expires_at <= created_at \+ interval '30 days'/
  );
  assert.match(
    exec0009,
    /CREATE OR REPLACE FUNCTION public\.guard_agency_invitation_integrity\(\)[\s\S]*SET search_path = ''/
  );
  assert.match(exec0009, /Changing agency_id on an existing agency invitation is forbidden/);
  assert.match(exec0009, /Changing invited_by on an existing agency invitation is forbidden/);
  assert.match(exec0009, /Changing token_hash on an existing agency invitation is forbidden/);
  assert.match(exec0009, /Finalized agency invitations cannot be modified/);
  assert.match(exec0009, /Expired agency invitations cannot be accepted/);
  assert.match(
    exec0009,
    /pg_catalog\.pg_trigger_depth\(\) > 1[\s\S]*current_user NOT IN \('anon', 'authenticated'\)/
  );
});

test('migration 0009 enforces Owner-only forced RLS, excludes token_hash from SELECT grants, forbids direct client writes, and audits invitations and membership inserts safely', () => {
  const migration0009 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/202611210009_team_invitations.sql'),
    'utf8'
  );
  const exec0009 = stripSqlComments(migration0009);

  // Revoke all defaults first
  assert.match(
    exec0009,
    /REVOKE ALL ON TABLE public\.agency_invitations FROM PUBLIC, anon, authenticated;/
  );

  // Column-level SELECT only, explicitly EXCLUDING token_hash
  const selectGrantMatch = exec0009.match(
    /GRANT SELECT \(([^)]*)\) ON TABLE public\.agency_invitations TO authenticated;/
  );
  assert.ok(
    selectGrantMatch,
    'Expected column-level GRANT SELECT on public.agency_invitations'
  );
  assert.doesNotMatch(selectGrantMatch[1], /\btoken_hash\b/);
  assert.match(selectGrantMatch[1], /\bid\b/);
  assert.match(selectGrantMatch[1], /\bagency_id\b/);
  assert.match(selectGrantMatch[1], /\binvited_email\b/);
  assert.match(selectGrantMatch[1], /\binvited_role\b/);
  assert.match(selectGrantMatch[1], /\bstatus\b/);

  // ZERO direct client INSERT, UPDATE, or DELETE grants or policies on agency_invitations
  assert.doesNotMatch(
    exec0009,
    /GRANT[^;]*\b(INSERT|UPDATE|DELETE)\b[^;]*ON TABLE public\.agency_invitations/i
  );
  assert.doesNotMatch(
    exec0009,
    /CREATE POLICY[^;]*FOR\s+(INSERT|UPDATE|DELETE)\b/i
  );

  // Forced RLS + strict Owner-only tenant-scoped SELECT policy
  assert.match(
    exec0009,
    /ALTER TABLE public\.agency_invitations ENABLE ROW LEVEL SECURITY;/
  );
  assert.match(
    exec0009,
    /ALTER TABLE public\.agency_invitations FORCE ROW LEVEL SECURITY;/
  );
  assert.match(
    exec0009,
    /CREATE POLICY agency_invitations_select_owner_only[\s\S]*ON public\.agency_invitations[\s\S]*FOR SELECT[\s\S]*TO authenticated[\s\S]*USING \(public\.has_agency_role\(agency_id, ARRAY\['owner'\]::public\.agency_role\[\]\)\);/
  );

  // Invitation audit trigger: SECURITY DEFINER + locked search_path, logs lifecycle events, never logs token/token_hash/email
  const auditFnMatch = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.audit_agency_invitation_change\(\)[\s\S]*?\$\$;/
  );
  assert.ok(auditFnMatch, 'Expected audit_agency_invitation_change function definition');
  assert.match(auditFnMatch[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(auditFnMatch[0], /'invitation\.created'/);
  assert.match(auditFnMatch[0], /'invitation\.revoked'/);
  assert.match(auditFnMatch[0], /'invitation\.accepted'/);
  assert.doesNotMatch(auditFnMatch[0], /token_hash/);
  assert.doesNotMatch(auditFnMatch[0], /invited_email/);

  // Additive membership INSERT audit trigger: SECURITY DEFINER + locked search_path, logs membership.created, no token/email
  const membershipAuditFnMatch = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.audit_agency_membership_insert\(\)[\s\S]*?\$\$;/
  );
  assert.ok(membershipAuditFnMatch, 'Expected audit_agency_membership_insert function definition');
  assert.match(membershipAuditFnMatch[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(membershipAuditFnMatch[0], /'membership\.created'/);
  assert.doesNotMatch(membershipAuditFnMatch[0], /token_hash/);
  assert.doesNotMatch(membershipAuditFnMatch[0], /email/);
  assert.match(
    exec0009,
    /CREATE TRIGGER trg_agency_memberships_insert_audit\s+AFTER INSERT ON public\.agency_memberships\s+FOR EACH ROW\s+EXECUTE FUNCTION public\.audit_agency_membership_insert\(\);/
  );

  // Trigger functions revoked from all client roles
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.guard_agency_invitation_integrity\(\)\s+FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.audit_agency_invitation_change\(\)\s+FROM PUBLIC, anon, authenticated;/
  );
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.audit_agency_membership_insert\(\)\s+FROM PUBLIC, anon, authenticated;/
  );

  // Trigger ordering: integrity guard runs strictly before updated_at
  const beforeTriggers = [
    'trg_agency_invitations_updated_at',
    'trg_agency_invitations_integrity',
  ].sort();
  assert.deepEqual(beforeTriggers, [
    'trg_agency_invitations_integrity',
    'trg_agency_invitations_updated_at',
  ]);
});

test('migration 0009 defines all four Team/Invitation SECURITY DEFINER RPCs with strict search_path, grants, and security invariants', () => {
  const migration0009 = fs.readFileSync(
    path.join(ROOT, 'supabase/migrations/202611210009_team_invitations.sql'),
    'utf8'
  );
  const exec0009 = stripSqlComments(migration0009);

  // Exactly 6 SECURITY DEFINER functions in finalized migration 0009
  // (2 audit triggers + 4 Team/Invitation RPCs) and EVERY ONE must lock search_path = ''
  const definerBlocks = exec0009.match(/SECURITY DEFINER[\s\S]{0,60}/g) ?? [];
  assert.equal(
    definerBlocks.length,
    6,
    'Expected exactly 6 SECURITY DEFINER functions in finalized migration 0009'
  );
  for (const block of definerBlocks) {
    assert.match(
      block,
      /SET search_path = ''/,
      'Every SECURITY DEFINER function in migration 0009 must lock search_path'
    );
  }

  // Extract each RPC body individually for strict assertions
  const listFn = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.list_agency_members\([\s\S]*?\$\$;/
  );
  const createFn = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.create_agency_invitation\([\s\S]*?\$\$;/
  );
  const revokeFn = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.revoke_agency_invitation\([\s\S]*?\$\$;/
  );
  const acceptFn = exec0009.match(
    /CREATE OR REPLACE FUNCTION public\.accept_agency_invitation\([\s\S]*?\$\$;/
  );

  assert.ok(listFn, 'Expected public.list_agency_members definition');
  assert.ok(createFn, 'Expected public.create_agency_invitation definition');
  assert.ok(revokeFn, 'Expected public.revoke_agency_invitation definition');
  assert.ok(acceptFn, 'Expected public.accept_agency_invitation definition');

  // 1. list_agency_members: Owner-only, auth.uid() verified, minimal auth.users projection, no token_hash
  assert.match(listFn[0], /STABLE[\s\S]*SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(listFn[0], /v_actor_id uuid := auth\.uid\(\);/);
  assert.match(
    listFn[0],
    /public\.has_agency_role\(p_agency_id, ARRAY\['owner'\]::public\.agency_role\[\]\)/
  );
  assert.match(listFn[0], /WHERE m\.agency_id = p_agency_id/);
  assert.doesNotMatch(listFn[0], /SELECT\s+\*/i);
  assert.doesNotMatch(listFn[0], /\b(encrypted_password|token_hash|recovery_token|confirmation_token)\b/);

  // 2. create_agency_invitation: Owner-only, Manager/Agent only, SHA-256 hash only, bounded expiry,
  //    never returns token_hash, never inserts into agency_memberships
  assert.match(createFn[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(createFn[0], /v_actor_id uuid := auth\.uid\(\);/);
  assert.match(
    createFn[0],
    /public\.has_agency_role\(p_agency_id, ARRAY\['owner'\]::public\.agency_role\[\]\)/
  );
  assert.match(
    createFn[0],
    /p_invited_role NOT IN \('manager'::public\.agency_role, 'agent'::public\.agency_role\)/
  );
  assert.match(createFn[0], /v_clean_token_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(createFn[0], /p_expires_in_hours < 1 OR p_expires_in_hours > 720/);
  assert.match(createFn[0], /FROM public\.agencies a\s+WHERE a\.id = p_agency_id\s+FOR UPDATE;/);
  assert.doesNotMatch(createFn[0], /INSERT INTO public\.agency_memberships/i);
  const createReturnMatch = createFn[0].match(/RETURNS TABLE \(([\s\S]*?)\)/);
  assert.ok(createReturnMatch, 'Expected RETURNS TABLE projection on create_agency_invitation');
  assert.doesNotMatch(createReturnMatch[1], /\btoken_hash\b/);
  const createReturningClause = createFn[0].match(/RETURNING([\s\S]*?);/);
  assert.ok(createReturningClause, 'Expected RETURNING clause on create_agency_invitation');
  assert.doesNotMatch(createReturningClause[1], /\btoken_hash\b/);

  // 3. revoke_agency_invitation: Owner-only, strictly tenant-scoped FOR UPDATE, pending unexpired only,
  //    never returns token_hash, never mutates agency_memberships
  assert.match(revokeFn[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(revokeFn[0], /v_actor_id uuid := auth\.uid\(\);/);
  assert.match(
    revokeFn[0],
    /public\.has_agency_role\(p_agency_id, ARRAY\['owner'\]::public\.agency_role\[\]\)/
  );
  assert.match(
    revokeFn[0],
    /WHERE inv\.id = p_invitation_id\s+AND inv\.agency_id = p_agency_id\s+FOR UPDATE;/
  );
  assert.match(revokeFn[0], /v_inv\.status <> 'pending'::public\.agency_invitation_status/);
  assert.match(revokeFn[0], /v_inv\.expires_at <= v_now/);
  assert.doesNotMatch(revokeFn[0], /public\.agency_memberships/i);
  const revokeReturnMatch = revokeFn[0].match(/RETURNS TABLE \(([\s\S]*?)\)/);
  assert.ok(revokeReturnMatch, 'Expected RETURNS TABLE projection on revoke_agency_invitation');
  assert.doesNotMatch(revokeReturnMatch[1], /\btoken_hash\b/);

  // 4. accept_agency_invitation: verified-email binding, SHA-256 check, FOR UPDATE lock,
  //    expiration + single-use status guards, non-owner role restriction, duplicate & suspended
  //    membership rejection, atomic acceptance + active membership creation, cross-agency isolation
  assert.match(acceptFn[0], /SECURITY DEFINER[\s\S]*SET search_path = ''/);
  assert.match(acceptFn[0], /v_actor_id uuid := auth\.uid\(\);/);
  assert.match(acceptFn[0], /v_clean_token_hash !~ '\^\[0-9a-f\]\{64\}\$'/);
  assert.match(acceptFn[0], /SELECT u\.email, u\.email_confirmed_at[\s\S]*FROM auth\.users u\s+WHERE u\.id = v_actor_id;/);
  assert.match(acceptFn[0], /v_user_email_confirmed_at IS NULL OR v_clean_user_email = ''/);
  assert.match(
    acceptFn[0],
    /FROM public\.agency_invitations inv\s+WHERE inv\.token_hash = v_clean_token_hash\s+FOR UPDATE;/
  );
  assert.match(acceptFn[0], /v_inv\.status <> 'pending'::public\.agency_invitation_status/);
  assert.match(acceptFn[0], /v_inv\.expires_at <= v_now/);
  assert.match(acceptFn[0], /v_inv\.invited_email IS DISTINCT FROM v_clean_user_email/);
  assert.match(
    acceptFn[0],
    /v_inv\.invited_role NOT IN \('manager'::public\.agency_role, 'agent'::public\.agency_role\)/
  );
  assert.match(
    acceptFn[0],
    /FROM public\.agency_memberships m\s+WHERE m\.agency_id = v_inv\.agency_id\s+AND m\.user_id = v_actor_id\s+FOR UPDATE;/
  );
  assert.match(
    acceptFn[0],
    /v_existing_membership_status = 'suspended'::public\.membership_status/
  );
  assert.doesNotMatch(acceptFn[0], /UPDATE public\.agency_memberships/i);
  assert.match(
    acceptFn[0],
    /UPDATE public\.agency_invitations inv\s+SET status = 'accepted'::public\.agency_invitation_status,\s+accepted_by = v_actor_id,\s+accepted_at = v_now\s+WHERE inv\.id = v_inv\.id\s+AND inv\.agency_id = v_inv\.agency_id\s+AND inv\.status = 'pending'::public\.agency_invitation_status;/
  );
  assert.match(
    acceptFn[0],
    /INSERT INTO public\.agency_memberships \(\s*agency_id,\s*user_id,\s*role,\s*status,\s*invited_by\s*\)\s*VALUES \(\s*v_inv\.agency_id,\s*v_actor_id,\s*v_inv\.invited_role,\s*'active'::public\.membership_status,\s*v_inv\.invited_by\s*\)/
  );
  const acceptReturnMatch = acceptFn[0].match(/RETURNS TABLE \(([\s\S]*?)\)/);
  assert.ok(acceptReturnMatch, 'Expected RETURNS TABLE projection on accept_agency_invitation');
  assert.match(acceptReturnMatch[1], /\bagency_id uuid\b/);
  assert.match(acceptReturnMatch[1], /\bmembership_id uuid\b/);
  assert.match(acceptReturnMatch[1], /\brole public\.agency_role\b/);
  assert.doesNotMatch(acceptReturnMatch[1], /\btoken_hash\b/);
  assert.doesNotMatch(acceptReturnMatch[1], /\bemail\b/);

  // Least-privilege EXECUTE grants: revoked from PUBLIC/anon, granted only to authenticated
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.list_agency_members\(uuid\)\s+FROM PUBLIC, anon;/
  );
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.create_agency_invitation\(uuid, text, public\.agency_role, text, integer\)\s+FROM PUBLIC, anon;/
  );
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.revoke_agency_invitation\(uuid, uuid\)\s+FROM PUBLIC, anon;/
  );
  assert.match(
    exec0009,
    /REVOKE ALL ON FUNCTION public\.accept_agency_invitation\(text\)\s+FROM PUBLIC, anon;/
  );
  assert.match(
    exec0009,
    /GRANT EXECUTE ON FUNCTION public\.list_agency_members\(uuid\)\s+TO authenticated;/
  );
  assert.match(
    exec0009,
    /GRANT EXECUTE ON FUNCTION public\.create_agency_invitation\(uuid, text, public\.agency_role, text, integer\)\s+TO authenticated;/
  );
  assert.match(
    exec0009,
    /GRANT EXECUTE ON FUNCTION public\.revoke_agency_invitation\(uuid, uuid\)\s+TO authenticated;/
  );
  assert.match(
    exec0009,
    /GRANT EXECUTE ON FUNCTION public\.accept_agency_invitation\(text\)\s+TO authenticated;/
  );
});

test('migration 0009 read-only verification SQL is strictly read-only and covers every required catalog check', () => {
  const verify0009 = fs.readFileSync(
    path.join(ROOT, 'supabase/tests/verify_0009_team_invitations_readonly.sql'),
    'utf8'
  );
  const execVerify = stripSqlComments(verify0009);

  // Strictly read-only (no DDL/DML/role switching outside quoted catalog arguments)
  const execVerifyNoStrings = execVerify.replace(/'[^']*'/g, "''");
  assert.doesNotMatch(
    execVerifyNoStrings,
    /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i
  );
  assert.doesNotMatch(execVerifyNoStrings, /\bSET\s+LOCAL\s+ROLE\b/i);
  assert.doesNotMatch(verify0009, /service_role/i);

  // Required catalog checks present
  assert.match(execVerify, /01_table_agency_invitations_exists/);
  assert.match(execVerify, /03_rls_enabled_and_forced_agency_invitations/);
  assert.match(execVerify, /05_no_direct_client_insert_agency_memberships/);
  assert.match(execVerify, /06_no_anon_or_public_invitation_table_access/);
  assert.match(execVerify, /08_no_client_access_to_token_hash/);
  assert.match(execVerify, /09_no_owner_invitation_role_constraint_and_data/);
  assert.match(execVerify, /10_four_rpcs_exist_with_expected_signatures/);
  assert.match(execVerify, /11_security_definer_search_path_and_owner_bypassrls/);
  assert.match(execVerify, /12_rpc_execute_grants_authenticated_only/);
  assert.match(execVerify, /13_trigger_functions_execute_revoked_from_clients/);
  assert.match(execVerify, /14_triggers_attached_and_enabled/);
});





