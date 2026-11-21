-- =============================================================================
-- KIRALIS — Phase 3 Migration 0003: Additive Security Lockdown Synchronization
-- Target: Supabase PostgreSQL (Supabase Auth exclusively)
--
-- Status:
--   This additive migration records the exact temporary security lockdown
--   already applied manually to the live Supabase database.
--   DO NOT re-execute against a live database where this lockdown is already
--   active unless intentionally reconciling privileges (all statements below
--   are idempotent and preserve all existing tables and data).
--
-- Verified privilege posture after lockdown:
--   - can_insert_audit_logs   = false
--   - can_insert_memberships  = false
--   - can_update_reservations = false
--   - can_execute_audit_rpc   = false
--   - create_agency (authenticated EXECUTE) = true
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lock down client-side audit_logs insertion & legacy audit RPC
-- -----------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.audit_logs FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS audit_logs_insert_active_member ON public.audit_logs;

-- Safely revoke execute on legacy public.record_audit_log if present in the database
-- (no-op if the function was already omitted in a fresh installation)
DO $$
BEGIN
  IF to_regprocedure('public.record_audit_log(uuid,text,text,uuid,jsonb)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.record_audit_log(uuid, text, text, uuid, jsonb)
      FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Lock down direct agency_memberships insertion (deferred team invitations)
-- -----------------------------------------------------------------------------
REVOKE INSERT ON TABLE public.agency_memberships FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS memberships_insert_controlled ON public.agency_memberships;

-- -----------------------------------------------------------------------------
-- 3. Lock down direct reservations UPDATE pending server-authoritative workflows
-- -----------------------------------------------------------------------------
REVOKE UPDATE ON TABLE public.reservations FROM PUBLIC, anon, authenticated;
DROP POLICY IF EXISTS reservations_update_active_member ON public.reservations;

-- -----------------------------------------------------------------------------
-- 4. Preserve & reaffirm Phase 4 Supabase Auth onboarding grants
--    - create_agency must remain callable by authenticated users (never anon/PUBLIC)
--    - RLS helper functions must remain callable by authenticated users
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_active_agency_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_agency_role(uuid, public.agency_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_agency(
  text, text, text, text, text, text, text, text, text, text, smallint, text, text, integer
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_agency_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, public.agency_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency(
  text, text, text, text, text, text, text, text, text, text, smallint, text, text, integer
) TO authenticated;
