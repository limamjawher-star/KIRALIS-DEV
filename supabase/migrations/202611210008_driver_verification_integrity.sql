-- =============================================================================
-- KIRALIS — Phase 6B.4A Migration 0008: Driver Verification Integrity Hardening
-- Target: Supabase PostgreSQL (additive, non-destructive, idempotent)
--
-- Purpose:
--   Atomically enforces driver verification integrity at the database layer on
--   public.customer_drivers so both API PATCH requests and authorized direct
--   Supabase UPDATE requests obey the same security invariants:
--
--   1. Material changes to driver identity or driving-licence metadata
--      (full_name, licence_issuing_country, licence_category, licence_expires_on)
--      invalidate any prior 'verified' status by resetting verification_status
--      to 'unverified', requiring renewed manual agency verification.
--   2. A single UPDATE cannot simultaneously change those material fields and
--      transition a non-verified driver into 'verified' (rejected atomically
--      with SQLSTATE 23514 / customer_drivers_verification_integrity_check).
--   3. Even if an already-verified row receives an UPDATE that modifies a
--      material field while keeping or re-sending verification_status = 'verified',
--      the trigger forces NEW.verification_status := 'unverified' so the row can
--      never remain 'verified' after a material change.
--   4. Updates limited to verification_notes and/or is_active (with no material
--      identity/licence change) preserve existing verification_status.
--   5. 'pending' and 'rejected' statuses are never promoted to 'verified' during
--      material updates and remain intact unless explicitly changed to another
--      non-verified status.
--   6. Preserves all existing migrations 0001–0007, Owner/Manager/Agent RLS,
--      column-level UPDATE grants, DELETE revocation, and transactional audit
--      logging.
--
-- Trigger Execution Order on public.customer_drivers (UPDATE):
--   PostgreSQL fires BEFORE triggers in alphabetical order by trigger name,
--   followed by row persistence (and RETURNING), then AFTER triggers:
--
--   1. trg_customer_drivers_integrity              (BEFORE UPDATE, migration 0007)
--      -> Blocks changes to immutable columns (id, agency_id, customer_id,
--         created_by except FK ON DELETE SET NULL cascade, created_at).
--   2. trg_customer_drivers_integrity_verification (BEFORE UPDATE, migration 0008)
--      -> Runs strictly after immutable-column checks and strictly before
--         updated_at stamping. Rejects simultaneous material change + promotion
--         to 'verified', or resets previously 'verified' rows to 'unverified'.
--   3. trg_customer_drivers_updated_at             (BEFORE UPDATE, migration 0007)
--      -> Evaluates its WHEN clause against the final validated NEW row and
--         updates updated_at = now() only when the UPDATE succeeds.
--   4. Row write + RETURNING clause
--      -> PostgREST / Supabase .update(...).select(...) returns the actual
--         persisted verification_status (e.g. 'unverified') and updated_at.
--   5. trg_customer_drivers_audit                  (AFTER INSERT OR UPDATE, migration 0007)
--      -> Sees OLD.verification_status = 'verified' and NEW.verification_status
--         = 'unverified' when invalidated, writing a single transactional
--         public.audit_logs row ('customer_driver.verification_status_changed')
--         with privacy-minimized metadata. Aborted UPDATEs roll back cleanly
--         and write no audit log entry.
--
-- IMPORTANT:
--   - Preserve migrations 0001–0007 without modification.
--   - Do NOT re-execute previous migrations.
--   - Review and apply manually in Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Driver Verification Integrity Trigger Function (locked search_path = '')
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_customer_driver_verification_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_material_changed boolean;
BEGIN
  IF TG_TABLE_NAME <> 'customer_drivers' OR TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  -- Material identity and driving-licence metadata fields.
  -- verification_notes and is_active are intentionally excluded.
  v_material_changed := (
    NEW.full_name IS DISTINCT FROM OLD.full_name
    OR NEW.licence_issuing_country IS DISTINCT FROM OLD.licence_issuing_country
    OR NEW.licence_category IS DISTINCT FROM OLD.licence_category
    OR NEW.licence_expires_on IS DISTINCT FROM OLD.licence_expires_on
  );

  IF NOT v_material_changed THEN
    RETURN NEW;
  END IF;

  -- Reject any single UPDATE that simultaneously modifies material fields and
  -- tries to establish 'verified' status from a non-verified state.
  IF NEW.verification_status = 'verified'::public.driver_verification_status
     AND OLD.verification_status IS DISTINCT FROM 'verified'::public.driver_verification_status THEN
    RAISE EXCEPTION
      'Cannot mark a customer driver as verified in the same update that modifies driver identity or licence metadata.'
      USING ERRCODE = '23514',
            CONSTRAINT = 'customer_drivers_verification_integrity_check';
  END IF;

  -- Invalidate prior 'verified' status whenever material fields change and the
  -- caller did not already transition to a non-verified status.
  IF OLD.verification_status = 'verified'::public.driver_verification_status
     AND NEW.verification_status = 'verified'::public.driver_verification_status THEN
    NEW.verification_status := 'unverified'::public.driver_verification_status;
  END IF;

  RETURN NEW;
END;
$$;

-- Prevent direct execution of the trigger function by client roles
REVOKE ALL ON FUNCTION public.enforce_customer_driver_verification_integrity()
  FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Attach Narrowly Scoped BEFORE UPDATE Trigger (idempotent)
--    Name chosen so PostgreSQL ASCII trigger ordering is guaranteed:
--      trg_customer_drivers_integrity
--      < trg_customer_drivers_integrity_verification
--      < trg_customer_drivers_updated_at
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_customer_drivers_integrity_verification
  ON public.customer_drivers;

CREATE TRIGGER trg_customer_drivers_integrity_verification
  BEFORE UPDATE ON public.customer_drivers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_customer_driver_verification_integrity();

COMMIT;
