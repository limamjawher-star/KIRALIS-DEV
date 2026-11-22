-- =============================================================================
-- KIRALIS — Phase 5B.1 Migration 0004: Vehicle Compliance Expiry Dates
-- Target: Supabase PostgreSQL (additive, non-destructive)
--
-- Purpose:
--   Adds optional calendar expiry dates for insurance, technical inspection,
--   and annual vehicle tax (vignette) to public.vehicles while preserving all
--   existing rows, constraints, triggers, audit logging, and RLS policies.
--
-- Security notes:
--   - Migration 0002 uses column-level UPDATE grants on public.vehicles.
--     Therefore, authenticated UPDATE must be explicitly granted on the three
--     new columns while keeping immutable columns (id, agency_id, created_by,
--     created_at) non-updatable.
--   - Existing RLS policies on public.vehicles continue to enforce:
--       * SELECT: any active agency member (owner, manager, agent)
--       * INSERT / UPDATE: active owner or manager only
--   - Existing trigger trg_vehicles_audit continues to record vehicle.created
--     and vehicle.updated automatically without exposing unnecessary metadata.
-- =============================================================================

-- 1. Add optional PostgreSQL DATE columns (non-destructive, nullable)
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS insurance_expires_on date,
  ADD COLUMN IF NOT EXISTS technical_inspection_expires_on date,
  ADD COLUMN IF NOT EXISTS vignette_expires_on date;

-- 2. Extend column-level UPDATE grant for authenticated role
--    (RLS policy vehicles_update_owner_manager enforces owner/manager restriction)
GRANT UPDATE (
  insurance_expires_on,
  technical_inspection_expires_on,
  vignette_expires_on
) ON TABLE public.vehicles TO authenticated;

-- 3. Tenant-scoped partial index for expiry alerts queries
CREATE INDEX IF NOT EXISTS idx_vehicles_agency_compliance_dates
  ON public.vehicles (
    agency_id,
    insurance_expires_on,
    technical_inspection_expires_on,
    vignette_expires_on
  )
  WHERE insurance_expires_on IS NOT NULL
     OR technical_inspection_expires_on IS NOT NULL
     OR vignette_expires_on IS NOT NULL;
