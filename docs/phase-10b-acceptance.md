# Phase 10B — rental preparation & handover acceptance

**Status:** Implemented in code on a DRAFT GitHub PR. Not production-enabled.

## Prerequisites
- Migration 0010 must be reviewed and installed before the contract draft registry works.
- Migration 0011 must be reviewed and installed **after 0010** before handovers can be recorded.
- Read-only Supabase inspection on 2026-11-28 found no `rental_contracts` or `vehicle_handover_inspections` tables and no `public.transition_reservation_status` RPC. Confirm the intended database environment and missing booking transition function **before a live agency pilot**.
- Do not execute either migration without a tested rollback/backup plan and cross-agency permission checks.
- Supabase migration tracking may show an empty history even when baseline tables exist because the baseline was applied manually; check actual catalog state.

## Current functionality
- FR/EN/AR authenticated rental preparation sheet, printable via the browser. Printed output intentionally says *WORKING DOCUMENT / DOCUMENT DE TRAVAIL / وثيقة عمل داخلية*. It is dynamic and **not a signed legal contract**.
- Pickup and return check form with staff attestation, odometer/fuel/keys/documents/interior/exterior/damage and optional notes.
- Strict server input allowlist; active agency and current staff identity are always derived from authenticated server context.
- Append-only PostgreSQL inspection design; one pickup and one return per reservation; database checks state, odometer sequence and audit events.
- Missing optional schema fails closed for writes and shows an accurate in-app warning.
- Photo uploads, signatures, legal terms, payments and automatic fleet odometer changes remain **out of scope**.

## Required production verification before merge
1. Apply migrations 0010 and 0011 on a **separate test Supabase project** first.
2. Run `supabase/tests/verify_0010_rental_contract_drafts_readonly.sql` and `supabase/tests/verify_0011_vehicle_handover_readonly.sql`; all checks must pass.
3. Create real authenticated test accounts in Agency A and Agency B. Verify cross-agency SELECT/INSERT and forged actor fields fail.
4. Verify Owner, Manager and Agent permissions for inspections and Owner/Manager-only contract draft creation.
5. Verify pickup only for confirmed/active; return only active/completed, only after pickup, with non-decreasing mileage.
6. Verify duplicate concurrent pickup/return requests: exactly one row commits, no duplicate audit.
7. Verify append-only guarantees even with direct authenticated REST requests, not only app UI restrictions.
8. Inspect FR/EN/AR light/dark at 390×844, 768×1024, 1440×900, with accessibility keyboard and RTL.
9. Verify printable preparation sheet never renders cross-agency records and never conveys a signed contract.
10. Validate legal terms with a qualified country-specific professional before offering any legally binding agreement. Payments and signatures remain disabled.

## Data / privacy
- No public Storage bucket or generated public URLs. Damage photo evidence will require a separate private-storage migration, scoped ownership policies and retention rules.
- No customer signatures or e-signatures are captured; `staff_attested` only records which authenticated employee submitted the internal inspection.
- The published template has no legal terms and does not evidence payment collection.
- Printed sheets include customer details. Only authenticated active-agency members may view them; agency admins should safeguard saved print/PDF files.
