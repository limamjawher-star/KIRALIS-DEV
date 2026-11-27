-- =============================================================================
-- KIRALIS — Phase 6C.2 Migration 0009: Team Invitations & Secure Team RPCs
-- Target: Supabase PostgreSQL (additive, non-destructive, idempotent)
--
-- INSTALLATION REQUIREMENTS:
--   - Execute manually in Supabase SQL Editor or via Supabase CLI as the
--     standard migration owner role (`postgres`, which has BYPASSRLS so
--     SECURITY DEFINER functions remain compatible with FORCE ROW LEVEL SECURITY).
--   - Requires migrations 0001–0008 already installed.
--   - After installation, run `supabase/tests/verify_0009_team_invitations_readonly.sql`
--     to inspect schema, privileges, triggers, RLS, and function configuration.
--
-- Contents:
--   1. public.agency_invitation_status enum & public.agency_invitations table
--   2. Integrity and transactional audit triggers (invitations + membership INSERT)
--   3. Least-privilege SQL grants & forced Owner-only RLS on agency_invitations
--   4. Hardened SECURITY DEFINER RPCs:
--        - public.list_agency_members(uuid)
--        - public.create_agency_invitation(uuid, text, public.agency_role, text, integer)
--        - public.revoke_agency_invitation(uuid, uuid)
--        - public.accept_agency_invitation(text)
--
-- Security Invariants:
--   1. Stores ONLY fixed-length SHA-256 hex token hashes (never plaintext tokens).
--   2. Strictly forbids inviting or granting role = 'owner' (only 'manager' or 'agent').
--   3. Enforces normalized lowercase trimmed invited_email and bounded expiration
--      (expires_at > created_at and <= created_at + 30 days).
--   4. Enforces single-use status transitions (pending -> accepted | revoked |
--      expired; terminal states are immutable) and prevents mutating agency_id,
--      invited_email, invited_role, invited_by, token_hash, expires_at, or
--      created_at after creation (safely permitting nested auth.users ON DELETE
--      SET NULL FK cascades on invited_by / accepted_by).
--   5. Enables and forces RLS; allows ONLY active agency Owners to SELECT
--      non-secret invitation columns (token_hash is excluded from GRANT SELECT).
--   6. Grants NO direct client INSERT, UPDATE, or DELETE privileges or policies
--      on public.agency_invitations — all writes occur exclusively through
--      narrowly validated SECURITY DEFINER RPCs.
--   7. Invitation acceptance requires an authenticated user with a verified
--      email (auth.users.email_confirmed_at IS NOT NULL) matching invited_email,
--      locks the invitation row FOR UPDATE to prevent replay/revocation races,
--      atomically marks the invitation accepted and inserts an active membership,
--      prevents duplicate memberships, and never silently reactivates suspended
--      or previously invited memberships.
--   8. Preserves migrations 0001–0008 untouched: direct client INSERT on
--      public.agency_memberships remains revoked, last-active-owner protection
--      is unchanged, and existing customer/driver/vehicle triggers are untouched.
--   9. Writes privacy-minimized transactional audit events (invitation.created,
--      invitation.revoked, invitation.accepted, invitation.expired, and
--      membership.created) to public.audit_logs without ever logging plaintext
--      tokens, token_hash, invitation URLs, or personal email addresses.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Invitation Status Enum (idempotent)
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_type t
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'agency_invitation_status'
  ) THEN
    CREATE TYPE public.agency_invitation_status AS ENUM (
      'pending',
      'accepted',
      'revoked',
      'expired'
    );
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- 2. Agency Invitations Table (hashed tokens only, non-owner roles only)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agency_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agency_id uuid NOT NULL REFERENCES public.agencies (id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  invited_role public.agency_role NOT NULL,
  token_hash text NOT NULL,
  status public.agency_invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Composite unique key consistent with KIRALIS tenant-scoped tables
  CONSTRAINT agency_invitations_tenant_id_unique
    UNIQUE (agency_id, id),

  -- One-to-one mapping between a hashed token and an invitation
  CONSTRAINT agency_invitations_token_hash_unique
    UNIQUE (token_hash),

  -- Fixed-length lowercase hexadecimal SHA-256 digest (64 hex characters; never plaintext)
  CONSTRAINT agency_invitations_token_hash_format
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),

  -- Normalized lowercase trimmed email format
  CONSTRAINT agency_invitations_email_normalized
    CHECK (
      invited_email = lower(btrim(invited_email))
      AND char_length(invited_email) BETWEEN 5 AND 254
      AND invited_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$'
    ),

  -- Owner role can NEVER be assigned through an invitation
  CONSTRAINT agency_invitations_role_non_owner
    CHECK (
      invited_role IN (
        'manager'::public.agency_role,
        'agent'::public.agency_role
      )
    ),

  -- Safe bounded expiration window (strictly after creation, capped at 30 days)
  CONSTRAINT agency_invitations_expires_window
    CHECK (
      expires_at > created_at
      AND expires_at <= created_at + interval '30 days'
    ),

  -- Lifecycle timestamp & attribution consistency across statuses
  -- Note: accepted_by / invited_by remain nullable for auth.users ON DELETE SET NULL;
  -- non-null attribution on INSERT and acceptance is enforced in the integrity trigger.
  CONSTRAINT agency_invitations_pending_state
    CHECK (
      status <> 'pending'::public.agency_invitation_status
      OR (accepted_by IS NULL AND accepted_at IS NULL AND revoked_at IS NULL)
    ),
  CONSTRAINT agency_invitations_accepted_state
    CHECK (
      status <> 'accepted'::public.agency_invitation_status
      OR (accepted_at IS NOT NULL AND revoked_at IS NULL)
    ),
  CONSTRAINT agency_invitations_revoked_state
    CHECK (
      status <> 'revoked'::public.agency_invitation_status
      OR (revoked_at IS NOT NULL AND accepted_by IS NULL AND accepted_at IS NULL)
    ),
  CONSTRAINT agency_invitations_expired_state
    CHECK (
      status <> 'expired'::public.agency_invitation_status
      OR (accepted_by IS NULL AND accepted_at IS NULL AND revoked_at IS NULL)
    )
);

-- At most one active pending invitation per normalized email inside the same agency
CREATE UNIQUE INDEX IF NOT EXISTS idx_agency_invitations_one_pending_per_email
  ON public.agency_invitations (agency_id, invited_email)
  WHERE status = 'pending'::public.agency_invitation_status;

-- Tenant-scoped listing by status and creation time
CREATE INDEX IF NOT EXISTS idx_agency_invitations_agency_status_created
  ON public.agency_invitations (agency_id, status, created_at DESC);

-- Fast expiration lookup for pending invitations
CREATE INDEX IF NOT EXISTS idx_agency_invitations_pending_expires_at
  ON public.agency_invitations (expires_at)
  WHERE status = 'pending'::public.agency_invitation_status;

-- -----------------------------------------------------------------------------
-- 3. Integrity & Transactional Audit Trigger Functions (locked search_path = '')
-- -----------------------------------------------------------------------------

-- Enforces creation invariants, immutable columns, single-use status transitions,
-- and safe auth.users ON DELETE SET NULL FK cascades on invited_by / accepted_by.
CREATE OR REPLACE FUNCTION public.guard_agency_invitation_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_is_pure_fk_nullification boolean;
BEGIN
  IF TG_TABLE_NAME <> 'agency_invitations' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'pending'::public.agency_invitation_status THEN
      RAISE EXCEPTION 'New agency invitations must start with status pending.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.invited_by IS NULL THEN
      RAISE EXCEPTION 'Agency invitations must attribute the inviting agency owner.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'Agency invitation expiration must be in the future.'
        USING ERRCODE = '23514';
    END IF;

    IF NEW.accepted_by IS NOT NULL
       OR NEW.accepted_at IS NOT NULL
       OR NEW.revoked_at IS NOT NULL THEN
      RAISE EXCEPTION 'New agency invitations cannot carry acceptance or revocation metadata.'
        USING ERRCODE = '23514';
    END IF;

    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Unconditionally lock identity, tenant ownership, target email/role, token hash,
    -- expiration timestamp, and creation timestamp after creation.
    IF NEW.id IS DISTINCT FROM OLD.id THEN
      RAISE EXCEPTION 'Changing id on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.agency_id IS DISTINCT FROM OLD.agency_id THEN
      RAISE EXCEPTION 'Changing agency_id on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.invited_email IS DISTINCT FROM OLD.invited_email THEN
      RAISE EXCEPTION 'Changing invited_email on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.invited_role IS DISTINCT FROM OLD.invited_role THEN
      RAISE EXCEPTION 'Changing invited_role on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.token_hash IS DISTINCT FROM OLD.token_hash THEN
      RAISE EXCEPTION 'Changing token_hash on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
      RAISE EXCEPTION 'Changing expires_at on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Changing created_at on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;

    -- Allow ONLY legitimate PostgreSQL FK ON DELETE SET NULL cascades on
    -- invited_by / accepted_by when an auth.users row is deleted.
    v_is_pure_fk_nullification := (
      pg_catalog.pg_trigger_depth() > 1
      AND current_user NOT IN ('anon', 'authenticated')
      AND NEW.status IS NOT DISTINCT FROM OLD.status
      AND NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at
      AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at
      AND (
        (OLD.invited_by IS NOT NULL AND NEW.invited_by IS NULL)
        OR NEW.invited_by IS NOT DISTINCT FROM OLD.invited_by
      )
      AND (
        (OLD.accepted_by IS NOT NULL AND NEW.accepted_by IS NULL)
        OR NEW.accepted_by IS NOT DISTINCT FROM OLD.accepted_by
      )
      AND (
        NEW.invited_by IS DISTINCT FROM OLD.invited_by
        OR NEW.accepted_by IS DISTINCT FROM OLD.accepted_by
      )
    );

    IF v_is_pure_fk_nullification THEN
      RETURN NEW;
    END IF;

    IF NEW.invited_by IS DISTINCT FROM OLD.invited_by THEN
      RAISE EXCEPTION 'Changing invited_by on an existing agency invitation is forbidden.'
        USING ERRCODE = '42501';
    END IF;

    -- Terminal states (accepted, revoked, expired) are strictly immutable (single-use).
    IF OLD.status <> 'pending'::public.agency_invitation_status THEN
      RAISE EXCEPTION 'Finalized agency invitations cannot be modified.'
        USING ERRCODE = '42501';
    END IF;

    -- Enforce valid transitions out of 'pending'
    IF NEW.status = 'accepted'::public.agency_invitation_status THEN
      IF OLD.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION 'Expired agency invitations cannot be accepted.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.accepted_by IS NULL OR NEW.accepted_at IS NULL OR NEW.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Accepted agency invitations require accepted_by and accepted_at without revoked_at.'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.status = 'revoked'::public.agency_invitation_status THEN
      IF OLD.expires_at <= pg_catalog.now() THEN
        RAISE EXCEPTION 'Expired agency invitations cannot be revoked.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.revoked_at IS NULL OR NEW.accepted_by IS NOT NULL OR NEW.accepted_at IS NOT NULL THEN
        RAISE EXCEPTION 'Revoked agency invitations require revoked_at without acceptance metadata.'
          USING ERRCODE = '23514';
      END IF;
    ELSIF NEW.status = 'expired'::public.agency_invitation_status THEN
      IF OLD.expires_at > pg_catalog.now() THEN
        RAISE EXCEPTION 'Agency invitation cannot be marked expired before expires_at.'
          USING ERRCODE = '23514';
      END IF;
      IF NEW.accepted_by IS NOT NULL OR NEW.accepted_at IS NOT NULL OR NEW.revoked_at IS NOT NULL THEN
        RAISE EXCEPTION 'Expired agency invitations cannot carry acceptance or revocation metadata.'
          USING ERRCODE = '23514';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid agency invitation status transition from % to %.', OLD.status, NEW.status
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- Server-trusted transactional audit trigger for agency invitations.
-- Never callable directly by clients; preserves Phase 3 audit_logs lockdown.
-- Never logs plaintext tokens, token_hash, or personal email addresses.
CREATE OR REPLACE FUNCTION public.audit_agency_invitation_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_action text;
  v_metadata jsonb := '{}'::jsonb;
BEGIN
  IF TG_TABLE_NAME <> 'agency_invitations' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_action := 'invitation.created';
    v_metadata := pg_catalog.jsonb_build_object(
      'invited_role', NEW.invited_role,
      'status', NEW.status,
      'expires_at', NEW.expires_at
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Ignore pure foreign-key attribution nullification (auth.users ON DELETE SET NULL)
    IF NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.accepted_at IS NOT DISTINCT FROM OLD.accepted_at
       AND NEW.revoked_at IS NOT DISTINCT FROM OLD.revoked_at
       AND (
         (OLD.invited_by IS NOT NULL AND NEW.invited_by IS NULL)
         OR (OLD.accepted_by IS NOT NULL AND NEW.accepted_by IS NULL)
       ) THEN
      RETURN NULL;
    END IF;

    IF OLD.status = 'pending'::public.agency_invitation_status
       AND NEW.status = 'revoked'::public.agency_invitation_status THEN
      v_action := 'invitation.revoked';
    ELSIF OLD.status = 'pending'::public.agency_invitation_status
          AND NEW.status = 'accepted'::public.agency_invitation_status THEN
      v_action := 'invitation.accepted';
    ELSIF OLD.status = 'pending'::public.agency_invitation_status
          AND NEW.status = 'expired'::public.agency_invitation_status THEN
      v_action := 'invitation.expired';
    ELSE
      RETURN NULL;
    END IF;

    v_metadata := pg_catalog.jsonb_build_object(
      'invited_role', NEW.invited_role,
      'from_status', OLD.status,
      'to_status', NEW.status,
      'expires_at', NEW.expires_at,
      'accepted_by', NEW.accepted_by,
      'accepted_at', NEW.accepted_at,
      'revoked_at', NEW.revoked_at
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
    NEW.agency_id,
    auth.uid(),
    v_action,
    TG_TABLE_NAME,
    NEW.id,
    v_metadata
  );

  RETURN NULL;
END;
$$;

-- Additive transactional audit trigger for agency_memberships INSERT events.
-- Migration 0002's trg_agency_memberships_audit covers AFTER UPDATE OR DELETE;
-- this minimal companion trigger ensures membership creation (via create_agency
-- or accept_agency_invitation) is also transactionally recorded without altering
-- migration 0002 functions or logging sensitive token/email data.
CREATE OR REPLACE FUNCTION public.audit_agency_membership_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME <> 'agency_memberships' OR TG_OP <> 'INSERT' THEN
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
    NEW.agency_id,
    auth.uid(),
    'membership.created',
    TG_TABLE_NAME,
    NEW.id,
    pg_catalog.jsonb_build_object(
      'target_user_id', NEW.user_id,
      'role', NEW.role,
      'status', NEW.status,
      'invited_by', NEW.invited_by
    )
  );

  RETURN NULL;
END;
$$;

-- Revoke direct execute privileges on trigger functions from all client roles
REVOKE ALL ON FUNCTION public.guard_agency_invitation_integrity()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_agency_invitation_change()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_agency_membership_insert()
  FROM PUBLIC, anon, authenticated;

-- Attach triggers in guaranteed alphabetical BEFORE order:
--   1. trg_agency_invitations_integrity  (BEFORE INSERT OR UPDATE)
--   2. trg_agency_invitations_updated_at (BEFORE UPDATE, skips pure FK cascades)
--   3. trg_agency_invitations_audit      (AFTER INSERT OR UPDATE)
--   4. trg_agency_memberships_insert_audit (AFTER INSERT on agency_memberships)
DROP TRIGGER IF EXISTS trg_agency_invitations_integrity ON public.agency_invitations;
CREATE TRIGGER trg_agency_invitations_integrity
  BEFORE INSERT OR UPDATE ON public.agency_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_agency_invitation_integrity();

DROP TRIGGER IF EXISTS trg_agency_invitations_updated_at ON public.agency_invitations;
CREATE TRIGGER trg_agency_invitations_updated_at
  BEFORE UPDATE ON public.agency_invitations
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    OR OLD.accepted_at IS DISTINCT FROM NEW.accepted_at
    OR OLD.revoked_at IS DISTINCT FROM NEW.revoked_at
  )
  EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_agency_invitations_audit ON public.agency_invitations;
CREATE TRIGGER trg_agency_invitations_audit
  AFTER INSERT OR UPDATE ON public.agency_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_agency_invitation_change();

DROP TRIGGER IF EXISTS trg_agency_memberships_insert_audit ON public.agency_memberships;
CREATE TRIGGER trg_agency_memberships_insert_audit
  AFTER INSERT ON public.agency_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_agency_membership_insert();

-- -----------------------------------------------------------------------------
-- 4. Least-Privilege SQL Grants & Forced Row Level Security
-- -----------------------------------------------------------------------------
REVOKE ALL ON TABLE public.agency_invitations FROM PUBLIC, anon, authenticated;

-- Column-level SELECT only for authenticated role:
--   - token_hash is explicitly EXCLUDED from client-facing SELECT permissions.
--   - Direct INSERT, UPDATE, and DELETE are NOT granted; all validated invitation
--     writes are performed exclusively through the SECURITY DEFINER RPCs below.
GRANT SELECT (
  id,
  agency_id,
  invited_email,
  invited_role,
  status,
  invited_by,
  accepted_by,
  expires_at,
  accepted_at,
  revoked_at,
  created_at,
  updated_at
) ON TABLE public.agency_invitations TO authenticated;

ALTER TABLE public.agency_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_invitations FORCE ROW LEVEL SECURITY;

-- Only active agency Owners may read invitations belonging to their own agency.
-- Managers, Agents, cross-agency users, and anonymous callers have zero access.
DROP POLICY IF EXISTS agency_invitations_select_owner_only ON public.agency_invitations;
CREATE POLICY agency_invitations_select_owner_only
  ON public.agency_invitations
  FOR SELECT
  TO authenticated
  USING (public.has_agency_role(agency_id, ARRAY['owner']::public.agency_role[]));

-- Direct client INSERT, UPDATE, and DELETE policies are intentionally absent.
-- Direct client INSERT on public.agency_memberships remains revoked (migrations 0002–0003).

-- -----------------------------------------------------------------------------
-- 5. Owner-Only Team & Invitation Management RPCs (SECURITY DEFINER)
--    - Locked search_path = '' and fully schema-qualified references
--    - Validates auth.uid() and Owner role for p_agency_id internally
--    - Never exposes auth.users wholesale or invitation token_hash
--    - Never inserts into public.agency_memberships directly
--    - Transactionally triggers public.audit_logs via trg_agency_invitations_audit
-- -----------------------------------------------------------------------------

-- 5a. List agency members with minimal display identity (Owner-only)
CREATE OR REPLACE FUNCTION public.list_agency_members(
  p_agency_id uuid
)
RETURNS TABLE (
  membership_id uuid,
  agency_id uuid,
  user_id uuid,
  role public.agency_role,
  status public.membership_status,
  email text,
  full_name text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'Agency identifier is required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_agency_role(p_agency_id, ARRAY['owner']::public.agency_role[]) THEN
    RAISE EXCEPTION 'Only active agency owners can list agency members.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS membership_id,
    m.agency_id,
    m.user_id,
    m.role,
    m.status,
    pg_catalog.lower(pg_catalog.btrim(u.email))::text AS email,
    NULLIF(pg_catalog.btrim(COALESCE(u.raw_user_meta_data ->> 'full_name', '')), '')::text AS full_name,
    m.created_at
  FROM public.agency_memberships m
  JOIN auth.users u ON u.id = m.user_id
  WHERE m.agency_id = p_agency_id
  ORDER BY
    CASE m.role
      WHEN 'owner'::public.agency_role THEN 0
      WHEN 'manager'::public.agency_role THEN 1
      ELSE 2
    END ASC,
    m.created_at ASC;
END;
$$;

-- 5b. Create a pending Manager or Agent invitation (Owner-only, hashed token only)
--     Never creates an active membership directly; never returns token_hash.
CREATE OR REPLACE FUNCTION public.create_agency_invitation(
  p_agency_id uuid,
  p_invited_email text,
  p_invited_role public.agency_role,
  p_token_hash text,
  p_expires_in_hours integer DEFAULT 168
)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  invited_email text,
  invited_role public.agency_role,
  status public.agency_invitation_status,
  invited_by uuid,
  expires_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_email text;
  v_clean_token_hash text;
  v_now timestamptz;
  v_expires_at timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_agency_id IS NULL THEN
    RAISE EXCEPTION 'Agency identifier is required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_agency_role(p_agency_id, ARRAY['owner']::public.agency_role[]) THEN
    RAISE EXCEPTION 'Only active agency owners can create invitations.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_invited_email, '')));
  IF pg_catalog.char_length(v_clean_email) < 5
     OR pg_catalog.char_length(v_clean_email) > 254
     OR v_clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]{2,}$' THEN
    RAISE EXCEPTION 'A valid invited email address is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_invited_role IS NULL
     OR p_invited_role NOT IN ('manager'::public.agency_role, 'agent'::public.agency_role) THEN
    RAISE EXCEPTION 'Invitation role must be manager or agent.'
      USING ERRCODE = '22023';
  END IF;

  v_clean_token_hash := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_token_hash, '')));
  IF v_clean_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid 64-character lowercase SHA-256 token hash is required.'
      USING ERRCODE = '22023';
  END IF;

  IF p_expires_in_hours IS NULL OR p_expires_in_hours < 1 OR p_expires_in_hours > 720 THEN
    RAISE EXCEPTION 'Invitation expiration must be between 1 and 720 hours.'
      USING ERRCODE = '22023';
  END IF;

  -- Serialize invitation creation per agency and confirm parent agency exists
  PERFORM 1
    FROM public.agencies a
   WHERE a.id = p_agency_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agency not found.'
      USING ERRCODE = '42501';
  END IF;

  -- Reject inviting an email that already has a membership in this agency
  -- (scoped strictly to this agency so external user existence is never leaked)
  IF EXISTS (
    SELECT 1
      FROM public.agency_memberships m
      JOIN auth.users u ON u.id = m.user_id
     WHERE m.agency_id = p_agency_id
       AND pg_catalog.lower(pg_catalog.btrim(COALESCE(u.email, ''))) = v_clean_email
  ) THEN
    RAISE EXCEPTION 'This email already belongs to a member of this agency.'
      USING ERRCODE = '23505';
  END IF;

  v_now := pg_catalog.now();

  -- Mark any lapsed pending invitation for this email in this agency as expired
  -- so the owner can cleanly issue a fresh invitation
  UPDATE public.agency_invitations inv
     SET status = 'expired'::public.agency_invitation_status
   WHERE inv.agency_id = p_agency_id
     AND inv.invited_email = v_clean_email
     AND inv.status = 'pending'::public.agency_invitation_status
     AND inv.expires_at <= v_now;

  IF EXISTS (
    SELECT 1
      FROM public.agency_invitations inv
     WHERE inv.agency_id = p_agency_id
       AND inv.invited_email = v_clean_email
       AND inv.status = 'pending'::public.agency_invitation_status
  ) THEN
    RAISE EXCEPTION 'A pending invitation already exists for this email in this agency.'
      USING ERRCODE = '23505',
            CONSTRAINT = 'idx_agency_invitations_one_pending_per_email';
  END IF;

  v_expires_at := v_now + pg_catalog.make_interval(hours => p_expires_in_hours);

  -- Transactional insert fires trg_agency_invitations_integrity and
  -- trg_agency_invitations_audit ('invitation.created') atomically.
  RETURN QUERY
  INSERT INTO public.agency_invitations (
    agency_id,
    invited_email,
    invited_role,
    token_hash,
    status,
    invited_by,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    p_agency_id,
    v_clean_email,
    p_invited_role,
    v_clean_token_hash,
    'pending'::public.agency_invitation_status,
    v_actor_id,
    v_expires_at,
    v_now,
    v_now
  )
  RETURNING
    public.agency_invitations.id,
    public.agency_invitations.agency_id,
    public.agency_invitations.invited_email,
    public.agency_invitations.invited_role,
    public.agency_invitations.status,
    public.agency_invitations.invited_by,
    public.agency_invitations.expires_at,
    public.agency_invitations.created_at,
    public.agency_invitations.updated_at;
END;
$$;

-- 5c. Revoke an unexpired pending invitation strictly within the verified agency (Owner-only)
--     Never returns token_hash; fires trg_agency_invitations_audit ('invitation.revoked').
CREATE OR REPLACE FUNCTION public.revoke_agency_invitation(
  p_agency_id uuid,
  p_invitation_id uuid
)
RETURNS TABLE (
  id uuid,
  agency_id uuid,
  invited_email text,
  invited_role public.agency_role,
  status public.agency_invitation_status,
  invited_by uuid,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_inv public.agency_invitations;
  v_now timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  IF p_agency_id IS NULL OR p_invitation_id IS NULL THEN
    RAISE EXCEPTION 'Agency and invitation identifiers are required.'
      USING ERRCODE = '22023';
  END IF;

  IF NOT public.has_agency_role(p_agency_id, ARRAY['owner']::public.agency_role[]) THEN
    RAISE EXCEPTION 'Only active agency owners can revoke invitations.'
      USING ERRCODE = '42501';
  END IF;

  -- Strictly tenant-scoped row lock prevents cross-agency probing or concurrent races
  SELECT *
    INTO v_inv
    FROM public.agency_invitations inv
   WHERE inv.id = p_invitation_id
     AND inv.agency_id = p_agency_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found in this agency.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_inv.status <> 'pending'::public.agency_invitation_status THEN
    RAISE EXCEPTION 'Only pending invitations can be revoked.'
      USING ERRCODE = '23514';
  END IF;

  v_now := pg_catalog.now();
  IF v_inv.expires_at <= v_now THEN
    RAISE EXCEPTION 'Expired agency invitations cannot be revoked.'
      USING ERRCODE = '23514';
  END IF;

  -- Transactional update fires trg_agency_invitations_integrity,
  -- trg_agency_invitations_updated_at, and trg_agency_invitations_audit ('invitation.revoked').
  RETURN QUERY
  UPDATE public.agency_invitations inv
     SET status = 'revoked'::public.agency_invitation_status,
         revoked_at = v_now
   WHERE inv.id = v_inv.id
     AND inv.agency_id = p_agency_id
  RETURNING
    inv.id,
    inv.agency_id,
    inv.invited_email,
    inv.invited_role,
    inv.status,
    inv.invited_by,
    inv.expires_at,
    inv.revoked_at,
    inv.created_at,
    inv.updated_at;
END;
$$;

-- 5d. Securely accept a pending single-use invitation (authenticated recipient)
--     - Requires verified email (auth.users.email_confirmed_at IS NOT NULL)
--       matching normalized invited_email
--     - Locks invitation row FOR UPDATE to prevent concurrent replay/revocation races
--     - Rejects missing, expired, revoked, accepted, or email-mismatched invitations
--       with the same safe generic error to prevent token/email oracle leakage
--     - Never grants 'owner'; preserves exact 'manager' or 'agent' invited_role
--     - Prevents duplicate memberships and never silently reactivates suspended
--       or previously invited memberships
--     - Atomically marks invitation accepted and inserts active agency membership
--     - Transactionally records invitation.accepted and membership.created in audit_logs
--     - Never returns token_hash or other users' personal information
CREATE OR REPLACE FUNCTION public.accept_agency_invitation(
  p_token_hash text
)
RETURNS TABLE (
  invitation_id uuid,
  agency_id uuid,
  membership_id uuid,
  role public.agency_role,
  status public.membership_status,
  accepted_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_clean_token_hash text;
  v_user_email text;
  v_user_email_confirmed_at timestamptz;
  v_clean_user_email text;
  v_inv public.agency_invitations;
  v_existing_membership_status public.membership_status;
  v_membership_id uuid;
  v_now timestamptz;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_token_hash := pg_catalog.lower(pg_catalog.btrim(COALESCE(p_token_hash, '')));
  IF v_clean_token_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'A valid 64-character lowercase SHA-256 token hash is required.'
      USING ERRCODE = '22023';
  END IF;

  -- Verify the authenticated caller's email is present and confirmed before
  -- touching agency_invitations (prevents unverified callers from probing tokens).
  SELECT u.email, u.email_confirmed_at
    INTO v_user_email, v_user_email_confirmed_at
    FROM auth.users u
   WHERE u.id = v_actor_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  v_clean_user_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(v_user_email, '')));
  IF v_user_email_confirmed_at IS NULL OR v_clean_user_email = '' THEN
    RAISE EXCEPTION 'A verified email address is required to accept an invitation.'
      USING ERRCODE = '42501';
  END IF;

  -- Lock the invitation row FOR UPDATE so concurrent acceptances or revocations
  -- serialize strictly on the same single-use row.
  SELECT *
    INTO v_inv
    FROM public.agency_invitations inv
   WHERE inv.token_hash = v_clean_token_hash
     FOR UPDATE;

  v_now := pg_catalog.now();

  -- Uniform generic rejection for missing, non-pending (accepted/revoked/expired),
  -- expired-by-time, or mismatched-email invitations to prevent oracle leakage.
  IF NOT FOUND
     OR v_inv.status <> 'pending'::public.agency_invitation_status
     OR v_inv.expires_at <= v_now
     OR v_inv.invited_email IS DISTINCT FROM v_clean_user_email THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  -- Defense-in-depth role guard: invitations can never grant the Owner role.
  IF v_inv.invited_role IS NULL
     OR v_inv.invited_role NOT IN ('manager'::public.agency_role, 'agent'::public.agency_role) THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  -- Confirm parent agency exists (strictly bound to v_inv.agency_id).
  IF NOT EXISTS (
    SELECT 1
      FROM public.agencies a
     WHERE a.id = v_inv.agency_id
  ) THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  -- Prevent duplicate memberships and never silently reactivate suspended or
  -- previously invited memberships for this (agency_id, user_id) pair.
  SELECT m.status
    INTO v_existing_membership_status
    FROM public.agency_memberships m
   WHERE m.agency_id = v_inv.agency_id
     AND m.user_id = v_actor_id
     FOR UPDATE;

  IF FOUND THEN
    IF v_existing_membership_status = 'suspended'::public.membership_status THEN
      RAISE EXCEPTION 'Unable to accept invitation for this agency membership state.'
        USING ERRCODE = '42501';
    ELSE
      RAISE EXCEPTION 'You already have a membership in this agency.'
        USING ERRCODE = '23505',
              CONSTRAINT = 'agency_memberships_unique_member';
    END IF;
  END IF;

  -- Atomically consume the single-use invitation inside this transaction.
  -- Fires trg_agency_invitations_integrity, trg_agency_invitations_updated_at,
  -- and trg_agency_invitations_audit ('invitation.accepted').
  UPDATE public.agency_invitations inv
     SET status = 'accepted'::public.agency_invitation_status,
         accepted_by = v_actor_id,
         accepted_at = v_now
   WHERE inv.id = v_inv.id
     AND inv.agency_id = v_inv.agency_id
     AND inv.status = 'pending'::public.agency_invitation_status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or unavailable.'
      USING ERRCODE = '42501';
  END IF;

  -- Atomically create the active membership strictly in v_inv.agency_id with
  -- the exact invited Manager/Agent role.
  -- Fires agency_memberships_unique_member and trg_agency_memberships_insert_audit
  -- ('membership.created'). Any error rolls back the entire transaction.
  INSERT INTO public.agency_memberships (
    agency_id,
    user_id,
    role,
    status,
    invited_by
  )
  VALUES (
    v_inv.agency_id,
    v_actor_id,
    v_inv.invited_role,
    'active'::public.membership_status,
    v_inv.invited_by
  )
  RETURNING public.agency_memberships.id
  INTO v_membership_id;

  RETURN QUERY
  SELECT
    v_inv.id AS invitation_id,
    v_inv.agency_id AS agency_id,
    v_membership_id AS membership_id,
    v_inv.invited_role AS role,
    'active'::public.membership_status AS status,
    v_now AS accepted_at;
END;
$$;

-- Restrict EXECUTE permissions on all four Team/Invitation RPCs strictly to authenticated
REVOKE ALL ON FUNCTION public.list_agency_members(uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_agency_invitation(uuid, text, public.agency_role, text, integer)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_agency_invitation(uuid, uuid)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_agency_invitation(text)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.list_agency_members(uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_agency_invitation(uuid, text, public.agency_role, text, integer)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_agency_invitation(uuid, uuid)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_agency_invitation(text)
  TO authenticated;

COMMIT;
