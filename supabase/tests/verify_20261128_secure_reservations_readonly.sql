-- KIRALIS live booking repair — READ ONLY POST-INSTALL VERIFICATION
-- Run after reviewed migration 202611280001, against the intended project.
-- No data modifications. All rows returned should have passed=true.

SELECT 'creation_rpc_installed' AS test,
  to_regprocedure('public.create_agency_reservation_secure(uuid,uuid,timestamptz,timestamptz,text,text,text,bigint,bigint)') IS NOT NULL AS passed
UNION ALL
SELECT 'transition_rpc_installed',
  to_regprocedure('public.transition_reservation_status(uuid,public.reservation_status)') IS NOT NULL
UNION ALL
SELECT 'booking_overlap_constraint',
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint
    WHERE conrelid='public.reservations'::regclass
      AND conname='reservations_no_overlapping_confirmed_active' AND contype='x'
  )
UNION ALL
SELECT 'core_rls_forced',
  EXISTS (
    SELECT 1 FROM pg_catalog.pg_class
    WHERE oid='public.reservations'::regclass AND relrowsecurity AND relforcerowsecurity
  )
UNION ALL
SELECT 'no_direct_reservation_insert',
  NOT has_table_privilege('authenticated','public.reservations','INSERT')
  AND NOT has_column_privilege('authenticated','public.reservations','agency_id','INSERT')
UNION ALL
SELECT 'no_direct_reservation_update_delete',
  NOT has_table_privilege('authenticated','public.reservations','UPDATE')
  AND NOT has_table_privilege('authenticated','public.reservations','DELETE')
UNION ALL
SELECT 'only_tenant_read_reservations',
  (SELECT count(*) FROM pg_catalog.pg_policies
   WHERE schemaname='public' AND tablename='reservations'
     AND cmd='SELECT' AND policyname='reservations_select_active_member') = 1
UNION ALL
SELECT 'no_unsafe_client_table_privileges',
  NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname IN (
      'agencies','agency_memberships','vehicles','customers','reservations',
      'audit_logs','vehicle_seasonal_rates','customer_drivers'
    ) AND c.relkind='r'
      AND (
        has_table_privilege('authenticated',c.oid,'TRUNCATE') OR
        has_table_privilege('authenticated',c.oid,'TRIGGER') OR
        has_table_privilege('authenticated',c.oid,'REFERENCES') OR
        has_table_privilege('anon',c.oid,'TRUNCATE')
      )
  )
UNION ALL
SELECT 'audit_log_not_mutable',
  NOT has_table_privilege('authenticated','public.audit_logs','INSERT')
  AND NOT has_table_privilege('authenticated','public.audit_logs','UPDATE')
  AND NOT has_table_privilege('authenticated','public.audit_logs','DELETE')
  AND NOT has_table_privilege('authenticated','public.audit_logs','TRUNCATE')
UNION ALL
SELECT 'booking_audit_triggers_active',
  (SELECT count(*) FROM pg_catalog.pg_trigger
   WHERE tgrelid='public.reservations'::regclass
     AND tgname='trg_reservations_audit_booking'
     AND tgenabled='O')=1
UNION ALL
SELECT 'auth_has_secure_rpc_only',
  has_function_privilege(
    'authenticated',
    'public.create_agency_reservation_secure(uuid,uuid,timestamptz,timestamptz,text,text,text,bigint,bigint)',
    'EXECUTE'
  ) AND has_function_privilege(
    'authenticated','public.transition_reservation_status(uuid,public.reservation_status)','EXECUTE'
  ) AND NOT has_function_privilege(
    'anon','public.create_agency_reservation_secure(uuid,uuid,timestamptz,timestamptz,text,text,text,bigint,bigint)',
    'EXECUTE'
  )
UNION ALL
SELECT 'event_trigger_helper_not_callable',
  NOT has_function_privilege('anon','public.rls_auto_enable()','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.rls_auto_enable()','EXECUTE')
UNION ALL
SELECT 'membership_trigger_helper_not_callable',
  NOT has_function_privilege('authenticated','public.guard_agency_membership_integrity()','EXECUTE');
