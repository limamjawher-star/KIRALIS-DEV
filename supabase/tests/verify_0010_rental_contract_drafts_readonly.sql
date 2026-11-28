-- KIRALIS 0010 — READ-ONLY CONTRACT SCHEMA VERIFICATION
-- Run in Supabase SQL Editor AFTER applying migration 0010.
-- Contains no INSERT, UPDATE, DELETE, DDL or fixture data.

SELECT 'table_exists' AS test,
  (to_regclass('public.rental_contracts') IS NOT NULL) AS passed;

SELECT 'rls_enabled_forced' AS test,
  COALESCE(c.relrowsecurity AND c.relforcerowsecurity, false) AS passed
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='rental_contracts';

SELECT 'authenticated_read' AS test,
  pg_catalog.has_table_privilege('authenticated','public.rental_contracts','SELECT') AS passed;

SELECT 'no_client_update_delete' AS test,
  NOT pg_catalog.has_table_privilege('authenticated','public.rental_contracts','UPDATE')
  AND NOT pg_catalog.has_table_privilege('authenticated','public.rental_contracts','DELETE')
  AND NOT pg_catalog.has_table_privilege('anon','public.rental_contracts','SELECT')
  AS passed;

SELECT 'insert_limited_columns' AS test,
  pg_catalog.has_column_privilege('authenticated','public.rental_contracts','agency_id','INSERT')
  AND pg_catalog.has_column_privilege('authenticated','public.rental_contracts','reservation_id','INSERT')
  AND pg_catalog.has_column_privilege('authenticated','public.rental_contracts','created_by','INSERT')
  AND NOT pg_catalog.has_column_privilege('authenticated','public.rental_contracts','status','INSERT')
  AND NOT pg_catalog.has_column_privilege('authenticated','public.rental_contracts','contract_number','INSERT')
  AS passed;

SELECT 'tenant_policies' AS test,
  (SELECT count(*) FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='rental_contracts'
   AND policyname IN ('rental_contracts_select_members','rental_contracts_insert_manager_owner')) = 2 AS passed;

SELECT 'composite_tenant_fk' AS test,
  EXISTS(
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.rental_contracts'::regclass
      AND conname='rental_contracts_reservation_same_agency_fk'
      AND contype='f'
  ) AS passed;

SELECT 'unique_agency_reservation' AS test,
  EXISTS(
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.rental_contracts'::regclass
      AND conname='rental_contracts_agency_reservation_unique'
      AND contype='u'
  ) AS passed;

SELECT 'audit_and_guard_triggers' AS test,
  count(*) = 3 AS passed
FROM pg_catalog.pg_trigger
WHERE tgrelid='public.rental_contracts'::regclass
  AND NOT tgisinternal AND tgenabled<>'D'
  AND tgname IN (
    'trg_audit_rental_contract_draft_creation',
    'trg_guard_rental_contract_draft',
    'trg_set_updated_at_rental_contracts'
  );

SELECT 'trigger_helpers_not_publicly_executable' AS test,
  NOT pg_catalog.has_function_privilege(
    'authenticated','public.guard_rental_contract_draft()','EXECUTE')
  AND NOT pg_catalog.has_function_privilege(
    'authenticated','public.audit_rental_contract_draft_creation()','EXECUTE')
  AND NOT pg_catalog.has_function_privilege(
    'anon','public.guard_rental_contract_draft()','EXECUTE')
  AS passed;

-- EXTRA LIVE MANUAL TESTS REQUIRED BEFORE APPROVAL:
-- 1. Owner and Manager create one draft for confirmed booking in own agency.
-- 2. Agent cannot insert, owner of another agency cannot read or insert.
-- 3. INSERT for pending/cancelled reservation must fail.
-- 4. Duplicate draft for same reservation fails (23505).
-- 5. Client cannot change status/contract_number or delete any contract.
-- 6. audit_logs has exact non-sensitive contract.draft_created event.
