-- KIRALIS PHASE 10B — IMMUTABLE VEHICLE PICKUP/RETURN INSPECTIONS
-- DRAFT MIGRATION 0011 — DO NOT EXECUTE IN PRODUCTION UNTIL REVIEW
-- Depends on review/installation of 0010 and the 0001-0008 core tables.
-- Staff attestations are NOT customer e-signatures or legal contract signatures.
-- Photos require a separately reviewed private Storage design; none here.
BEGIN;

CREATE TABLE IF NOT EXISTS public.vehicle_handover_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL,
  inspection_kind text NOT NULL CHECK (inspection_kind IN ('pickup','return')),
  odometer_km integer NOT NULL CHECK (odometer_km BETWEEN 0 AND 3000000),
  fuel_percent smallint NOT NULL CHECK (fuel_percent BETWEEN 0 AND 100),
  exterior_condition text NOT NULL CHECK (exterior_condition IN ('good','minor_wear','damage')),
  interior_condition text NOT NULL CHECK (interior_condition IN ('good','minor_wear','damage')),
  damage_notes text NOT NULL DEFAULT '' CHECK (char_length(damage_notes) <= 1200),
  notes text NOT NULL DEFAULT '' CHECK (char_length(notes) <= 1000),
  keys_count smallint NOT NULL CHECK (keys_count BETWEEN 0 AND 10),
  documents_present boolean NOT NULL,
  staff_attested boolean NOT NULL CHECK (staff_attested = true),
  recorded_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT handover_agency_id_unique UNIQUE (agency_id,id),
  CONSTRAINT handover_one_per_kind UNIQUE (agency_id,reservation_id,inspection_kind),
  CONSTRAINT handover_reservation_tenant_fk FOREIGN KEY (agency_id,reservation_id)
    REFERENCES public.reservations(agency_id,id) ON DELETE RESTRICT,
  CONSTRAINT handover_damage_description_required CHECK (
    (exterior_condition <> 'damage' AND interior_condition <> 'damage')
    OR char_length(btrim(damage_notes)) BETWEEN 3 AND 1200
  )
);
CREATE INDEX IF NOT EXISTS idx_handover_agency_created
  ON public.vehicle_handover_inspections(agency_id,created_at DESC);

-- SECURITY DEFINER is used strictly for transactional validation/auditing.
-- No function is callable via the PostgREST RPC interface.
-- Authenticated clients can only INSERT narrow columns, not update or delete.
CREATE OR REPLACE FUNCTION public.validate_handover_inspection_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_status public.reservation_status;
  v_vehicle_id uuid;
  v_vehicle_odometer integer;
  v_pickup_odometer integer;
BEGIN
  IF NEW.recorded_by IS DISTINCT FROM auth.uid()
     OR NOT public.is_active_agency_member(NEW.agency_id) THEN
    RAISE EXCEPTION 'Verified active staff membership required.'
      USING ERRCODE='42501';
  END IF;

  SELECT r.status,r.vehicle_id INTO v_status,v_vehicle_id
    FROM public.reservations r
    WHERE r.id=NEW.reservation_id AND r.agency_id=NEW.agency_id
    FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation is not in the active agency.'
      USING ERRCODE='23503';
  END IF;

  IF NEW.inspection_kind='pickup' THEN
    IF v_status NOT IN ('confirmed'::public.reservation_status,
                       'active'::public.reservation_status) THEN
      RAISE EXCEPTION 'Pickup inspection requires confirmed or active reservation.'
        USING ERRCODE='23514';
    END IF;
    SELECT v.odometer_km INTO v_vehicle_odometer
      FROM public.vehicles v WHERE v.id=v_vehicle_id AND v.agency_id=NEW.agency_id
      FOR SHARE;
    IF NEW.odometer_km < COALESCE(v_vehicle_odometer,0) THEN
      RAISE EXCEPTION 'Pickup mileage cannot be below the registered vehicle odometer.'
        USING ERRCODE='23514';
    END IF;
  ELSE
    IF v_status NOT IN ('active'::public.reservation_status,
                       'completed'::public.reservation_status) THEN
      RAISE EXCEPTION 'Return inspection requires active or completed reservation.'
        USING ERRCODE='23514';
    END IF;
    SELECT i.odometer_km INTO v_pickup_odometer
      FROM public.vehicle_handover_inspections i
      WHERE i.agency_id=NEW.agency_id
        AND i.reservation_id=NEW.reservation_id AND i.inspection_kind='pickup'
      FOR SHARE;
    IF NOT FOUND OR NEW.odometer_km < v_pickup_odometer THEN
      RAISE EXCEPTION 'Return requires a prior pickup and non-decreasing mileage.'
        USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.validate_handover_inspection_insert()
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.audit_handover_inspection_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.audit_logs (
    agency_id,actor_user_id,action,entity_type,entity_id,metadata
  ) VALUES (
    NEW.agency_id,NEW.recorded_by,'handover.inspection_recorded',
    'vehicle_handover_inspection',NEW.id,
    pg_catalog.jsonb_build_object(
      'reservation_id',NEW.reservation_id,
      'kind',NEW.inspection_kind,
      'recorded_by',NEW.recorded_by
    )
  );
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.audit_handover_inspection_insert()
  FROM PUBLIC,anon,authenticated;

DROP TRIGGER IF EXISTS trg_validate_handover_inspection_insert
  ON public.vehicle_handover_inspections;
CREATE TRIGGER trg_validate_handover_inspection_insert
  BEFORE INSERT ON public.vehicle_handover_inspections
  FOR EACH ROW EXECUTE FUNCTION public.validate_handover_inspection_insert();

DROP TRIGGER IF EXISTS trg_audit_handover_inspection_insert
  ON public.vehicle_handover_inspections;
CREATE TRIGGER trg_audit_handover_inspection_insert
  AFTER INSERT ON public.vehicle_handover_inspections
  FOR EACH ROW EXECUTE FUNCTION public.audit_handover_inspection_insert();

ALTER TABLE public.vehicle_handover_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_handover_inspections FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.vehicle_handover_inspections
  FROM PUBLIC,anon,authenticated;
GRANT SELECT ON TABLE public.vehicle_handover_inspections TO authenticated;
GRANT INSERT (
  agency_id,reservation_id,inspection_kind,odometer_km,fuel_percent,
  exterior_condition,interior_condition,damage_notes,notes,keys_count,
  documents_present,staff_attested,recorded_by
) ON TABLE public.vehicle_handover_inspections TO authenticated;

DROP POLICY IF EXISTS handover_select_active_staff ON public.vehicle_handover_inspections;
CREATE POLICY handover_select_active_staff
  ON public.vehicle_handover_inspections FOR SELECT TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS handover_insert_active_staff ON public.vehicle_handover_inspections;
CREATE POLICY handover_insert_active_staff
  ON public.vehicle_handover_inspections FOR INSERT TO authenticated
  WITH CHECK (
    recorded_by=(SELECT auth.uid()) AND staff_attested=true
    AND public.is_active_agency_member(agency_id)
  );

-- No UPDATE/DELETE grants, policies, functions, or editor endpoints: records
-- are append-only. Corrections require a separately audited future process.
COMMIT;
