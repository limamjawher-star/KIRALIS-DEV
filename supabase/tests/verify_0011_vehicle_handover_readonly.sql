-- KIRALIS 0011: READ-ONLY POST-INSTALL CHECKS
-- Run after review/install of 0010 and 0011. No data mutation.

SELECT 'handover_table_exists' AS check_name,
       to_regclass('public.vehicle_handover_inspections') IS NOT NULL AS passed;

SELECT 'handover_rls_forced' AS check_name,
       c.relrowsecurity AND c.relforcerowsecurity AS passed
FROM pg_catalog.pg_class c
WHERE c.oid='public.vehicle_handover_inspections'::regclass;

SELECT 'no_anonymous_access' AS check_name,
       NOT has_table_privilege('anon','public.vehicle_handover_inspections','SELECT')
       AND NOT has_table_privilege('anon','public.vehicle_handover_inspections','INSERT') AS passed;

SELECT 'no_staff_mutations_after_insert' AS check_name,
       NOT has_table_privilege('authenticated','public.vehicle_handover_inspections','UPDATE')
       AND NOT has_table_privilege('authenticated','public.vehicle_handover_inspections','DELETE') AS passed;

SELECT 'staff_can_read_and_narrow_insert' AS check_name,
       has_table_privilege('authenticated','public.vehicle_handover_inspections','SELECT')
       AND has_column_privilege('authenticated','public.vehicle_handover_inspections','odometer_km','INSERT')
       AND has_column_privilege('authenticated','public.vehicle_handover_inspections','staff_attested','INSERT')
       AND NOT has_column_privilege('authenticated','public.vehicle_handover_inspections','id','INSERT')
       AND NOT has_column_privilege('authenticated','public.vehicle_handover_inspections','created_at','INSERT') AS passed;

SELECT 'required_rls_policies' AS check_name,
       COUNT(*)=2 AS passed
FROM pg_catalog.pg_policies
WHERE schemaname='public' AND tablename='vehicle_handover_inspections'
  AND policyname IN ('handover_select_active_staff','handover_insert_active_staff');

SELECT 'cross_tenant_composite_fk' AS check_name,
       EXISTS(SELECT 1 FROM pg_catalog.pg_constraint
       WHERE conrelid='public.vehicle_handover_inspections'::regclass
         AND contype='f' AND conname='handover_reservation_tenant_fk') AS passed;

SELECT 'unique_per_reservation_and_kind' AS check_name,
       EXISTS(SELECT 1 FROM pg_catalog.pg_constraint
       WHERE conrelid='public.vehicle_handover_inspections'::regclass
         AND contype='u' AND conname='handover_one_per_kind') AS passed;

SELECT 'insert_validation_and_audit_triggers' AS check_name,
       COUNT(*)=2 AS passed
FROM pg_catalog.pg_trigger
WHERE tgrelid='public.vehicle_handover_inspections'::regclass
  AND tgname IN ('trg_validate_handover_inspection_insert','trg_audit_handover_inspection_insert')
  AND NOT tgisinternal AND tgenabled <> 'D';

SELECT 'no_public_trigger_rpc' AS check_name,
       NOT has_function_privilege('anon','public.validate_handover_inspection_insert()','EXECUTE')
       AND NOT has_function_privilege('authenticated','public.validate_handover_inspection_insert()','EXECUTE')
       AND NOT has_function_privilege('anon','public.audit_handover_inspection_insert()','EXECUTE') AS passed;

-- Live two-agency acceptance (needs actual staff accounts, not fake data):
-- Owner/Manager/Agent from Agency A insert pickup for confirmed/active booking A;
-- unauthorized Agency B read/write denied; unconfirmed booking insert denied;
-- return without pickup rejected; return mileage < pickup rejected;
-- duplicate pickup/return rejected; unauthorized update/delete rejected;
-- staff attest saved as auth.uid and audit metadata excludes sensitive notes;
-- confirmed return and staff sign-off do NOT constitute customer signature.
