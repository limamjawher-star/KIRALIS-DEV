-- =============================================================================
-- KIRALIS — Phase 3 Migration 0001: Initial Multi-Tenant Schema & Constraints
-- Target: Supabase PostgreSQL (uses auth.users from Supabase Auth exclusively)
-- =============================================================================

-- Extensions required for UUID generation and GiST booking overlap prevention
-- Installed in the Supabase "extensions" schema to keep "public" clean
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- Domain Enums
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'agency_role'
  ) THEN
    CREATE TYPE public.agency_role AS ENUM ('owner', 'manager', 'agent');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'membership_status'
  ) THEN
    CREATE TYPE public.membership_status AS ENUM ('active', 'invited', 'suspended');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'vehicle_status'
  ) THEN
    CREATE TYPE public.vehicle_status AS ENUM ('available', 'rented', 'maintenance', 'retired');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'customer_type'
  ) THEN
    CREATE TYPE public.customer_type AS ENUM ('individual', 'corporate');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'reservation_status'
  ) THEN
    CREATE TYPE public.reservation_status AS ENUM (
      'draft',
      'pending',
      'confirmed',
      'active',
      'completed',
      'cancelled'
    );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 1. agencies
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 120),
  legal_name text,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' AND char_length(slug) BETWEEN 2 AND 80),
  tax_id text,
  email text,
  phone text,
  city text,
  address text,
  country_code text NOT NULL DEFAULT 'TN' CHECK (country_code ~ '^[A-Z]{2}$'),
  currency_code text NOT NULL DEFAULT 'TND' CHECK (currency_code ~ '^[A-Z]{3}$'),
  currency_minor_unit smallint NOT NULL DEFAULT 3 CHECK (currency_minor_unit BETWEEN 0 AND 4),
  timezone text NOT NULL DEFAULT 'Africa/Tunis' CHECK (char_length(btrim(timezone)) BETWEEN 3 AND 64),
  default_locale text NOT NULL DEFAULT 'fr' CHECK (default_locale IN ('fr', 'en', 'ar')),
  vat_rate_bps integer NOT NULL DEFAULT 1900 CHECK (vat_rate_bps BETWEEN 0 AND 10000),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agencies_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_agencies_created_at
  ON public.agencies (created_at DESC);

-- -----------------------------------------------------------------------------
-- 2. agency_memberships
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  role public.agency_role NOT NULL DEFAULT 'agent',
  status public.membership_status NOT NULL DEFAULT 'active',
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_memberships_unique_member UNIQUE (agency_id, user_id),
  CONSTRAINT agency_memberships_tenant_id_unique UNIQUE (agency_id, id)
);

CREATE INDEX IF NOT EXISTS idx_agency_memberships_user_active
  ON public.agency_memberships (user_id, agency_id, role)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_agency_memberships_agency_role
  ON public.agency_memberships (agency_id, role, status);

-- -----------------------------------------------------------------------------
-- 3. vehicles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  plate_number text NOT NULL CHECK (char_length(btrim(plate_number)) BETWEEN 2 AND 32),
  vin text,
  brand text NOT NULL CHECK (char_length(btrim(brand)) BETWEEN 1 AND 60),
  model text NOT NULL CHECK (char_length(btrim(model)) BETWEEN 1 AND 60),
  model_year smallint CHECK (model_year IS NULL OR model_year BETWEEN 1980 AND 2100),
  category text NOT NULL DEFAULT 'compact' CHECK (char_length(btrim(category)) BETWEEN 2 AND 40),
  transmission text NOT NULL DEFAULT 'manual' CHECK (transmission IN ('manual', 'automatic')),
  fuel_type text NOT NULL DEFAULT 'petrol' CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'lpg')),
  seats smallint NOT NULL DEFAULT 5 CHECK (seats BETWEEN 1 AND 20),
  odometer_km integer NOT NULL DEFAULT 0 CHECK (odometer_km >= 0),
  daily_rate_minor bigint NOT NULL CHECK (daily_rate_minor >= 0),
  deposit_minor bigint NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  currency_code text NOT NULL DEFAULT 'TND' CHECK (currency_code ~ '^[A-Z]{3}$'),
  status public.vehicle_status NOT NULL DEFAULT 'available',
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Composite unique key enables cross-agency-proof foreign keys from child tables
  CONSTRAINT vehicles_tenant_id_unique UNIQUE (agency_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_agency_plate_unique
  ON public.vehicles (agency_id, lower(btrim(plate_number)));

CREATE INDEX IF NOT EXISTS idx_vehicles_agency_status
  ON public.vehicles (agency_id, status);

CREATE INDEX IF NOT EXISTS idx_vehicles_agency_created_at
  ON public.vehicles (agency_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 4. customers
-- Note: Sensitive identity and driver-license document fields are intentionally
-- omitted from the initial MVP schema and can be added in a later phase with
-- dedicated access controls and retention rules.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  customer_type public.customer_type NOT NULL DEFAULT 'individual',
  full_name text NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 140),
  company_name text,
  email text,
  phone text NOT NULL CHECK (char_length(btrim(phone)) BETWEEN 6 AND 30),
  address text,
  city text,
  country_code text NOT NULL DEFAULT 'TN' CHECK (country_code ~ '^[A-Z]{2}$'),
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Composite unique key enables cross-agency-proof foreign keys from child tables
  CONSTRAINT customers_tenant_id_unique UNIQUE (agency_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_agency_email_unique
  ON public.customers (agency_id, lower(btrim(email)))
  WHERE email IS NOT NULL AND btrim(email) <> '';

CREATE INDEX IF NOT EXISTS idx_customers_agency_full_name
  ON public.customers (agency_id, full_name);

CREATE INDEX IF NOT EXISTS idx_customers_agency_phone
  ON public.customers (agency_id, phone);

-- -----------------------------------------------------------------------------
-- 5. reservations
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  reference_code text NOT NULL CHECK (char_length(btrim(reference_code)) BETWEEN 3 AND 40),
  vehicle_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'pending',
  pickup_at timestamptz NOT NULL,
  return_at timestamptz NOT NULL,
  pickup_location text,
  return_location text,
  -- Integer minor-unit storage (1.000 TND = 1000 millimes)
  currency_code text NOT NULL DEFAULT 'TND' CHECK (currency_code ~ '^[A-Z]{3}$'),
  daily_rate_minor bigint NOT NULL CHECK (daily_rate_minor >= 0),
  subtotal_minor bigint NOT NULL CHECK (subtotal_minor >= 0),
  tax_minor bigint NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
  discount_minor bigint NOT NULL DEFAULT 0 CHECK (discount_minor >= 0),
  total_minor bigint NOT NULL CHECK (total_minor >= 0),
  deposit_minor bigint NOT NULL DEFAULT 0 CHECK (deposit_minor >= 0),
  notes text,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique key for downstream tenant-scoped references (contracts, payments)
  CONSTRAINT reservations_tenant_id_unique UNIQUE (agency_id, id),

  -- Strict protection against cross-agency vehicle or customer references
  CONSTRAINT reservations_vehicle_same_agency_fk
    FOREIGN KEY (agency_id, vehicle_id)
    REFERENCES public.vehicles (agency_id, id)
    ON DELETE RESTRICT,
  CONSTRAINT reservations_customer_same_agency_fk
    FOREIGN KEY (agency_id, customer_id)
    REFERENCES public.customers (agency_id, id)
    ON DELETE RESTRICT,

  -- Temporal and monetary invariants
  CONSTRAINT reservations_valid_window CHECK (return_at > pickup_at),
  CONSTRAINT reservations_total_math CHECK (
    total_minor = subtotal_minor + tax_minor - discount_minor
  ),

  -- Database-level prevention of overlapping confirmed or active bookings per vehicle
  -- Uses half-open [pickup_at, return_at) so back-to-back handovers are permitted
  CONSTRAINT reservations_no_overlapping_confirmed_active
    EXCLUDE USING gist (
      agency_id WITH =,
      vehicle_id WITH =,
      tstzrange(pickup_at, return_at, '[)') WITH &&
    )
    WHERE (status IN ('confirmed', 'active'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_agency_reference_unique
  ON public.reservations (agency_id, upper(btrim(reference_code)));

CREATE INDEX IF NOT EXISTS idx_reservations_agency_status_pickup
  ON public.reservations (agency_id, status, pickup_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_agency_vehicle_window
  ON public.reservations (agency_id, vehicle_id, pickup_at, return_at);

CREATE INDEX IF NOT EXISTS idx_reservations_agency_customer
  ON public.reservations (agency_id, customer_id, created_at DESC);

-- -----------------------------------------------------------------------------
-- 6. audit_logs (append-only, server-generated, tenant-scoped)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (char_length(btrim(action)) BETWEEN 2 AND 80),
  entity_type text NOT NULL CHECK (char_length(btrim(entity_type)) BETWEEN 2 AND 60),
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_agency_created_at
  ON public.audit_logs (agency_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_agency_entity
  ON public.audit_logs (agency_id, entity_type, entity_id);

-- -----------------------------------------------------------------------------
-- Integrity Trigger Functions (strict search_path = '')
-- -----------------------------------------------------------------------------

-- 1. Automatic updated_at maintenance using native timestamptz now()
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

-- 2. Lock immutable creation attribution on public.agencies
CREATE OR REPLACE FUNCTION public.guard_agency_immutable_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Changing created_by on an existing agency is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing created_at on an existing agency is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Prevent moving an existing tenant-owned row to another agency or forging creation attribution
CREATE OR REPLACE FUNCTION public.prevent_tenant_reassignment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'Changing agency_id on an existing tenant record is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Changing created_by on an existing tenant record is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing created_at on an existing tenant record is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Guard reservation immutability for historical rows and immutable attribution
CREATE OR REPLACE FUNCTION public.guard_reservation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status IN ('completed'::public.reservation_status, 'cancelled'::public.reservation_status) THEN
    RAISE EXCEPTION 'Completed or cancelled reservations are immutable.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
    RAISE EXCEPTION 'Changing agency_id on an existing reservation is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.reference_code IS DISTINCT FROM OLD.reference_code THEN
    RAISE EXCEPTION 'Changing reference_code on an existing reservation is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Changing created_by on an existing reservation is forbidden.'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Changing created_at on an existing reservation is forbidden.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Membership integrity & concurrency-safe last active owner protection
--    Locks the parent agency row FOR UPDATE before counting remaining owners so
--    concurrent demotions/removals cannot leave an agency without an active owner.
CREATE OR REPLACE FUNCTION public.guard_agency_membership_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  remaining_owners integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Changing agency_id on an existing membership is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Changing user_id on an existing membership is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
      RAISE EXCEPTION 'Changing invited_by on an existing membership is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Changing created_at on an existing membership is forbidden.'
        USING ERRCODE = '42501';
    END IF;

    -- Prevent arbitrary activation of invited users without an accepted invitation workflow
    IF OLD.status = 'invited'::public.membership_status
       AND NEW.status = 'active'::public.membership_status THEN
      RAISE EXCEPTION 'Invited memberships cannot be activated directly without an accepted invitation.'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role = 'owner'::public.agency_role
       AND OLD.status = 'active'::public.membership_status
       AND (
         NEW.role <> 'owner'::public.agency_role
         OR NEW.status <> 'active'::public.membership_status
       ) THEN
      -- Serialize concurrent owner mutations per agency
      PERFORM 1
        FROM public.agencies a
       WHERE a.id = OLD.agency_id
         FOR UPDATE;

      SELECT count(*)
        INTO remaining_owners
        FROM public.agency_memberships m
       WHERE m.agency_id = OLD.agency_id
         AND m.role = 'owner'::public.agency_role
         AND m.status = 'active'::public.membership_status
         AND m.id <> OLD.id;

      IF remaining_owners = 0 THEN
        RAISE EXCEPTION 'An agency must retain at least one active owner.'
          USING ERRCODE = 'P0001';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.role = 'owner'::public.agency_role
       AND OLD.status = 'active'::public.membership_status THEN
      -- Lock parent agency row; if NOT FOUND, the parent agency itself is being CASCADE-deleted
      PERFORM 1
        FROM public.agencies a
       WHERE a.id = OLD.agency_id
         FOR UPDATE;

      IF FOUND THEN
        SELECT count(*)
          INTO remaining_owners
          FROM public.agency_memberships m
         WHERE m.agency_id = OLD.agency_id
           AND m.role = 'owner'::public.agency_role
           AND m.status = 'active'::public.membership_status
           AND m.id <> OLD.id;

        IF remaining_owners = 0 THEN
          RAISE EXCEPTION 'Cannot remove the last active owner of an agency.'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

-- 6. Enforce append-only immutability on audit_logs
CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are immutable and cannot be modified or deleted.'
    USING ERRCODE = '42501';
END;
$$;

-- -----------------------------------------------------------------------------
-- Attach Triggers
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_agencies_updated_at ON public.agencies;
CREATE TRIGGER trg_agencies_updated_at
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agencies_lock_immutable ON public.agencies;
CREATE TRIGGER trg_agencies_lock_immutable
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.guard_agency_immutable_fields();

DROP TRIGGER IF EXISTS trg_agency_memberships_updated_at ON public.agency_memberships;
CREATE TRIGGER trg_agency_memberships_updated_at
  BEFORE UPDATE ON public.agency_memberships
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agency_memberships_integrity ON public.agency_memberships;
CREATE TRIGGER trg_agency_memberships_integrity
  BEFORE UPDATE OR DELETE ON public.agency_memberships
  FOR EACH ROW EXECUTE FUNCTION public.guard_agency_membership_integrity();

DROP TRIGGER IF EXISTS trg_vehicles_updated_at ON public.vehicles;
CREATE TRIGGER trg_vehicles_updated_at
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_vehicles_lock_tenant ON public.vehicles;
CREATE TRIGGER trg_vehicles_lock_tenant
  BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();

DROP TRIGGER IF EXISTS trg_customers_updated_at ON public.customers;
CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_customers_lock_tenant ON public.customers;
CREATE TRIGGER trg_customers_lock_tenant
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.prevent_tenant_reassignment();

DROP TRIGGER IF EXISTS trg_reservations_updated_at ON public.reservations;
CREATE TRIGGER trg_reservations_updated_at
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_reservations_lock_tenant ON public.reservations;
DROP TRIGGER IF EXISTS trg_reservations_integrity ON public.reservations;
CREATE TRIGGER trg_reservations_integrity
  BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_reservation_integrity();

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_logs_immutable
  BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_audit_log_mutation();

-- Revoke direct execute privileges on all trigger functions from client roles
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_agency_immutable_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_tenant_reassignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_reservation_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_agency_membership_integrity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_audit_log_mutation() FROM PUBLIC, anon, authenticated;
