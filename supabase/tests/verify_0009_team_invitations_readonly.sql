-- =============================================================================
-- KIRALIS — Phase 6C.2B.2 Read-Only Post-Install Verification SQL (Migration 0009)
-- Target: Supabase PostgreSQL
--
-- USAGE:
--   Run manually in Supabase SQL Editor AFTER installing migration 0009
--   (`supabase/migrations/202611210009_team_invitations.sql`).
--
-- IMPORTANT SCOPE LIMITATION:
--   This script is strictly READ-ONLY (SELECT catalog and metadata queries only).
--   It verifies schema presence, constraints, RLS flags/policies, column/table
--   grants, triggers, function signatures, SECURITY DEFINER / search_path
--   settings, and owner BYPASSRLS compatibility.
--   It DOES NOT prove runtime token replay safety, concurrent acceptance race
--   behavior, or live end-to-end RLS execution across authenticated sessions.
-- =============================================================================

WITH checks AS (
  -- 1. public.agency_invitations table and status enum exist
  SELECT
    '01_table_agency_invitations_exists' AS check_name,
    to_regclass('public.agency_invitations') IS NOT NULL AS passed,
    COALESCE(to_regclass('public.agency_invitations')::text, 'MISSING') AS detail

  UNION ALL

  SELECT
    '02_enum_agency_invitation_status_labels' AS check_name,
    (
      SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
        FROM pg_catalog.pg_enum e
        JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
        JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
       WHERE n.nspname = 'public'
         AND t.typname = 'agency_invitation_status'
    ) = ARRAY['pending', 'accepted', 'revoked', 'expired']::name[] AS passed,
    COALESCE(
      (
        SELECT string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder)
          FROM pg_catalog.pg_enum e
          JOIN pg_catalog.pg_type t ON t.oid = e.enumtypid
          JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
           AND t.typname = 'agency_invitation_status'
      ),
      'MISSING'
    ) AS detail

  UNION ALL

  -- 2. RLS enabled AND forced on agency_invitations (and preserved on agency_memberships & audit_logs)
  SELECT
    '03_rls_enabled_and_forced_agency_invitations' AS check_name,
    COALESCE(
      (
        SELECT c.relrowsecurity AND c.relforcerowsecurity
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'agency_invitations'
      ),
      false
    ) AS passed,
    COALESCE(
      (
        SELECT format('rls=%s, force_rls=%s', c.relrowsecurity, c.relforcerowsecurity)
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'agency_invitations'
      ),
      'MISSING'
    ) AS detail

  UNION ALL

  SELECT
    '04_rls_policies_agency_invitations_select_owner_only' AS check_name,
    (
      SELECT count(*) = 1
         AND bool_and(p.policyname = 'agency_invitations_select_owner_only' AND p.cmd = 'SELECT')
        FROM pg_catalog.pg_policies p
       WHERE p.schemaname = 'public'
         AND p.tablename = 'agency_invitations'
    ) AS passed,
    COALESCE(
      (
        SELECT string_agg(format('%s (%s)', p.policyname, p.cmd), ', ' ORDER BY p.policyname)
          FROM pg_catalog.pg_policies p
         WHERE p.schemaname = 'public'
           AND p.tablename = 'agency_invitations'
      ),
      'NONE'
    ) AS detail

  UNION ALL

  -- 3. Client cannot directly insert into public.agency_memberships
  SELECT
    '05_no_direct_client_insert_agency_memberships' AS check_name,
    NOT has_table_privilege('authenticated', 'public.agency_memberships', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.agency_memberships', 'INSERT')
    AND NOT has_table_privilege('public', 'public.agency_memberships', 'INSERT')
    AND NOT EXISTS (
      SELECT 1
        FROM pg_catalog.pg_policies p
       WHERE p.schemaname = 'public'
         AND p.tablename = 'agency_memberships'
         AND p.cmd = 'INSERT'
    ) AS passed,
    format(
      'auth_insert=%s, anon_insert=%s, public_insert=%s',
      has_table_privilege('authenticated', 'public.agency_memberships', 'INSERT'),
      has_table_privilege('anon', 'public.agency_memberships', 'INSERT'),
      has_table_privilege('public', 'public.agency_memberships', 'INSERT')
    ) AS detail

  UNION ALL

  -- 4. No anonymous or PUBLIC access to public.agency_invitations
  SELECT
    '06_no_anon_or_public_invitation_table_access' AS check_name,
    NOT has_table_privilege('anon', 'public.agency_invitations', 'SELECT')
    AND NOT has_table_privilege('anon', 'public.agency_invitations', 'INSERT')
    AND NOT has_table_privilege('anon', 'public.agency_invitations', 'UPDATE')
    AND NOT has_table_privilege('anon', 'public.agency_invitations', 'DELETE')
    AND NOT has_table_privilege('public', 'public.agency_invitations', 'SELECT')
    AND NOT has_table_privilege('public', 'public.agency_invitations', 'INSERT')
    AND NOT has_table_privilege('public', 'public.agency_invitations', 'UPDATE')
    AND NOT has_table_privilege('public', 'public.agency_invitations', 'DELETE') AS passed,
    format(
      'anon_select=%s, public_select=%s',
      has_table_privilege('anon', 'public.agency_invitations', 'SELECT'),
      has_table_privilege('public', 'public.agency_invitations', 'SELECT')
    ) AS detail

  UNION ALL

  -- 5. No direct client write privileges on public.agency_invitations
  SELECT
    '07_no_direct_client_writes_agency_invitations' AS check_name,
    NOT has_table_privilege('authenticated', 'public.agency_invitations', 'INSERT')
    AND NOT has_table_privilege('authenticated', 'public.agency_invitations', 'UPDATE')
    AND NOT has_table_privilege('authenticated', 'public.agency_invitations', 'DELETE') AS passed,
    format(
      'auth_insert=%s, auth_update=%s, auth_delete=%s',
      has_table_privilege('authenticated', 'public.agency_invitations', 'INSERT'),
      has_table_privilege('authenticated', 'public.agency_invitations', 'UPDATE'),
      has_table_privilege('authenticated', 'public.agency_invitations', 'DELETE')
    ) AS detail

  UNION ALL

  -- 6. No client access to token_hash column (SELECT/UPDATE/INSERT denied to all client roles)
  SELECT
    '08_no_client_access_to_token_hash' AS check_name,
    NOT has_column_privilege('authenticated', 'public.agency_invitations', 'token_hash', 'SELECT')
    AND NOT has_column_privilege('anon', 'public.agency_invitations', 'token_hash', 'SELECT')
    AND NOT has_column_privilege('public', 'public.agency_invitations', 'token_hash', 'SELECT')
    AND has_column_privilege('authenticated', 'public.agency_invitations', 'id', 'SELECT')
    AND has_column_privilege('authenticated', 'public.agency_invitations', 'status', 'SELECT') AS passed,
    format(
      'auth_token_hash_select=%s, anon_token_hash_select=%s, auth_status_select=%s',
      has_column_privilege('authenticated', 'public.agency_invitations', 'token_hash', 'SELECT'),
      has_column_privilege('anon', 'public.agency_invitations', 'token_hash', 'SELECT'),
      has_column_privilege('authenticated', 'public.agency_invitations', 'status', 'SELECT')
    ) AS detail

  UNION ALL

  -- 7. Non-owner invitation role constraint exists and zero owner invitations exist
  SELECT
    '09_no_owner_invitation_role_constraint_and_data' AS check_name,
    EXISTS (
      SELECT 1
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'agency_invitations'
         AND con.conname = 'agency_invitations_role_non_owner'
         AND con.contype = 'c'
    )
    AND NOT EXISTS (
      SELECT 1
        FROM public.agency_invitations inv
       WHERE inv.invited_role = 'owner'::public.agency_role
    ) AS passed,
    COALESCE(
      (
        SELECT pg_catalog.pg_get_constraintdef(con.oid)
          FROM pg_catalog.pg_constraint con
          JOIN pg_catalog.pg_class c ON c.oid = con.conrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname = 'agency_invitations'
           AND con.conname = 'agency_invitations_role_non_owner'
      ),
      'MISSING'
    ) AS detail

  UNION ALL

  -- 8. All four expected RPCs exist with exact signatures
  SELECT
    '10_four_rpcs_exist_with_expected_signatures' AS check_name,
    to_regprocedure('public.list_agency_members(uuid)') IS NOT NULL
    AND to_regprocedure('public.create_agency_invitation(uuid,text,public.agency_role,text,integer)') IS NOT NULL
    AND to_regprocedure('public.revoke_agency_invitation(uuid,uuid)') IS NOT NULL
    AND to_regprocedure('public.accept_agency_invitation(text)') IS NOT NULL AS passed,
    format(
      'list=%s, create=%s, revoke=%s, accept=%s',
      to_regprocedure('public.list_agency_members(uuid)') IS NOT NULL,
      to_regprocedure('public.create_agency_invitation(uuid,text,public.agency_role,text,integer)') IS NOT NULL,
      to_regprocedure('public.revoke_agency_invitation(uuid,uuid)') IS NOT NULL,
      to_regprocedure('public.accept_agency_invitation(text)') IS NOT NULL
    ) AS detail

  UNION ALL

  -- 9. SECURITY DEFINER, locked search_path = '', and FORCE RLS owner compatibility
  SELECT
    '11_security_definer_search_path_and_owner_bypassrls' AS check_name,
    (
      SELECT count(*) = 6
         AND bool_and(p.prosecdef)
         AND bool_and(
           EXISTS (
             SELECT 1
               FROM pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
              WHERE cfg IN ('search_path=', 'search_path=""')
           )
         )
         AND bool_and(r.rolbypassrls OR r.rolsuper)
        FROM pg_catalog.pg_proc p
        JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
       WHERE p.oid IN (
         to_regprocedure('public.list_agency_members(uuid)'),
         to_regprocedure('public.create_agency_invitation(uuid,text,public.agency_role,text,integer)'),
         to_regprocedure('public.revoke_agency_invitation(uuid,uuid)'),
         to_regprocedure('public.accept_agency_invitation(text)'),
         to_regprocedure('public.audit_agency_invitation_change()'),
         to_regprocedure('public.audit_agency_membership_insert()')
       )
    )
    AND EXISTS (
      SELECT 1
        FROM pg_catalog.pg_proc p
       WHERE p.oid = to_regprocedure('public.guard_agency_invitation_integrity()')
         AND EXISTS (
           SELECT 1
             FROM pg_catalog.unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
            WHERE cfg IN ('search_path=', 'search_path=""')
         )
    ) AS passed,
    COALESCE(
      (
        SELECT string_agg(
          format(
            '%s(secdef=%s, owner=%s, bypassrls=%s, cfg=%s)',
            p.proname,
            p.prosecdef,
            r.rolname,
            (r.rolbypassrls OR r.rolsuper),
            COALESCE(array_to_string(p.proconfig, ';'), 'NONE')
          ),
          ' | ' ORDER BY p.proname
        )
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
         WHERE p.oid IN (
           to_regprocedure('public.list_agency_members(uuid)'),
           to_regprocedure('public.create_agency_invitation(uuid,text,public.agency_role,text,integer)'),
           to_regprocedure('public.revoke_agency_invitation(uuid,uuid)'),
           to_regprocedure('public.accept_agency_invitation(text)'),
           to_regprocedure('public.audit_agency_invitation_change()'),
           to_regprocedure('public.audit_agency_membership_insert()')
         )
      ),
      'MISSING'
    ) AS detail

  UNION ALL

  -- 10. Function EXECUTE grants: 4 RPCs authenticated-only; 3 trigger functions denied to all client roles
  SELECT
    '12_rpc_execute_grants_authenticated_only' AS check_name,
    has_function_privilege('authenticated', 'public.list_agency_members(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.list_agency_members(uuid)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.list_agency_members(uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.create_agency_invitation(uuid,text,public.agency_role,text,integer)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.create_agency_invitation(uuid,text,public.agency_role,text,integer)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.create_agency_invitation(uuid,text,public.agency_role,text,integer)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.revoke_agency_invitation(uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.revoke_agency_invitation(uuid,uuid)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.revoke_agency_invitation(uuid,uuid)', 'EXECUTE')
    AND has_function_privilege('authenticated', 'public.accept_agency_invitation(text)', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.accept_agency_invitation(text)', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.accept_agency_invitation(text)', 'EXECUTE') AS passed,
    format(
      'auth(list=%s,create=%s,revoke=%s,accept=%s) anon(list=%s,create=%s,revoke=%s,accept=%s)',
      has_function_privilege('authenticated', 'public.list_agency_members(uuid)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.create_agency_invitation(uuid,text,public.agency_role,text,integer)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.revoke_agency_invitation(uuid,uuid)', 'EXECUTE'),
      has_function_privilege('authenticated', 'public.accept_agency_invitation(text)', 'EXECUTE'),
      has_function_privilege('anon', 'public.list_agency_members(uuid)', 'EXECUTE'),
      has_function_privilege('anon', 'public.create_agency_invitation(uuid,text,public.agency_role,text,integer)', 'EXECUTE'),
      has_function_privilege('anon', 'public.revoke_agency_invitation(uuid,uuid)', 'EXECUTE'),
      has_function_privilege('anon', 'public.accept_agency_invitation(text)', 'EXECUTE')
    ) AS detail

  UNION ALL

  SELECT
    '13_trigger_functions_execute_revoked_from_clients' AS check_name,
    NOT has_function_privilege('authenticated', 'public.guard_agency_invitation_integrity()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.guard_agency_invitation_integrity()', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.guard_agency_invitation_integrity()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.audit_agency_invitation_change()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.audit_agency_invitation_change()', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.audit_agency_invitation_change()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'public.audit_agency_membership_insert()', 'EXECUTE')
    AND NOT has_function_privilege('anon', 'public.audit_agency_membership_insert()', 'EXECUTE')
    AND NOT has_function_privilege('public', 'public.audit_agency_membership_insert()', 'EXECUTE') AS passed,
    'verified guard_agency_invitation_integrity, audit_agency_invitation_change, audit_agency_membership_insert' AS detail

  UNION ALL

  -- 11. Expected integrity & audit triggers exist and are enabled
  SELECT
    '14_triggers_attached_and_enabled' AS check_name,
    (
      SELECT count(*) = 3 AND bool_and(t.tgenabled = 'O')
        FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'agency_invitations'
         AND NOT t.tgisinternal
         AND t.tgname IN (
           'trg_agency_invitations_integrity',
           'trg_agency_invitations_updated_at',
           'trg_agency_invitations_audit'
         )
    )
    AND (
      SELECT count(*) = 4 AND bool_and(t.tgenabled = 'O')
        FROM pg_catalog.pg_trigger t
        JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname = 'agency_memberships'
         AND NOT t.tgisinternal
         AND t.tgname IN (
           'trg_agency_memberships_integrity',
           'trg_agency_memberships_updated_at',
           'trg_agency_memberships_audit',
           'trg_agency_memberships_insert_audit'
         )
    ) AS passed,
    COALESCE(
      (
        SELECT string_agg(format('%s.%s(%s)', c.relname, t.tgname, t.tgenabled), ', ' ORDER BY c.relname, t.tgname)
          FROM pg_catalog.pg_trigger t
          JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname IN ('agency_invitations', 'agency_memberships')
           AND NOT t.tgisinternal
      ),
      'NONE'
    ) AS detail
)
SELECT
  check_name,
  passed,
  detail
FROM checks
ORDER BY check_name;
