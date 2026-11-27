-- =============================================================================
-- KIRALIS — Phase 6A Migration 0006: Customer Direct DELETE Lockdown
-- Target: Supabase PostgreSQL (additive, non-destructive)
--
-- Purpose:
--   Revokes direct client DELETE privileges on public.customers and removes
--   the permissive customers_delete_owner_manager RLS policy to preserve
--   customer history, financial auditability, and future reservation integrity.
--
-- Preserved:
--   - All existing customer rows, constraints, indexes, and triggers.
--   - Forced Row Level Security on public.customers.
--   - SELECT, INSERT, and column-level UPDATE privileges for active agency
--     members (Owner, Manager, Agent) as defined in migration 0002.
--
-- IMPORTANT:
--   - Preserve migrations 0001–0005 without modification.
--   - Do NOT re-execute previous migrations.
--   - Review and apply manually in Supabase SQL Editor.
-- =============================================================================

BEGIN;

REVOKE DELETE ON TABLE public.customers FROM PUBLIC, anon, authenticated;

DROP POLICY IF EXISTS customers_delete_owner_manager ON public.customers;

COMMIT;
