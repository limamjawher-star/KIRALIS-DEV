-- KIRALIS security & booking reliability recovery, 2026-11-28.
-- REVIEW REQUIRED. Independent of still-uninstalled contract migrations 0010/0011.
-- Only use against the verified Kiralis Supabase project; test then apply atomically.
-- NO business data is modified, deleted or backfilled.
BEGIN;

DO $preflight$
BEGIN
  IF to_regclass('public.reservations') IS NULL
     OR to_regclass('public.vehicle_seasonal_rates') IS NULL
     OR to_regprocedure('public.is_active_agency_member(uuid)') IS NULL
     OR to_regprocedure('public.has_agency_role(uuid,public.agency_role[])') IS NULL
  THEN
    RAISE EXCEPTION 'Core KIRALIS schema prerequisites absent; aborting recovery';
  END IF;
END
$preflight$;

-- RLS does not protect against TRUNCATE. These rights are not needed by the app.
-- Remove accidental broad data-destructive/DDL privileges from API roles.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.agencies, public.agency_memberships, public.vehicles,
  public.customers, public.reservations, public.audit_logs,
  public.customer_drivers, public.vehicle_seasonal_rates
  FROM PUBLIC, anon, authenticated;

-- Audit history is append-only: no browser grants to change or truncate records.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs
  FROM PUBLIC, anon, authenticated;
REVOKE UPDATE, DELETE, INSERT ON TABLE public.reservations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.reservations TO authenticated;

-- Secure creation happens *only* inside a database-side price-recomputing RPC.
-- No direct SQL INSERT permission or permissive INSERT policy is installed.
DROP POLICY IF EXISTS reservations_insert_active_member ON public.reservations;
DROP POLICY IF EXISTS reservations_update_active_member ON public.reservations;
DROP POLICY IF EXISTS reservations_delete_owner_manager_draft_only ON public.reservations;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations FORCE ROW LEVEL SECURITY;

-- Do not allow clients to invoke security-definer trigger helpers.
REVOKE ALL ON FUNCTION public.guard_agency_membership_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

CREATE SCHEMA IF NOT EXISTS kiralis_private;
REVOKE ALL ON SCHEMA kiralis_private FROM PUBLIC, anon, authenticated;

-- Implements the same minimum-cost 1/7/30-day standard package optimization
-- as lib/vehicles/pricing.ts, without exposing price setters or trusting clients.
CREATE OR REPLACE FUNCTION kiralis_private.standard_segment_price(
  p_days integer, p_daily bigint, p_weekly bigint, p_monthly bigint
)
RETURNS bigint LANGUAGE plpgsql SET search_path = '' AS $fn$
DECLARE
  costs bigint[] := ARRAY[0::bigint];
  i integer;
  best bigint;
BEGIN
  IF p_days < 0 OR p_days > 3650 OR p_daily IS NULL OR p_daily < 0 OR
      (p_weekly IS NOT NULL AND p_weekly < 0) OR
      (p_monthly IS NOT NULL AND p_monthly < 0) THEN
    RAISE EXCEPTION 'Invalid pricing segment' USING ERRCODE='22023';
  END IF;
  FOR i IN 1..p_days LOOP
    best := costs[i] + p_daily;
    IF p_weekly IS NOT NULL AND i >= 7 THEN
      best := least(best, costs[i-6] + p_weekly);
    END IF;
    IF p_monthly IS NOT NULL AND i >= 30 THEN
      best := least(best, costs[i-29] + p_monthly);
    END IF;
    costs := array_append(costs, best);
  END LOOP;
  RETURN costs[p_days+1];
END
$fn$;
REVOKE ALL ON FUNCTION kiralis_private.standard_segment_price(integer,bigint,bigint,bigint)
  FROM PUBLIC,anon,authenticated;

-- Creation is performed under the invoking member's auth.uid, but authoritative
-- access, currency, fleet/driver association, pricing and availability are
-- revalidated by this SECURITY DEFINER function. No direct INSERT is allowed.
CREATE OR REPLACE FUNCTION public.create_agency_reservation_secure(
  p_vehicle_id uuid,
  p_customer_id uuid,
  p_pickup_at timestamptz,
  p_return_at timestamptz,
  p_pickup_location text,
  p_return_location text,
  p_notes text,
  p_expected_subtotal_minor bigint,
  p_expected_deposit_minor bigint
)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_vehicle public.vehicles;
  v_agency public.agencies;
  v_pickup_date date;
  v_return_date date;
  v_day date;
  v_seasonal_rate bigint;
  v_standard_days integer := 0;
  v_amount bigint := 0;
  v_result public.reservations;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  IF p_vehicle_id IS NULL OR p_customer_id IS NULL OR p_pickup_at IS NULL
    OR p_return_at IS NULL OR p_return_at <= p_pickup_at
    OR p_expected_subtotal_minor IS NULL OR p_expected_subtotal_minor < 0
    OR p_expected_deposit_minor IS NULL OR p_expected_deposit_minor < 0
    OR coalesce(char_length(p_pickup_location),0) > 160
    OR coalesce(char_length(p_return_location),0) > 160
    OR coalesce(char_length(p_notes),0) > 1200 THEN
    RAISE EXCEPTION 'Invalid reservation draft' USING ERRCODE='22023';
  END IF;

  -- FOR UPDATE serializes concurrent booking creation against fleet changes
  -- and FK checks on newly inserted seasonal-rate rows.
  SELECT * INTO v_vehicle FROM public.vehicles
    WHERE id=p_vehicle_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_active_agency_member(v_vehicle.agency_id) THEN
    RAISE EXCEPTION 'Vehicle not available to active agency' USING ERRCODE='42501';
  END IF;
  IF v_vehicle.status IN ('maintenance','retired') THEN
    RAISE EXCEPTION 'Vehicle cannot be booked in this status' USING ERRCODE='23514';
  END IF;
  SELECT * INTO v_agency FROM public.agencies
    WHERE id=v_vehicle.agency_id;
  IF NOT FOUND OR v_agency.currency_code <> 'TND' OR
    v_vehicle.currency_code <> 'TND' THEN
    RAISE EXCEPTION 'This booking flow currently supports TND only'
      USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM public.customers c
    WHERE c.id=p_customer_id AND c.agency_id=v_agency.id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Customer not available to active agency' USING ERRCODE='42501';
  END IF;

  v_pickup_date := (p_pickup_at AT TIME ZONE v_agency.timezone)::date;
  v_return_date := (p_return_at AT TIME ZONE v_agency.timezone)::date;
  IF (v_return_date - v_pickup_date) NOT BETWEEN 1 AND 3650 THEN
    RAISE EXCEPTION 'Reservation must cover 1 to 3650 agency-local days'
      USING ERRCODE='22023';
  END IF;
  IF v_vehicle.daily_rate_minor < 0 OR v_vehicle.daily_rate_minor > 999999999000 OR
     (v_vehicle.weekly_rate_minor IS NOT NULL AND
       (v_vehicle.weekly_rate_minor < 0 OR v_vehicle.weekly_rate_minor > 999999999000)) OR
     (v_vehicle.monthly_rate_minor IS NOT NULL AND
       (v_vehicle.monthly_rate_minor < 0 OR v_vehicle.monthly_rate_minor > 999999999000)) THEN
    RAISE EXCEPTION 'Invalid vehicle pricing' USING ERRCODE='22023';
  END IF;

  IF EXISTS(
    SELECT 1 FROM public.reservations r
    WHERE r.agency_id=v_agency.id AND r.vehicle_id=p_vehicle_id
      AND r.status IN ('confirmed','active')
      AND r.pickup_at<p_return_at AND r.return_at>p_pickup_at
  ) THEN
    RAISE EXCEPTION 'Vehicle has an overlapping confirmed reservation'
      USING ERRCODE='23P01';
  END IF;

  -- At most 3650 bounded day iterations. Active season overrides package
  -- prices one day at a time; standard blocks never cross seasonal intervals.
  v_day := v_pickup_date;
  WHILE v_day < v_return_date LOOP
    v_seasonal_rate := NULL;
    SELECT s.daily_rate_minor INTO v_seasonal_rate
      FROM public.vehicle_seasonal_rates s
      WHERE s.agency_id=v_agency.id AND s.vehicle_id=p_vehicle_id
        AND s.is_active AND s.start_date<=v_day AND s.end_date>=v_day
      ORDER BY s.start_date LIMIT 1 FOR SHARE;
    IF v_seasonal_rate IS NOT NULL THEN
      IF v_seasonal_rate < 0 OR v_seasonal_rate > 999999999000 THEN
        RAISE EXCEPTION 'Invalid seasonal pricing' USING ERRCODE='22023';
      END IF;
      IF v_standard_days > 0 THEN
        v_amount := v_amount + kiralis_private.standard_segment_price(
          v_standard_days, v_vehicle.daily_rate_minor,
          v_vehicle.weekly_rate_minor, v_vehicle.monthly_rate_minor
        );
        v_standard_days := 0;
      END IF;
      v_amount := v_amount + v_seasonal_rate;
    ELSE
      v_standard_days := v_standard_days + 1;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  IF v_standard_days > 0 THEN
    v_amount := v_amount + kiralis_private.standard_segment_price(
      v_standard_days, v_vehicle.daily_rate_minor,
      v_vehicle.weekly_rate_minor, v_vehicle.monthly_rate_minor
    );
  END IF;
  IF v_amount > 999999999000 OR
    v_amount <> p_expected_subtotal_minor OR
    v_vehicle.deposit_minor <> p_expected_deposit_minor THEN
    RAISE EXCEPTION 'Rates changed; refresh the quote'
      USING ERRCODE='23514';
  END IF;

  INSERT INTO public.reservations (
    agency_id, reference_code, vehicle_id, customer_id,
    status, pickup_at, return_at, pickup_location, return_location,
    currency_code, daily_rate_minor, subtotal_minor,
    tax_minor, discount_minor, total_minor, deposit_minor,
    notes, created_by, updated_by
  ) VALUES (
    v_agency.id,
    'KRL-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
    p_vehicle_id, p_customer_id,
    'pending'::public.reservation_status,
    p_pickup_at,p_return_at,
    nullif(btrim(p_pickup_location),''),
    nullif(btrim(p_return_location),''),
    'TND',v_vehicle.daily_rate_minor,v_amount,0,0,v_amount,
    v_vehicle.deposit_minor,nullif(btrim(p_notes),''),
    v_actor,v_actor
  ) RETURNING * INTO v_result;
  RETURN v_result;
END
$fn$;
REVOKE ALL ON FUNCTION public.create_agency_reservation_secure(
  uuid,uuid,timestamptz,timestamptz,text,text,text,bigint,bigint
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency_reservation_secure(
  uuid,uuid,timestamptz,timestamptz,text,text,text,bigint,bigint
) TO authenticated;

-- The role-checked state machine originally defined in migration 0002 was not
-- actually installed on the connected project. The GiST exclusion constraint
-- remains the final protection against overlapping confirmed/active bookings.
CREATE OR REPLACE FUNCTION public.transition_reservation_status(
  p_reservation_id uuid,
  p_next_status public.reservation_status
)
RETURNS public.reservations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
  v_actor uuid := auth.uid();
  v_booking public.reservations;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_booking FROM public.reservations
    WHERE id=p_reservation_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_active_agency_member(v_booking.agency_id) THEN
    RAISE EXCEPTION 'Reservation not found or access denied' USING ERRCODE='42501';
  END IF;
  IF p_next_status IS NULL OR p_next_status=v_booking.status OR
     v_booking.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid booking status change' USING ERRCODE='22023';
  END IF;
  IF v_booking.status='draft' AND p_next_status IN ('pending','cancelled') THEN
    NULL;
  ELSIF v_booking.status='pending' AND p_next_status IN ('confirmed','cancelled') THEN
    IF NOT public.has_agency_role(v_booking.agency_id,
      ARRAY['owner','manager']::public.agency_role[]) THEN
      RAISE EXCEPTION 'Owner or Manager required for confirmation/cancellation'
        USING ERRCODE='42501';
    END IF;
  ELSIF v_booking.status='confirmed' AND p_next_status='active' THEN
    NULL;
  ELSIF v_booking.status='confirmed' AND p_next_status='cancelled' THEN
    IF NOT public.has_agency_role(v_booking.agency_id,
      ARRAY['owner','manager']::public.agency_role[]) THEN
      RAISE EXCEPTION 'Owner or Manager required for confirmed booking cancellation'
        USING ERRCODE='42501';
    END IF;
  ELSIF v_booking.status='active' AND p_next_status='completed' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'Forbidden reservation transition' USING ERRCODE='22023';
  END IF;

  UPDATE public.reservations
    SET status=p_next_status,updated_by=v_actor
    WHERE id=v_booking.id RETURNING * INTO v_booking;
  RETURN v_booking;
END
$fn$;
REVOKE ALL ON FUNCTION public.transition_reservation_status(
  uuid,public.reservation_status
) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_reservation_status(
  uuid,public.reservation_status
) TO authenticated;

-- Immutable creation identity, financial snapshot and booking window.
-- Lifecycle updates via the audited RPC are the only supported edits.
CREATE OR REPLACE FUNCTION public.guard_booking_snapshot()
RETURNS trigger LANGUAGE plpgsql SET search_path = ''
AS $fn$
BEGIN
  IF OLD.status IN ('completed','cancelled') OR
     NEW.agency_id IS DISTINCT FROM OLD.agency_id OR
     NEW.reference_code IS DISTINCT FROM OLD.reference_code OR
     NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id OR
     NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
     NEW.pickup_at IS DISTINCT FROM OLD.pickup_at OR
     NEW.return_at IS DISTINCT FROM OLD.return_at OR
     NEW.currency_code IS DISTINCT FROM OLD.currency_code OR
     NEW.daily_rate_minor IS DISTINCT FROM OLD.daily_rate_minor OR
     NEW.subtotal_minor IS DISTINCT FROM OLD.subtotal_minor OR
     NEW.tax_minor IS DISTINCT FROM OLD.tax_minor OR
     NEW.discount_minor IS DISTINCT FROM OLD.discount_minor OR
     NEW.total_minor IS DISTINCT FROM OLD.total_minor OR
     NEW.deposit_minor IS DISTINCT FROM OLD.deposit_minor OR
     NEW.created_by IS DISTINCT FROM OLD.created_by OR
     NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Reservation financial snapshot and identity are immutable'
      USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.guard_booking_snapshot()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_reservations_guard_snapshot ON public.reservations;
CREATE TRIGGER trg_reservations_guard_snapshot BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.guard_booking_snapshot();

-- Transactional server-owned audit; no sensitive notes/customer details.
CREATE OR REPLACE FUNCTION public.audit_booking_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_action text;
DECLARE v_metadata jsonb;
BEGIN
  IF TG_OP='INSERT' THEN
    v_action := 'reservation.created';
    v_metadata := pg_catalog.jsonb_build_object(
      'reference_code',NEW.reference_code,'status',NEW.status);
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    v_action := 'reservation.status_changed';
    v_metadata := pg_catalog.jsonb_build_object(
      'reference_code',NEW.reference_code,'from_status',OLD.status,
      'to_status',NEW.status);
  ELSE
    RETURN NEW;
  END IF;
  INSERT INTO public.audit_logs(
    agency_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    NEW.agency_id, auth.uid(),v_action,
    'reservations',NEW.id,v_metadata
  );
  RETURN NEW;
END
$fn$;
REVOKE ALL ON FUNCTION public.audit_booking_lifecycle()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS trg_reservations_audit_booking ON public.reservations;
CREATE TRIGGER trg_reservations_audit_booking
  AFTER INSERT OR UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.audit_booking_lifecycle();

COMMIT;
