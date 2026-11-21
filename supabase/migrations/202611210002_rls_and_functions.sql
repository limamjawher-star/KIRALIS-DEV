-- =============================================================================
-- KIRALIS — Phase 3 Migration 0002: Row Level Security & Permission-Checked RPCs
-- Target: Supabase PostgreSQL (Supabase Auth exclusively)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Lock Down Default Privileges (least-privilege table & column GRANTs)
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE
  public.agencies,
  public.agency_memberships,
  public.vehicles,
  public.customers,
  public.reservations,
  public.audit_logs
FROM PUBLIC, anon, authenticated;

-- Grant minimal table & column privileges to authenticated; RLS enforces tenant & role checks.
-- agencies: direct INSERT and DELETE are disallowed (must use public.create_agency).
GRANT SELECT ON TABLE public.agencies TO authenticated;
GRANT UPDATE (
  name,
  legal_name,
  slug,
  tax_id,
  email,
  phone,
  city,
  address,
  country_code,
  currency_code,
  currency_minor_unit,
  timezone,
  default_locale,
  vat_rate_bps
) ON TABLE public.agencies TO authenticated;

-- agency_memberships: direct INSERT is disallowed in MVP (no arbitrary member activation).
-- Initial owner membership is created exclusively inside public.create_agency().
GRANT SELECT, DELETE ON TABLE public.agency_memberships TO authenticated;
GRANT UPDATE (role, status) ON TABLE public.agency_memberships TO authenticated;

-- vehicles: immutable attribution columns (id, agency_id, created_by, created_at) excluded from UPDATE.
GRANT SELECT, INSERT, DELETE ON TABLE public.vehicles TO authenticated;
GRANT UPDATE (
  plate_number,
  vin,
  brand,
  model,
  model_year,
  category,
  transmission,
  fuel_type,
  seats,
  odometer_km,
  daily_rate_minor,
  deposit_minor,
  currency_code,
  status,
  notes
) ON TABLE public.vehicles TO authenticated;

-- customers: immutable attribution columns excluded from UPDATE.
GRANT SELECT, INSERT, DELETE ON TABLE public.customers TO authenticated;
GRANT UPDATE (
  customer_type,
  full_name,
  company_name,
  email,
  phone,
  address,
  city,
  country_code,
  notes
) ON TABLE public.customers TO authenticated;

-- reservations: direct UPDATE is restricted exclusively to operational fields.
-- Status transitions must go through public.transition_reservation_status().
-- Pre-confirmation pricing/reference changes must go through public.update_pending_reservation_terms().
GRANT SELECT, INSERT, DELETE ON TABLE public.reservations TO authenticated;
GRANT UPDATE (
  pickup_location,
  return_location,
  notes,
  updated_by
) ON TABLE public.reservations TO authenticated;

-- audit_logs: strictly read-only for authorized roles (no client INSERT/UPDATE/DELETE).
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

-- -----------------------------------------------------------------------------
-- 2. RLS Helper Functions (SECURITY DEFINER + search_path = '' to prevent recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_active_agency_member(p_agency_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.agency_memberships m
      WHERE m.agency_id = p_agency_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
    );
$$;

CREATE OR REPLACE FUNCTION public.has_agency_role(
  p_agency_id uuid,
  p_allowed_roles public.agency_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.agency_memberships m
      WHERE m.agency_id = p_agency_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'::public.membership_status
        AND m.role = ANY (p_allowed_roles)
    );
$$;

-- -----------------------------------------------------------------------------
-- 3. Trusted Transactional Audit Trigger (never callable directly by clients)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_sensitive_change()
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
  IF TG_TABLE_NAME = 'agencies' THEN
    IF TG_OP = 'UPDATE' THEN
      v_agency_id := NEW.id;
      v_entity_id := NEW.id;
      v_action := 'agency.updated';
      v_metadata := pg_catalog.jsonb_build_object(
        'slug', NEW.slug,
        'currency_code', NEW.currency_code,
        'timezone', NEW.timezone
      );
    ELSE
      RETURN NULL;
    END IF;

  ELSIF TG_TABLE_NAME = 'agency_memberships' THEN
    IF TG_OP = 'UPDATE' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'membership.updated';
      v_metadata := pg_catalog.jsonb_build_object(
        'target_user_id', NEW.user_id,
        'from_role', OLD.role,
        'to_role', NEW.role,
        'from_status', OLD.status,
        'to_status', NEW.status
      );
    ELSIF TG_OP = 'DELETE' THEN
      IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id) THEN
        RETURN NULL;
      END IF;
      v_agency_id := OLD.agency_id;
      v_entity_id := OLD.id;
      v_action := 'membership.deleted';
      v_metadata := pg_catalog.jsonb_build_object(
        'target_user_id', OLD.user_id,
        'role', OLD.role,
        'status', OLD.status
      );
    ELSE
      RETURN NULL;
    END IF;

  ELSIF TG_TABLE_NAME = 'vehicles' THEN
    IF TG_OP = 'INSERT' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'vehicle.created';
      v_metadata := pg_catalog.jsonb_build_object(
        'plate_number', NEW.plate_number,
        'status', NEW.status,
        'daily_rate_minor', NEW.daily_rate_minor
      );
    ELSIF TG_OP = 'UPDATE' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'vehicle.updated';
      v_metadata := pg_catalog.jsonb_build_object(
        'plate_number', NEW.plate_number,
        'from_status', OLD.status,
        'to_status', NEW.status,
        'daily_rate_minor', NEW.daily_rate_minor
      );
    ELSIF TG_OP = 'DELETE' THEN
      IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id) THEN
        RETURN NULL;
      END IF;
      v_agency_id := OLD.agency_id;
      v_entity_id := OLD.id;
      v_action := 'vehicle.deleted';
      v_metadata := pg_catalog.jsonb_build_object(
        'plate_number', OLD.plate_number
      );
    ELSE
      RETURN NULL;
    END IF;

  ELSIF TG_TABLE_NAME = 'reservations' THEN
    IF TG_OP = 'INSERT' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      v_action := 'reservation.created';
      v_metadata := pg_catalog.jsonb_build_object(
        'reference_code', NEW.reference_code,
        'status', NEW.status,
        'total_minor', NEW.total_minor,
        'currency_code', NEW.currency_code
      );
    ELSIF TG_OP = 'UPDATE' THEN
      v_agency_id := NEW.agency_id;
      v_entity_id := NEW.id;
      IF OLD.status IS DISTINCT FROM NEW.status THEN
        v_action := 'reservation.status_changed';
        v_metadata := pg_catalog.jsonb_build_object(
          'reference_code', NEW.reference_code,
          'from_status', OLD.status,
          'to_status', NEW.status
        );
      ELSIF OLD.vehicle_id IS DISTINCT FROM NEW.vehicle_id
         OR OLD.customer_id IS DISTINCT FROM NEW.customer_id
         OR OLD.pickup_at IS DISTINCT FROM NEW.pickup_at
         OR OLD.return_at IS DISTINCT FROM NEW.return_at
         OR OLD.daily_rate_minor IS DISTINCT FROM NEW.daily_rate_minor
         OR OLD.subtotal_minor IS DISTINCT FROM NEW.subtotal_minor
         OR OLD.tax_minor IS DISTINCT FROM NEW.tax_minor
         OR OLD.discount_minor IS DISTINCT FROM NEW.discount_minor
         OR OLD.total_minor IS DISTINCT FROM NEW.total_minor
         OR OLD.deposit_minor IS DISTINCT FROM NEW.deposit_minor THEN
        v_action := 'reservation.terms_updated';
        v_metadata := pg_catalog.jsonb_build_object(
          'reference_code', NEW.reference_code,
          'from_total_minor', OLD.total_minor,
          'to_total_minor', NEW.total_minor,
          'status', NEW.status
        );
      ELSE
        v_action := 'reservation.updated';
        v_metadata := pg_catalog.jsonb_build_object(
          'reference_code', NEW.reference_code,
          'status', NEW.status
        );
      END IF;
    ELSIF TG_OP = 'DELETE' THEN
      IF NOT EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = OLD.agency_id) THEN
        RETURN NULL;
      END IF;
      v_agency_id := OLD.agency_id;
      v_entity_id := OLD.id;
      v_action := 'reservation.deleted';
      v_metadata := pg_catalog.jsonb_build_object(
        'reference_code', OLD.reference_code,
        'status', OLD.status
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

DROP TRIGGER IF EXISTS trg_agencies_audit ON public.agencies;
CREATE TRIGGER trg_agencies_audit
  AFTER UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_agency_memberships_audit ON public.agency_memberships;
CREATE TRIGGER trg_agency_memberships_audit
  AFTER UPDATE OR DELETE ON public.agency_memberships
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_vehicles_audit ON public.vehicles;
CREATE TRIGGER trg_vehicles_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

DROP TRIGGER IF EXISTS trg_reservations_audit ON public.reservations;
CREATE TRIGGER trg_reservations_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_sensitive_change();

-- -----------------------------------------------------------------------------
-- 4. Secure Agency Creation RPC (derives owner strictly from auth.uid())
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_agency(
  p_name text,
  p_slug text,
  p_legal_name text DEFAULT NULL,
  p_tax_id text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_country_code text DEFAULT 'TN',
  p_currency_code text DEFAULT 'TND',
  p_currency_minor_unit smallint DEFAULT 3,
  p_timezone text DEFAULT 'Africa/Tunis',
  p_default_locale text DEFAULT 'fr',
  p_vat_rate_bps integer DEFAULT 1900
)
RETURNS public.agencies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_clean_name text := pg_catalog.btrim(COALESCE(p_name, ''));
  v_clean_slug text := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_slug, '')));
  v_agency public.agencies;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create an agency.'
      USING ERRCODE = '42501';
  END IF;

  IF pg_catalog.char_length(v_clean_name) < 2 OR pg_catalog.char_length(v_clean_name) > 120 THEN
    RAISE EXCEPTION 'Agency name must be between 2 and 120 characters.'
      USING ERRCODE = '22023';
  END IF;

  IF v_clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
     OR pg_catalog.char_length(v_clean_slug) < 2
     OR pg_catalog.char_length(v_clean_slug) > 80 THEN
    RAISE EXCEPTION 'Agency slug must be 2 to 80 lowercase alphanumeric characters with hyphens.'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.agencies (
    name,
    slug,
    legal_name,
    tax_id,
    email,
    phone,
    city,
    address,
    country_code,
    currency_code,
    currency_minor_unit,
    timezone,
    default_locale,
    vat_rate_bps,
    created_by
  )
  VALUES (
    v_clean_name,
    v_clean_slug,
    NULLIF(pg_catalog.btrim(COALESCE(p_legal_name, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_tax_id, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_email, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_phone, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_city, '')), ''),
    NULLIF(pg_catalog.btrim(COALESCE(p_address, '')), ''),
    pg_catalog.upper(pg_catalog.btrim(COALESCE(p_country_code, 'TN'))),
    pg_catalog.upper(pg_catalog.btrim(COALESCE(p_currency_code, 'TND'))),
    COALESCE(p_currency_minor_unit, 3),
    pg_catalog.btrim(COALESCE(p_timezone, 'Africa/Tunis')),
    pg_catalog.lower(pg_catalog.btrim(COALESCE(p_default_locale, 'fr'))),
    COALESCE(p_vat_rate_bps, 1900),
    v_user_id
  )
  RETURNING * INTO v_agency;

  -- Caller becomes the sole initial active owner; never accepts arbitrary user_id or role
  INSERT INTO public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    invited_by
  )
  VALUES (
    v_agency.id,
    v_user_id,
    'owner'::public.agency_role,
    'active'::public.membership_status,
    v_user_id
  );

  INSERT INTO public.audit_logs (
    agency_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    metadata
  )
  VALUES (
    v_agency.id,
    v_user_id,
    'agency.created',
    'agencies',
    v_agency.id,
    pg_catalog.jsonb_build_object(
      'slug', v_agency.slug,
      'currency_code', v_agency.currency_code,
      'timezone', v_agency.timezone
    )
  );

  RETURN v_agency;
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Server-Authoritative Reservation Lifecycle Transition RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_reservation_status(
  p_reservation_id uuid,
  p_next_status public.reservation_status
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_res public.reservations;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_res
    FROM public.reservations r
   WHERE r.id = p_reservation_id
     FOR UPDATE;

  IF NOT FOUND OR NOT public.is_active_agency_member(v_res.agency_id) THEN
    RAISE EXCEPTION 'Reservation not found or access denied.'
      USING ERRCODE = '42501';
  END IF;

  IF p_next_status IS NULL OR p_next_status = v_res.status THEN
    RAISE EXCEPTION 'Invalid reservation status transition.'
      USING ERRCODE = '22023';
  END IF;

  IF v_res.status IN ('completed'::public.reservation_status, 'cancelled'::public.reservation_status) THEN
    RAISE EXCEPTION 'Completed or cancelled reservations cannot change status.'
      USING ERRCODE = '42501';
  END IF;

  -- Enforce strict role-checked lifecycle state machine:
  --   draft     -> pending, cancelled        (owner, manager, agent)
  --   pending   -> confirmed, cancelled      (owner, manager only)
  --   confirmed -> active                    (owner, manager, agent)
  --   confirmed -> cancelled                 (owner, manager only)
  --   active    -> completed                 (owner, manager, agent)
  IF v_res.status = 'draft'::public.reservation_status
     AND p_next_status IN ('pending'::public.reservation_status, 'cancelled'::public.reservation_status) THEN
    -- Any active agency member permitted
    NULL;
  ELSIF v_res.status = 'pending'::public.reservation_status
     AND p_next_status IN ('confirmed'::public.reservation_status, 'cancelled'::public.reservation_status) THEN
    IF NOT public.has_agency_role(v_res.agency_id, ARRAY['owner', 'manager']::public.agency_role[]) THEN
      RAISE EXCEPTION 'Only agency owners or managers can confirm or cancel pending reservations.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_res.status = 'confirmed'::public.reservation_status
     AND p_next_status = 'active'::public.reservation_status THEN
    -- Vehicle handover permitted for any active member
    NULL;
  ELSIF v_res.status = 'confirmed'::public.reservation_status
     AND p_next_status = 'cancelled'::public.reservation_status THEN
    IF NOT public.has_agency_role(v_res.agency_id, ARRAY['owner', 'manager']::public.agency_role[]) THEN
      RAISE EXCEPTION 'Only agency owners or managers can cancel confirmed reservations.'
        USING ERRCODE = '42501';
    END IF;
  ELSIF v_res.status = 'active'::public.reservation_status
     AND p_next_status = 'completed'::public.reservation_status THEN
    -- Vehicle return completion permitted for any active member
    NULL;
  ELSE
    RAISE EXCEPTION 'Transition from % to % is not permitted.', v_res.status, p_next_status
      USING ERRCODE = '22023';
  END IF;

  -- PostgreSQL GiST exclusion constraint automatically prevents overlapping confirmed/active bookings
  UPDATE public.reservations
     SET status = p_next_status,
         updated_by = v_user_id
   WHERE id = v_res.id
   RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Server-Authoritative Pre-Confirmation Terms Amendment RPC (Owner/Manager)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_pending_reservation_terms(
  p_reservation_id uuid,
  p_vehicle_id uuid DEFAULT NULL,
  p_customer_id uuid DEFAULT NULL,
  p_pickup_at timestamptz DEFAULT NULL,
  p_return_at timestamptz DEFAULT NULL,
  p_daily_rate_minor bigint DEFAULT NULL,
  p_subtotal_minor bigint DEFAULT NULL,
  p_tax_minor bigint DEFAULT NULL,
  p_discount_minor bigint DEFAULT NULL,
  p_deposit_minor bigint DEFAULT NULL,
  p_currency_code text DEFAULT NULL
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_res public.reservations;
  v_subtotal bigint;
  v_tax bigint;
  v_discount bigint;
  v_total bigint;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  SELECT *
    INTO v_res
    FROM public.reservations r
   WHERE r.id = p_reservation_id
     FOR UPDATE;

  IF NOT FOUND OR NOT public.has_agency_role(v_res.agency_id, ARRAY['owner', 'manager']::public.agency_role[]) THEN
    RAISE EXCEPTION 'Reservation not found or owner/manager role required.'
      USING ERRCODE = '42501';
  END IF;

  IF v_res.status NOT IN ('draft'::public.reservation_status, 'pending'::public.reservation_status) THEN
    RAISE EXCEPTION 'Agreed pricing, references, and dates cannot be altered once confirmed or finalized.'
      USING ERRCODE = '42501';
  END IF;

  v_subtotal := COALESCE(p_subtotal_minor, v_res.subtotal_minor);
  v_tax := COALESCE(p_tax_minor, v_res.tax_minor);
  v_discount := COALESCE(p_discount_minor, v_res.discount_minor);
  v_total := v_subtotal + v_tax - v_discount;

  IF v_total < 0 THEN
    RAISE EXCEPTION 'Calculated reservation total cannot be negative.'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.reservations
     SET vehicle_id = COALESCE(p_vehicle_id, v_res.vehicle_id),
         customer_id = COALESCE(p_customer_id, v_res.customer_id),
         pickup_at = COALESCE(p_pickup_at, v_res.pickup_at),
         return_at = COALESCE(p_return_at, v_res.return_at),
         daily_rate_minor = COALESCE(p_daily_rate_minor, v_res.daily_rate_minor),
         subtotal_minor = v_subtotal,
         tax_minor = v_tax,
         discount_minor = v_discount,
         total_minor = v_total,
         deposit_minor = COALESCE(p_deposit_minor, v_res.deposit_minor),
         currency_code = pg_catalog.upper(pg_catalog.btrim(COALESCE(p_currency_code, v_res.currency_code))),
         updated_by = v_user_id
   WHERE id = v_res.id
   RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

-- Restrict EXECUTE permissions on all functions (minimal exposed surface)
REVOKE ALL ON FUNCTION public.audit_sensitive_change() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.is_active_agency_member(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_agency_role(uuid, public.agency_role[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_agency(
  text, text, text, text, text, text, text, text, text, text, smallint, text, text, integer
) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transition_reservation_status(uuid, public.reservation_status) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.update_pending_reservation_terms(
  uuid, uuid, uuid, timestamptz, timestamptz, bigint, bigint, bigint, bigint, bigint, text
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_active_agency_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_agency_role(uuid, public.agency_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency(
  text, text, text, text, text, text, text, text, text, text, smallint, text, text, integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transition_reservation_status(uuid, public.reservation_status) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pending_reservation_terms(
  uuid, uuid, uuid, timestamptz, timestamptz, bigint, bigint, bigint, bigint, bigint, text
) TO authenticated;

-- -----------------------------------------------------------------------------
-- 7. Enable & Force Row Level Security on Every Tenant-Owned Table
-- -----------------------------------------------------------------------------
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agencies FORCE ROW LEVEL SECURITY;

ALTER TABLE public.agency_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations FORCE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 8. RLS Policies — agencies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS agencies_select_active_member ON public.agencies;
CREATE POLICY agencies_select_active_member
  ON public.agencies
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(id));

DROP POLICY IF EXISTS agencies_update_owner_only ON public.agencies;
CREATE POLICY agencies_update_owner_only
  ON public.agencies
  FOR UPDATE
  TO authenticated
  USING (public.has_agency_role(id, ARRAY['owner']::public.agency_role[]))
  WITH CHECK (public.has_agency_role(id, ARRAY['owner']::public.agency_role[]));

-- Note: Direct INSERT and DELETE on public.agencies are intentionally disallowed.
-- Agencies must be created via public.create_agency(...).

-- -----------------------------------------------------------------------------
-- 9. RLS Policies — agency_memberships
-- Prohibits direct INSERT (MVP), prevents self-escalation, enforces Owner > Manager > Agent
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS memberships_select_active_member ON public.agency_memberships;
CREATE POLICY memberships_select_active_member
  ON public.agency_memberships
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

-- Direct INSERT policy intentionally omitted in MVP to prevent arbitrary activation
-- of users without a proper invitation and acceptance workflow.
DROP POLICY IF EXISTS memberships_insert_controlled ON public.agency_memberships;

DROP POLICY IF EXISTS memberships_update_controlled ON public.agency_memberships;
CREATE POLICY memberships_update_controlled
  ON public.agency_memberships
  FOR UPDATE
  TO authenticated
  USING (
    -- Users cannot mutate their own membership role/status
    user_id <> auth.uid()
    AND (
      public.has_agency_role(agency_id, ARRAY['owner']::public.agency_role[])
      OR (
        -- Managers can only manage agent rows
        public.has_agency_role(agency_id, ARRAY['manager']::public.agency_role[])
        AND role = 'agent'::public.agency_role
      )
    )
  )
  WITH CHECK (
    user_id <> auth.uid()
    AND (
      public.has_agency_role(agency_id, ARRAY['owner']::public.agency_role[])
      OR (
        -- Managers cannot promote an agent to manager or owner
        public.has_agency_role(agency_id, ARRAY['manager']::public.agency_role[])
        AND role = 'agent'::public.agency_role
      )
    )
  );

DROP POLICY IF EXISTS memberships_delete_owner_only ON public.agency_memberships;
CREATE POLICY memberships_delete_owner_only
  ON public.agency_memberships
  FOR DELETE
  TO authenticated
  USING (
    user_id <> auth.uid()
    AND public.has_agency_role(agency_id, ARRAY['owner']::public.agency_role[])
  );

-- -----------------------------------------------------------------------------
-- 10. RLS Policies — vehicles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS vehicles_select_active_member ON public.vehicles;
CREATE POLICY vehicles_select_active_member
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS vehicles_insert_owner_manager ON public.vehicles;
CREATE POLICY vehicles_insert_owner_manager
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[])
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS vehicles_update_owner_manager ON public.vehicles;
CREATE POLICY vehicles_update_owner_manager
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]))
  WITH CHECK (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]));

DROP POLICY IF EXISTS vehicles_delete_owner_only ON public.vehicles;
CREATE POLICY vehicles_delete_owner_only
  ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner']::public.agency_role[]));

-- -----------------------------------------------------------------------------
-- 11. RLS Policies — customers
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS customers_select_active_member ON public.customers;
CREATE POLICY customers_select_active_member
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS customers_insert_active_member ON public.customers;
CREATE POLICY customers_insert_active_member
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_agency_member(agency_id)
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS customers_update_active_member ON public.customers;
CREATE POLICY customers_update_active_member
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_active_agency_member(agency_id))
  WITH CHECK (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS customers_delete_owner_manager ON public.customers;
CREATE POLICY customers_delete_owner_manager
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]));

-- -----------------------------------------------------------------------------
-- 12. RLS Policies — reservations
-- Direct INSERT starts in draft/pending; direct UPDATE covers operational notes/locations
-- only (column GRANT) on non-terminal rows; status & terms use server-authoritative RPCs.
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS reservations_select_active_member ON public.reservations;
CREATE POLICY reservations_select_active_member
  ON public.reservations
  FOR SELECT
  TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS reservations_insert_active_member ON public.reservations;
CREATE POLICY reservations_insert_active_member
  ON public.reservations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_active_agency_member(agency_id)
    AND status IN ('draft'::public.reservation_status, 'pending'::public.reservation_status)
    AND created_by = auth.uid()
    AND (updated_by IS NULL OR updated_by = auth.uid())
  );

DROP POLICY IF EXISTS reservations_update_active_member ON public.reservations;
CREATE POLICY reservations_update_active_member
  ON public.reservations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_active_agency_member(agency_id)
    AND status NOT IN ('completed'::public.reservation_status, 'cancelled'::public.reservation_status)
  )
  WITH CHECK (
    public.is_active_agency_member(agency_id)
    AND status NOT IN ('completed'::public.reservation_status, 'cancelled'::public.reservation_status)
    AND (updated_by IS NULL OR updated_by = auth.uid())
  );

DROP POLICY IF EXISTS reservations_delete_owner_manager_draft_only ON public.reservations;
CREATE POLICY reservations_delete_owner_manager_draft_only
  ON public.reservations
  FOR DELETE
  TO authenticated
  USING (
    public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[])
    AND status = 'draft'::public.reservation_status
  );

-- -----------------------------------------------------------------------------
-- 13. RLS Policies — audit_logs (read-only for Owner/Manager; server-written only)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS audit_logs_select_owner_manager ON public.audit_logs;
CREATE POLICY audit_logs_select_owner_manager
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner', 'manager']::public.agency_role[]));

-- Client-side INSERT, UPDATE, and DELETE policies and grants are intentionally absent.
DROP POLICY IF EXISTS audit_logs_insert_active_member ON public.audit_logs;
