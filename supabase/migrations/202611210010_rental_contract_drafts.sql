-- =============================================================================
-- KIRALIS PHASE 10A — RENTAL CONTRACT DRAFT REGISTRY (NOT INSTALLED)
-- supabase/migrations/202611210010_rental_contract_drafts.sql
--
-- SAFETY: Do not run on production without reviewing this migration and
-- completing RLS + concurrency runtime checks. Migrations 0001-0008 and
-- their active database state are prerequisites. Migration 0009 is independent.
--
-- This step creates only an auditable internal DRAFT record. No legally
-- enforceable contract is issued, signed, closed, sent or paid here.
-- =============================================================================

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace
    WHERE n.nspname='public' AND t.typname='rental_contract_status'
  ) THEN
    CREATE TYPE public.rental_contract_status AS ENUM
      ('draft','issued','signed','closed','void');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.rental_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL,
  contract_number text NOT NULL DEFAULT
    ('KRL-C-' || pg_catalog.upper(pg_catalog.substr(
      pg_catalog.replace(gen_random_uuid()::text, '-', ''), 1, 12
    ))),
  status public.rental_contract_status NOT NULL DEFAULT 'draft',
  template_version text NOT NULL DEFAULT 'draft-v1',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT rental_contracts_agency_id_unique UNIQUE (agency_id, id),
  CONSTRAINT rental_contracts_agency_reservation_unique UNIQUE (agency_id, reservation_id),
  CONSTRAINT rental_contracts_agency_number_unique UNIQUE (agency_id, contract_number),
  CONSTRAINT rental_contracts_reservation_same_agency_fk
    FOREIGN KEY (agency_id,reservation_id)
    REFERENCES public.reservations (agency_id,id) ON DELETE RESTRICT,
  CONSTRAINT rental_contracts_number_length
    CHECK (pg_catalog.char_length(pg_catalog.btrim(contract_number)) BETWEEN 8 AND 48),
  CONSTRAINT rental_contracts_version_check
    CHECK (template_version = 'draft-v1')
);

CREATE INDEX IF NOT EXISTS idx_rental_contracts_agency_created_at
  ON public.rental_contracts (agency_id,created_at DESC);

-- Only drafts are supported in this migration. Later migration will add
-- issue/sign/return transitions, immutable snapshot and legal requirements.
CREATE OR REPLACE FUNCTION public.guard_rental_contract_draft()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation_status public.reservation_status;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft'::public.rental_contract_status OR
       NEW.template_version <> 'draft-v1' THEN
      RAISE EXCEPTION 'Only versioned draft contract records may be created.'
        USING ERRCODE='42501';
    END IF;
    SELECT r.status INTO v_reservation_status
      FROM public.reservations r
     WHERE r.agency_id = NEW.agency_id AND r.id = NEW.reservation_id;
    IF NOT FOUND OR v_reservation_status NOT IN
       ('confirmed'::public.reservation_status,
        'active'::public.reservation_status,
        'completed'::public.reservation_status) THEN
      RAISE EXCEPTION 'Only confirmed, active, or completed reservations support draft contracts.'
        USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- No ordinary client has UPDATE permission. Defense in depth prevents
    -- accidental bypass by future migrations or privileged direct writes.
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id OR
       NEW.reservation_id IS DISTINCT FROM OLD.reservation_id OR
       NEW.contract_number IS DISTINCT FROM OLD.contract_number OR
       NEW.template_version IS DISTINCT FROM OLD.template_version OR
       NEW.created_by IS DISTINCT FROM OLD.created_by OR
       NEW.created_at IS DISTINCT FROM OLD.created_at OR
       NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'Draft contract identity and status are immutable in phase 10A.'
        USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_rental_contract_draft()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_rental_contract_draft ON public.rental_contracts;
CREATE TRIGGER trg_guard_rental_contract_draft
  BEFORE INSERT OR UPDATE ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.guard_rental_contract_draft();

DROP TRIGGER IF EXISTS trg_set_updated_at_rental_contracts ON public.rental_contracts;
CREATE TRIGGER trg_set_updated_at_rental_contracts
  BEFORE UPDATE ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.audit_rental_contract_draft_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    agency_id, actor_user_id, action, entity_type, entity_id, metadata
  ) VALUES (
    NEW.agency_id, NEW.created_by, 'contract.draft_created',
    'rental_contract', NEW.id,
    pg_catalog.jsonb_build_object(
      'reservation_id',NEW.reservation_id,
      'contract_number',NEW.contract_number,
      'status','draft'
    )
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_rental_contract_draft_creation()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_rental_contract_draft_creation ON public.rental_contracts;
CREATE TRIGGER trg_audit_rental_contract_draft_creation
  AFTER INSERT ON public.rental_contracts
  FOR EACH ROW EXECUTE FUNCTION public.audit_rental_contract_draft_creation();

ALTER TABLE public.rental_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_contracts FORCE ROW LEVEL SECURITY;

-- Explicit minimal privilege surface for the authenticated API client.
-- Direct UPDATE and DELETE are forbidden to every client role.
REVOKE ALL ON TABLE public.rental_contracts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.rental_contracts TO authenticated;
GRANT INSERT (agency_id,reservation_id,created_by)
  ON TABLE public.rental_contracts TO authenticated;

DROP POLICY IF EXISTS rental_contracts_select_members ON public.rental_contracts;
CREATE POLICY rental_contracts_select_members
  ON public.rental_contracts FOR SELECT TO authenticated
  USING (public.is_active_agency_member(agency_id));

DROP POLICY IF EXISTS rental_contracts_insert_manager_owner ON public.rental_contracts;
CREATE POLICY rental_contracts_insert_manager_owner
  ON public.rental_contracts FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND status='draft'::public.rental_contract_status
    AND template_version='draft-v1'
    AND public.has_agency_role(
      agency_id, ARRAY['owner','manager']::public.agency_role[]
    )
  );

COMMIT;

-- Installation verification is in:
-- supabase/tests/verify_0010_rental_contract_drafts_readonly.sql
