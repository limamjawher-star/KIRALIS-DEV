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
});
