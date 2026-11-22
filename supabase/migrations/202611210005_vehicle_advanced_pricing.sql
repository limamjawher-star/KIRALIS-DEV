-- =============================================================================
-- KIRALIS — Phase 5B.2 Migration 0005: Advanced Vehicle Pricing
-- Target: Supabase PostgreSQL (additive, non-destructive)
--
-- Purpose:
--   1. Extends public.vehicles with optional fixed 7-day (weekly_rate_minor)
--      and 30-day (monthly_rate_minor) package rates in integer minor units.
--   2. Creates public.vehicle_seasonal_rates for inclusive seasonal date ranges
--      with database-level same-agency referential integrity and PostgreSQL
--      GiST exclusion preventing overlapping active seasonal ranges per vehicle.
--   3. Preserves Owner/Manager/Agent RLS permissions and least-privilege grants
--      (no client DELETE, no client audit_logs INSERT).
--   4. Adds a trusted SECURITY DEFINER audit trigger for pricing changes.
--
-- IMPORTANT:
--   - Preserve migrations 0001–0004 without modification.
--   - Do NOT re-execute previous migrations.
--   - Review and apply manually in Supabase SQL Editor.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. Verify btree_gist extension & set explicit transaction-local search_path
--    (pg_catalog first, followed by the verified btree_gist schema so GiST UUID
--    equality operators resolve deterministically without reinstalling or
--    relocating the extension and without relying on implicit editor defaults)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_btree_gist_schema text;
BEGIN
  SELECT n.nspname
    INTO v_btree_gist_schema
    FROM pg_catalog.pg_extension e
    JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
   WHERE e.extname = 'btree_gist';

  IF v_btree_gist_schema IS NULL THEN
    RAISE EXCEPTION
      'Required extension "btree_gist" is not installed. Ensure migration 0001 has been applied before migration 0005.'
      USING ERRCODE = '0A000';
  END IF;

  IF v_btree_gist_schema = 'pg_catalog' THEN
    SET LOCAL search_path = pg_catalog;
  ELSE
    EXECUTE pg_catalog.format(
      'SET LOCAL search_path = pg_catalog, %I',
      v_btree_gist_schema
    );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 1. Extend public.vehicles with optional 7-day & 30-day package columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS weekly_rate_minor bigint,
  ADD COLUMN IF NOT EXISTS monthly_rate_minor bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_weekly_rate_minor_non_negative'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_weekly_rate_minor_non_negative
      CHECK (weekly_rate_minor IS NULL OR weekly_rate_minor >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_monthly_rate_minor_non_negative'
      AND conrelid = 'public.vehicles'::regclass
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_monthly_rate_minor_non_negative
      CHECK (monthly_rate_minor IS NULL OR monthly_rate_minor >= 0);
  END IF;
END
$$;

-- Extend column-level UPDATE grant on public.vehicles ONLY for the new pricing
-- columns (preserving immutable id, agency_id, created_by, created_at and RLS).
GRANT UPDATE (
  weekly_rate_minor,
  monthly_rate_minor
) ON TABLE public.vehicles TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. Create public.vehicle_seasonal_rates (minimal tenant-safe seasonal pricing)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicle_seasonal_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL,
  label text CHECK (label IS NULL OR char_length(btrim(label)) BETWEEN 1 AND 80),
  start_date date NOT NULL,
  end_date date NOT NULL,
  daily_rate_minor bigint NOT NULL CHECK (daily_rate_minor >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Database-level guarantee that vehicle belongs to the exact same agency
  CONSTRAINT vehicle_seasonal_rates_vehicle_same_agency_fk
    FOREIGN KEY (agency_id, vehicle_id)
    REFERENCES public.vehicles (agency_id, id)
    ON DELETE CASCADE,

  -- Inclusive date range must be valid (single-day range start_date = end_date allowed)
  CONSTRAINT vehicle_seasonal_rates_valid_range
    CHECK (end_date >= start_date),

  -- Prevent overlapping active seasonal ranges for the same vehicle.
  -- Inclusive daterange('[]') canonicalizes to [start, end + 1 day), so adjacent
  -- ranges (e.g. Jul 1..10 and Jul 11..20) remain permitted while any shared day
  -- raises SQLSTATE 23P01 (exclusion_violation).
  CONSTRAINT vehicle_seasonal_rates_no_overlap_active
    EXCLUDE USING gist (
      agency_id WITH =,
      vehicle_id WITH =,
      daterange(start_date, end_date, '[]') WITH &&
    )
    WHERE (is_active)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_seasonal_rates_agency_vehicle
  ON public.vehicle_seasonal_rates (agency_id, vehicle_id, is_active, start_date, end_date);

-- -----------------------------------------------------------------------------
-- 3. Integrity & Transactional Audit Trigger Functions (strict search_path = '')
-- -----------------------------------------------------------------------------

-- Lock immutable ownership and attribution columns on public.vehicle_seasonal_rates
CREATE OR REPLACE FUNCTION public.guard_vehicle_seasonal_rate_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'Changing agency_id on an existing seasonal rate is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id THEN
    RAISE EXCEPTION 'Changing vehicle_id on an existing seasonal rate is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    -- Allow ONLY legitimate PostgreSQL FK ON DELETE SET NULL cascade when an
    -- auth.users row is deleted:
    --   1. Strictly nullification (non-null -> NULL; ownership/attribution can never be reassigned)
    --   2. Must originate from a nested FK/cascade trigger (pg_trigger_depth() > 1)
    --   3. Never permitted for client roles (defense-in-depth alongside column GRANTs)
    --   4. No pricing/rule columns may be modified in the same UPDATE
    IF NOT (
      OLD.created_by IS NOT NULL
      AND NEW.created_by IS NULL
      AND pg_catalog.pg_trigger_depth() > 1
      AND current_user NOT IN ('anon', 'authenticated')
      AND NEW.label IS NOT DISTINCT FROM OLD.label
      AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
      AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
      AND NEW.daily_rate_minor IS NOT DISTINCT FROM OLD.daily_rate_minor
      AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
    ) THEN
      RAISE EXCEPTION 'Changing created_by on an existing seasonal rate is forbidden.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing created_at on an existing seasonal rate is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Server-trusted transactional audit trigger for vehicle pricing & seasonal rules
-- (never callable directly by clients; preserves Phase 3 audit_logs lockdown)
CREATE OR REPLACE FUNCTION public.audit_vehicle_pricing_change()
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
  IF TG_TABLE_NAME = 'vehicles' THEN
    IF TG_OP = 'UPDATE' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'vehicle.pricing_updated';
      v_metadata := pg_catalog.jsonb_build_object(
        'plate_number', NEW.plate_number,
        'from_daily_rate_minor', OLD.daily_rate_minor,
        'to_daily_rate_minor', NEW.daily_rate_minor,
        'from_weekly_rate_minor', OLD.weekly_rate_minor,
        'to_weekly_rate_minor', NEW.weekly_rate_minor,
        'from_monthly_rate_minor', OLD.monthly_rate_minor,
        'to_monthly_rate_minor', NEW.monthly_rate_minor
      );
    ELSE
      RETURN NULL;
    END IF;

  ELSIF TG_TABLE_NAME = 'vehicle_seasonal_rates' THEN
    IF TG_OP = 'INSERT' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'vehicle_seasonal_rate.created';
      v_metadata := pg_catalog.jsonb_build_object(
        'vehicle_id', NEW.vehicle_id,
        'start_date', NEW.start_date,
        'end_date', NEW.end_date,
        'daily_rate_minor', NEW.daily_rate_minor,
        'is_active', NEW.is_active
      );
    ELSIF TG_OP = 'UPDATE' THEN
      -- Ignore pure foreign-key attribution nullification (auth.users ON DELETE SET NULL)
      -- so user deletion never fails on audit_logs.actor_user_id or writes spurious updates.
      IF OLD.created_by IS NOT NULL
         AND NEW.created_by IS NULL
         AND NEW.label IS NOT DISTINCT FROM OLD.label
         AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
         AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
         AND NEW.daily_rate_minor IS NOT DISTINCT FROM OLD.daily_rate_minor
         AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active THEN
        RETURN NULL;
      END IF;

      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      IF OLD.is_active IS TRUE AND NEW.is_active IS FALSE THEN
        v_action := 'vehicle_seasonal_rate.deactivated';
      ELSIF OLD.is_active IS FALSE AND NEW.is_active IS TRUE THEN
        v_action := 'vehicle_seasonal_rate.reactivated';
      ELSE
        v_action := 'vehicle_seasonal_rate.updated';
      END IF;
      v_metadata := pg_catalog.jsonb_build_object(
        'vehicle_id', NEW.vehicle_id,
        'from_start_date', OLD.start_date,
        'to_start_date', NEW.start_date,
        'from_end_date', OLD.end_date,
        'to_end_date', NEW.end_date,
        'from_daily_rate_minor', OLD.daily_rate_minor,
        'to_daily_rate_minor', NEW.daily_rate_minor,
        'from_is_active', OLD.is_active,
        'to_is_active', NEW.is_active
      );
    ELSE
      RETURN NULL;
    END IF;
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
REVOKE ALL ON FUNCTION public.guard_vehicle_seasonal_rate_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_vehicle_pricing_change() FROM PUBLIC, anon, authenticated;

-- Attach triggers
DROP TRIGGER IF EXISTS trg_vehicle_seasonal_rates_updated_at ON public.vehicle_seasonal_rates;
CREATE TRIGGER trg_vehicle_seasonal_rates_updated_at
  BEFORE UPDATE ON public.vehicle_seasonal_rates
  FOR EACH ROW
  WHEN (
    OLD.label IS DISTINCT FROM NEW.label
    OR OLD.start_date IS DISTINCT FROM NEW.start_date
    OR OLD.end_date IS DISTINCT FROM NEW.end_date
    OR OLD.daily_rate_minor IS DISTINCT FROM NEW.daily_rate_minor
    OR OLD.is_active IS DISTINCT FROM NEW.is_active
  )
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicle_seasonal_rates_integrity ON public.vehicle_seasonal_rates;
CREATE TRIGGER trg_vehicle_seasonal_rates_integrity
  BEFORE UPDATE ON public.vehicle_seasonal_rates
  FOR EACH ROW EXECUTE FUNCTION public.guard_vehicle_seasonal_rate_integrity();

DROP TRIGGER IF EXISTS trg_vehicle_seasonal_rates_audit ON public.vehicle_seasonal_rates;
CREATE TRIGGER trg_vehicle_seasonal_rates_audit
  AFTER INSERT OR UPDATE ON public.vehicle_seasonal_rates
  FOR EACH ROW EXECUTE FUNCTION public.audit_vehicle_pricing_change();

DROP TRIGGER IF EXISTS trg_vehicles_pricing_audit ON public.vehicles;
CREATE TRIGGER trg_vehicles_pricing_audit
  AFTER UPDATE ON public.vehicles
  FOR EACH ROW
  WHEN (
    OLD.daily_rate_minor IS DISTINCT FROM NEW.daily_rate_minor
    OR OLD.weekly_rate_minor IS DISTINCT FROM NEW.weekly_rate_minor
    OR OLD.monthly_rate_minor IS DISTINCT FROM NEW.monthly_rate_minor
  )
  EXECUTE FUNCTION public.audit_vehicle_pricing_change();

-- -----------------------------------------------------------------------------
-- 4. Least-Privilege SQL Grants & Forced Row Level Security
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.vehicle_seasonal_rates FROM PUBLIC, anon, authenticated;

-- No DELETE grant: seasonal rules are deactivated (is_active = false) to preserve history
GRANT SELECT, INSERT ON TABLE public.vehicle_seasonal_rates TO authenticated;
GRANT UPDATE (
  label,
  start_date,
  end_date,
  daily_rate_minor,
  is_active
) ON TABLE public.vehicle_seasonal_rates TO authenticated;

ALTER TABLE public.vehicle_seasonal_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_seasonal_rates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vehicle_seasonal_rates_select_active_member ON public.vehicle_seasonal_rates;
CREATE POLICY vehicle_seasonal_rates_select_active_member
  ON public.vehicle_seasonal_rates
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS vehicle_seasonal_rates_insert_owner_manager ON public.vehicle_seasonal_rates;
CREATE POLICY vehicle_seasonal_rates_insert_owner_manager
  ON public.vehicle_seasonal_rates
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[])
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS vehicle_seasonal_rates_update_owner_manager ON public.vehicle_seasonal_rates;
CREATE POLICY vehicle_seasonal_rates_update_owner_manager
  ON public.vehicle_seasonal_rates
  FOR UPDATE
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]))
  WITH CHECK (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]));

COMMIT;
