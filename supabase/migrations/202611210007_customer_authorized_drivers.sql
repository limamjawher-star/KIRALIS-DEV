-- =============================================================================
-- KIRALIS — Phase 6B.1 Migration 0007: Customer Authorized Drivers Foundation
-- Target: Supabase PostgreSQL (additive, non-destructive)
--
-- Purpose:
--   1. Adds public.driver_verification_status enum and public.customer_drivers
--      table supporting individual customers, corporate customers, and multiple
--      authorized drivers per customer.
--   2. Collects only minimal operational driving-licence metadata (NO licence
--      numbers, NO passport/national ID numbers, NO document scans).
--   3. Enforces database-level same-agency customer integrity via composite FK
--      to public.customers (agency_id, id).
--   4. Enforces forced tenant-scoped RLS:
--      - Owner & Manager: SELECT, INSERT, column-limited UPDATE
--      - Agent: SELECT only (read authorized driver metadata)
--      - No client DELETE privilege or policy (use is_active = false to revoke)
--   5. Protects immutable IDs/ownership/attribution while safely supporting
--      auth.users ON DELETE SET NULL cascades on created_by.
--   6. Adds a trusted SECURITY DEFINER audit trigger writing privacy-minimized
--      metadata to public.audit_logs without granting direct client INSERT.
--
-- IMPORTANT:
--   - Preserve migrations 0001–0006 without modification.
--   - Do NOT re-execute previous migrations.
--   - Review and apply manually in Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Verification Status Enum (idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'driver_verification_status'
  ) THEN
    CREATE TYPE public.driver_verification_status AS ENUM (
      'unverified',
      'pending',
      'verified',
      'rejected'
    );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Authorized Drivers Table (minimal necessary operational metadata)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL,
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 140),
  licence_issuing_country text CHECK (
    licence_issuing_country IS NULL
    OR licence_issuing_country ~ '^[A-Z]{2}$'
  ),
  licence_category text CHECK (
    licence_category IS NULL
    OR licence_category ~ '^[A-Z][A-Z0-9+]{0,9}$'
  ),
  licence_expires_on date CHECK (
    licence_expires_on IS NULL
    OR licence_expires_on BETWEEN DATE '1980-01-01' AND DATE '2150-12-31'
  ),
  verification_status public.driver_verification_status NOT NULL DEFAULT 'unverified',
  verification_notes text CHECK (
    verification_notes IS NULL
    OR char_length(btrim(verification_notes)) <= 1000
  ),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique key enables future cross-agency-proof FKs (e.g. reservations)
  CONSTRAINT customer_drivers_tenant_id_unique
    UNIQUE (agency_id, id),

  -- Database-level guarantee that the referenced customer belongs to the same agency.
  -- Direct client DELETE is revoked on both public.customers and public.customer_drivers;
  -- ON DELETE CASCADE ensures clean admin-level agency teardown without FK deadlocks.
  CONSTRAINT customer_drivers_customer_same_agency_fk
    FOREIGN KEY (agency_id, customer_id)
    REFERENCES public.customers (agency_id, id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_customer_drivers_agency_customer
  ON public.customer_drivers (agency_id, customer_id, is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_drivers_agency_status_expiry
  ON public.customer_drivers (agency_id, verification_status, licence_expires_on);

-- -----------------------------------------------------------------------------
-- 3. Integrity & Transactional Audit Trigger Functions (locked search_path = '')
-- -----------------------------------------------------------------------------

-- Lock immutable identity, tenant ownership, customer link, and creation attribution
CREATE OR REPLACE FUNCTION public.guard_customer_driver_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'Changing id on an existing customer driver is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'Changing agency_id on an existing customer driver is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id THEN
    RAISE EXCEPTION 'Changing customer_id on an existing customer driver is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    -- Allow ONLY legitimate PostgreSQL FK ON DELETE SET NULL cascade when an
    -- auth.users row is deleted:
    --   1. Strictly nullification (non-null -> NULL; attribution cannot be reassigned)
    --   2. Must originate from a nested FK/cascade trigger (pg_trigger_depth() > 1)
    --   3. Never permitted for client roles (defense-in-depth alongside column GRANTs)
    --   4. No driver metadata columns may change in the same UPDATE
    IF NOT (
      OLD.created_by IS NOT NULL
      AND NEW.created_by IS NULL
      AND pg_catalog.pg_trigger_depth() > 1
      AND current_user NOT IN ('anon', 'authenticated')
      AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
      AND NEW.licence_issuing_country IS NOT DISTINCT FROM OLD.licence_issuing_country
      AND NEW.licence_category IS NOT DISTINCT FROM OLD.licence_category
      AND NEW.licence_expires_on IS NOT DISTINCT FROM OLD.licence_expires_on
      AND NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status
      AND NEW.verification_notes IS NOT DISTINCT FROM OLD.verification_notes
      AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
    ) THEN
      RAISE EXCEPTION 'Changing created_by on an existing customer driver is forbidden.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing created_at on an existing customer driver is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Server-trusted transactional audit trigger for authorized driver records.
-- Never callable directly by clients; preserves Phase 3 audit_logs lockdown.
-- Logs only operational metadata (no raw personal names or free-text notes).
CREATE OR REPLACE FUNCTION public.audit_customer_driver_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_agency_id uuid;
  v_entity_id uuid;
  v_action text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME <> 'customer_drivers' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_agency_id := NEW.agency_id;
    v_entity_id := NEW.id;
    v_action := 'customer_driver.created';
    v_metadata := pg_catalog.jsonb_build_object(
      'customer_id', NEW.customer_id,
      'licence_issuing_country', NEW.licence_issuing_country,
      'licence_category', NEW.licence_category,
      'licence_expires_on', NEW.licence_expires_on,
      'verification_status', NEW.verification_status,
      'is_active', NEW.is_active
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Ignore pure foreign-key attribution nullification (auth.users ON DELETE SET NULL)
    IF OLD.created_by IS NOT NULL
       AND NEW.created_by IS NULL
       AND NEW.full_name IS NOT DISTINCT FROM OLD.full_name
       AND NEW.licence_issuing_country IS NOT DISTINCT FROM OLD.licence_issuing_country
       AND NEW.licence_category IS NOT DISTINCT FROM OLD.licence_category
       AND NEW.licence_expires_on IS NOT DISTINCT FROM OLD.licence_expires_on
       AND NEW.verification_status IS NOT DISTINCT FROM OLD.verification_status
       AND NEW.verification_notes IS NOT DISTINCT FROM OLD.verification_notes
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
      RETURN NULL;
    END IF;

    v_agency_id := NEW.agency_id;
    v_entity_id := NEW.id;
    IF OLD.verification_status IS DISTINCT FROM NEW.verification_status THEN
      v_action := 'customer_driver.verification_status_changed';
    ELSIF OLD.is_active IS TRUE AND NEW.is_active IS FALSE THEN
      v_action := 'customer_driver.deactivated';
    ELSIF OLD.is_active IS FALSE AND NEW.is_active IS TRUE THEN
      v_action := 'customer_driver.reactivated';
    ELSE
      v_action := 'customer_driver.updated';
    END IF;

    v_metadata := pg_catalog.jsonb_build_object(
      'customer_id', NEW.customer_id,
      'from_verification_status', OLD.verification_status,
      'to_verification_status', NEW.verification_status,
      'from_licence_expires_on', OLD.licence_expires_on,
      'to_licence_expires_on', NEW.licence_expires_on,
      'licence_issuing_country', NEW.licence_issuing_country,
      'licence_category', NEW.licence_category,
      'from_is_active', OLD.is_active,
      'to_is_active', NEW.is_active
    );
  ELSE
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_logs (
    agency_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_agency_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    v_entity_id,
    v_metadata
  );

  RETURN NULL;
END;
$$;

-- Revoke direct execute privileges on trigger functions from all client roles
REVOKE ALL ON FUNCTION public.guard_customer_driver_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_customer_driver_change() FROM PUBLIC, anon, authenticated;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_customer_drivers_updated_at ON public.customer_drivers;
CREATE TRIGGER trg_customer_drivers_updated_at
  BEFORE UPDATE ON public.customer_drivers
  FOR EACH ROW
  WHEN (
    OLD.full_name IS DISTINCT FROM NEW.full_name
    OR OLD.licence_issuing_country IS DISTINCT FROM NEW.licence_issuing_country
    OR OLD.licence_category IS DISTINCT FROM NEW.licence_category
    OR OLD.licence_expires_on IS DISTINCT FROM NEW.licence_expires_on
    OR OLD.verification_status IS DISTINCT FROM NEW.verification_status
    OR OLD.verification_notes IS DISTINCT FROM NEW.verification_notes
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
  )
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customer_drivers_integrity ON public.customer_drivers;
CREATE TRIGGER trg_customer_drivers_integrity
  BEFORE UPDATE ON public.customer_drivers
  FOR EACH ROW EXECUTE FUNCTION public.guard_customer_driver_integrity();

DROP TRIGGER IF EXISTS trg_customer_drivers_audit ON public.customer_drivers;
CREATE TRIGGER trg_customer_drivers_audit
  AFTER INSERT OR UPDATE ON public.customer_drivers
  FOR EACH ROW EXECUTE FUNCTION public.audit_customer_driver_change();

-- -----------------------------------------------------------------------------
-- 4. Least-Privilege SQL Grants & Forced Row Level Security
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.customer_drivers FROM PUBLIC, anon, authenticated;

-- No DELETE grant: drivers are deactivated (is_active = false) to preserve history
GRANT SELECT, INSERT ON TABLE public.customer_drivers TO authenticated;
GRANT UPDATE (
  full_name,
  licence_issuing_country,
  licence_category,
  licence_expires_on,
  verification_status,
  verification_notes,
  is_active
) ON TABLE public.customer_drivers TO authenticated;

ALTER TABLE public.customer_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_drivers FORCE ROW LEVEL SECURITY;

-- Owner, Manager, and Agent can read authorized drivers within their active agency
DROP POLICY IF EXISTS customer_drivers_select_active_member ON public.customer_drivers;
CREATE POLICY customer_drivers_select_active_member
  ON public.customer_drivers
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

-- Only Owner and Manager can create authorized driver records
DROP POLICY IF EXISTS customer_drivers_insert_owner_manager ON public.customer_drivers;
CREATE POLICY customer_drivers_insert_owner_manager
  ON public.customer_drivers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[])
    AND created_by = auth.uid()
  );

-- Only Owner and Manager can update authorized driver metadata & verification status
DROP POLICY IF EXISTS customer_drivers_update_owner_manager ON public.customer_drivers;
CREATE POLICY customer_drivers_update_owner_manager
  ON public.customer_drivers
  FOR UPDATE
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]))
  WITH CHECK (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]));

-- Direct client DELETE policy is intentionally absent.

COMMIT;
