-- =============================================================================
-- KIRALIS — Phase 3 RLS & Security Verification Test Suite
--
-- Usage:
--   Run in Supabase SQL Editor or via `psql` AFTER executing migrations 0001 and 0002.
--   The entire script runs inside a transaction and finishes with ROLLBACK so no
--   synthetic test users or records remain in your database.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  v_owner_a uuid := gen_random_uuid();
  v_owner_a2 uuid := gen_random_uuid();
  v_manager_a uuid := gen_random_uuid();
  v_agent_a uuid := gen_random_uuid();
  v_invited_a uuid := gen_random_uuid();
  v_owner_b uuid := gen_random_uuid();

  v_agency_a uuid;
  v_agency_b uuid;
  v_vehicle_a uuid;
  v_vehicle_a2 uuid;
  v_vehicle_b uuid;
  v_customer_a uuid;
  v_customer_b uuid;
  v_res_pending uuid;
  v_res_overlap uuid;
  v_res_back_to_back uuid;
  v_res_draft uuid;
  v_res_row public.reservations;
  v_audit_id uuid;

  v_count integer;
  v_failed boolean;
BEGIN
  -- ---------------------------------------------------------------------------
  -- Setup synthetic auth.users (rolled back at end of test transaction)
  -- ---------------------------------------------------------------------------
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_owner_a,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'owner.a@kiralis.test',   '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_owner_a2,  '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'owner.a2@kiralis.test',  '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_manager_a, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'manager.a@kiralis.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_agent_a,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'agent.a@kiralis.test',   '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_invited_a, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'invited.a@kiralis.test', '{}'::jsonb, '{}'::jsonb, now(), now()),
    (v_owner_b,   '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'owner.b@kiralis.test',   '{}'::jsonb, '{}'::jsonb, now(), now());

  -- ===========================================================================
  -- TEST 1: Anonymous role has zero access to tables or privileged RPCs
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE anon';
  PERFORM set_config('request.jwt.claims', '{}', true);

  v_failed := false;
  BEGIN
    PERFORM count(*) FROM public.agencies;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 1a FAILED: anon must not have SELECT privilege on agencies';

  v_failed := false;
  BEGIN
    PERFORM public.create_agency('Anon Agency', 'anon-agency');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 1b FAILED: anon must not be able to execute create_agency';

  v_failed := false;
  BEGIN
    PERFORM public.transition_reservation_status(gen_random_uuid(), 'confirmed');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 1c FAILED: anon must not be able to execute transition_reservation_status';

  EXECUTE 'RESET ROLE';

  -- ===========================================================================
  -- TEST 2: Secure agency creation & prohibition of direct membership INSERT
  -- ===========================================================================
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);

  SELECT id INTO v_agency_a
  FROM public.create_agency('Atlas Test A', 'atlas-test-a', 'Atlas SARL', '1234567/A/M/000', 'a@kiralis.test', '+216 71 000 001', 'Tunis');
  ASSERT v_agency_a IS NOT NULL, 'TEST 2a FAILED: create_agency did not return agency id';

  -- Direct INSERT into agencies must be rejected
  v_failed := false;
  BEGIN
    INSERT INTO public.agencies (name, slug) VALUES ('Bypass Agency', 'bypass-agency');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 2b FAILED: direct INSERT into agencies must be blocked';

  -- Direct INSERT into agency_memberships must be rejected in MVP (even for an active owner)
  v_failed := false;
  BEGIN
    INSERT INTO public.agency_memberships (agency_id, user_id, role, status, invited_by)
    VALUES (v_agency_a, v_manager_a, 'manager', 'active', v_owner_a);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 2c FAILED: direct INSERT into agency_memberships must be prohibited in MVP';

  -- Seed team fixtures as privileged role (simulating future invitation-acceptance flow)
  EXECUTE 'RESET ROLE';
  INSERT INTO public.agency_memberships (agency_id, user_id, role, status, invited_by)
  VALUES
    (v_agency_a, v_manager_a, 'manager', 'active',  v_owner_a),
    (v_agency_a, v_agent_a,   'agent',   'active',  v_owner_a),
    (v_agency_a, v_invited_a, 'agent',   'invited', v_owner_a);

  -- Switch back to Owner A (authenticated)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);

  -- Owner A cannot arbitrarily activate an invited membership directly
  v_failed := false;
  BEGIN
    UPDATE public.agency_memberships
       SET status = 'active'
     WHERE agency_id = v_agency_a AND user_id = v_invited_a;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 2d FAILED: invited membership must not be directly activatable without acceptance workflow';

  -- Owner A cannot forge created_by on vehicles
  v_failed := false;
  BEGIN
    INSERT INTO public.vehicles (agency_id, plate_number, brand, model, daily_rate_minor, deposit_minor, created_by)
    VALUES (v_agency_a, '240 TUN 0000', 'Renault', 'Clio', 120000, 500000, v_agent_a);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 2e FAILED: forging created_by on vehicle INSERT must be blocked';

  -- Owner A creates vehicles and a customer in Agency A
  INSERT INTO public.vehicles (agency_id, plate_number, brand, model, daily_rate_minor, deposit_minor, created_by)
  VALUES (v_agency_a, '240 TUN 1001', 'Renault', 'Clio', 120000, 500000, v_owner_a)
  RETURNING id INTO v_vehicle_a;

  INSERT INTO public.vehicles (agency_id, plate_number, brand, model, daily_rate_minor, deposit_minor, created_by)
  VALUES (v_agency_a, '240 TUN 1002', 'Hyundai', 'i20', 130000, 500000, v_owner_a)
  RETURNING id INTO v_vehicle_a2;

  INSERT INTO public.customers (agency_id, full_name, phone, email, created_by)
  VALUES (v_agency_a, 'Amine Ben Ali', '+216 98 111 222', 'amine@example.test', v_owner_a)
  RETURNING id INTO v_customer_a;

  -- ===========================================================================
  -- TEST 3: Tenant isolation — Owner B creates Agency B and sees zero Agency A rows
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b, 'role', 'authenticated')::text, true);

  SELECT id INTO v_agency_b
  FROM public.create_agency('Carthage Test B', 'carthage-test-b');

  INSERT INTO public.vehicles (agency_id, plate_number, brand, model, daily_rate_minor, deposit_minor, created_by)
  VALUES (v_agency_b, '241 TUN 2002', 'Peugeot', '208', 135000, 600000, v_owner_b)
  RETURNING id INTO v_vehicle_b;

  INSERT INTO public.customers (agency_id, full_name, phone, email, created_by)
  VALUES (v_agency_b, 'Sonia Trabelsi', '+216 98 333 444', 'sonia@example.test', v_owner_b)
  RETURNING id INTO v_customer_b;

  SELECT count(*) INTO v_count FROM public.agencies WHERE id = v_agency_a;
  ASSERT v_count = 0, 'TEST 3a FAILED: Owner B must not see Agency A';

  SELECT count(*) INTO v_count FROM public.vehicles WHERE id = v_vehicle_a;
  ASSERT v_count = 0, 'TEST 3b FAILED: Owner B must not see Agency A vehicles';

  SELECT count(*) INTO v_count FROM public.customers WHERE id = v_customer_a;
  ASSERT v_count = 0, 'TEST 3c FAILED: Owner B must not see Agency A customers';

  SELECT count(*) INTO v_count FROM public.audit_logs WHERE agency_id = v_agency_a;
  ASSERT v_count = 0, 'TEST 3d FAILED: Owner B must not see Agency A audit logs';

  -- ===========================================================================
  -- TEST 4: Cross-agency foreign key protection
  -- ===========================================================================
  v_failed := false;
  BEGIN
    INSERT INTO public.reservations (
      agency_id, reference_code, vehicle_id, customer_id, status,
      pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
    )
    VALUES (
      v_agency_b, 'RES-X-001', v_vehicle_a, v_customer_b, 'pending',
      '2026-12-01 09:00+01', '2026-12-03 09:00+01', 120000, 240000, 45600, 0, 285600, v_owner_b
    );
  EXCEPTION WHEN foreign_key_violation THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 4a FAILED: cross-agency vehicle reference must fail FK constraint';

  v_failed := false;
  BEGIN
    INSERT INTO public.reservations (
      agency_id, reference_code, vehicle_id, customer_id, status,
      pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
    )
    VALUES (
      v_agency_b, 'RES-X-002', v_vehicle_b, v_customer_a, 'pending',
      '2026-12-01 09:00+01', '2026-12-03 09:00+01', 135000, 270000, 51300, 0, 321300, v_owner_b
    );
  EXCEPTION WHEN foreign_key_violation THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 4b FAILED: cross-agency customer reference must fail FK constraint';

  -- ===========================================================================
  -- TEST 5: Role boundaries & anti-privilege-escalation checks
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_agent_a, 'role', 'authenticated')::text, true);

  -- Agent cannot elevate own role
  v_failed := false;
  BEGIN
    UPDATE public.agency_memberships
       SET role = 'owner'
     WHERE agency_id = v_agency_a AND user_id = v_agent_a;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count = 0 THEN
      v_failed := true;
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 5a FAILED: Agent must not be able to self-elevate to owner';

  -- Agent cannot insert vehicles (Owner/Manager only)
  v_failed := false;
  BEGIN
    INSERT INTO public.vehicles (agency_id, plate_number, brand, model, daily_rate_minor, created_by)
    VALUES (v_agency_a, '240 TUN 9999', 'Dacia', 'Sandero', 95000, v_agent_a);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 5b FAILED: Agent must not be able to insert vehicles';

  -- Agent cannot read audit_logs (Owner/Manager only)
  SELECT count(*) INTO v_count FROM public.audit_logs WHERE agency_id = v_agency_a;
  ASSERT v_count = 0, 'TEST 5c FAILED: Agent must not read audit_logs';

  -- Invited user has zero agency access
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_invited_a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.vehicles WHERE agency_id = v_agency_a;
  ASSERT v_count = 0, 'TEST 5d FAILED: invited user must not read agency vehicles';

  -- Switch to Manager A
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a, 'role', 'authenticated')::text, true);

  -- Manager cannot promote Agent A to Owner or Manager
  v_failed := false;
  BEGIN
    UPDATE public.agency_memberships
       SET role = 'owner'
     WHERE agency_id = v_agency_a AND user_id = v_agent_a;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 5e FAILED: Manager must not promote agent to owner';

  -- Manager cannot update agency profile (Owner only)
  UPDATE public.agencies SET name = 'Hijacked Name' WHERE id = v_agency_a;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ASSERT v_count = 0, 'TEST 5f FAILED: Manager must not update agency profile';

  -- ===========================================================================
  -- TEST 6: Reservation security (column restrictions, RPC lifecycle, GiST overlap, immutability)
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_agent_a, 'role', 'authenticated')::text, true);

  -- Direct INSERT bypassing pending/draft into confirmed must fail RLS
  v_failed := false;
  BEGIN
    INSERT INTO public.reservations (
      agency_id, reference_code, vehicle_id, customer_id, status,
      pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
    )
    VALUES (
      v_agency_a, 'RES-BYPASS-01', v_vehicle_a, v_customer_a, 'confirmed',
      '2026-12-10 10:00+01', '2026-12-12 10:00+01', 120000, 240000, 45600, 0, 285600, v_agent_a
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6a FAILED: direct INSERT into reservations as confirmed must be rejected';

  -- Agent creates a valid pending reservation
  INSERT INTO public.reservations (
    agency_id, reference_code, vehicle_id, customer_id, status,
    pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
  )
  VALUES (
    v_agency_a, 'RES-2026-0001', v_vehicle_a, v_customer_a, 'pending',
    '2026-12-10 10:00+01', '2026-12-12 10:00+01', 120000, 240000, 45600, 0, 285600, v_agent_a
  )
  RETURNING id INTO v_res_pending;

  -- Direct UPDATE on status must be blocked by column privileges
  v_failed := false;
  BEGIN
    UPDATE public.reservations SET status = 'confirmed' WHERE id = v_res_pending;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6b FAILED: direct UPDATE of reservation status must be blocked';

  -- Direct UPDATE on pricing/taxes/discounts must be blocked by column privileges
  v_failed := false;
  BEGIN
    UPDATE public.reservations SET discount_minor = 100000, total_minor = 185600 WHERE id = v_res_pending;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6c FAILED: direct UPDATE of reservation pricing/discounts must be blocked';

  -- Direct UPDATE on vehicle_id / customer_id must be blocked by column privileges
  v_failed := false;
  BEGIN
    UPDATE public.reservations SET vehicle_id = v_vehicle_a2 WHERE id = v_res_pending;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6d FAILED: direct UPDATE of reservation vehicle_id must be blocked';

  -- Agent can update operational notes on an open reservation
  UPDATE public.reservations
     SET notes = 'Client arrive vol TU716', updated_by = v_agent_a
   WHERE id = v_res_pending;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ASSERT v_count = 1, 'TEST 6e FAILED: active member should update operational notes on open reservation';

  -- Agent cannot confirm pending reservation via RPC (Owner/Manager only)
  v_failed := false;
  BEGIN
    PERFORM public.transition_reservation_status(v_res_pending, 'confirmed');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6f FAILED: Agent must not be able to confirm a pending reservation';

  -- Agent cannot alter pricing/terms via update_pending_reservation_terms (Owner/Manager only)
  v_failed := false;
  BEGIN
    PERFORM public.update_pending_reservation_terms(
      p_reservation_id => v_res_pending,
      p_discount_minor => 20000
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6g FAILED: Agent must not be able to call update_pending_reservation_terms';

  -- Owner B (outsider) cannot transition Agency A reservation
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_b, 'role', 'authenticated')::text, true);
  v_failed := false;
  BEGIN
    PERFORM public.transition_reservation_status(v_res_pending, 'confirmed');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6h FAILED: outsider Owner B must not transition Agency A reservation';

  -- Manager A amends pricing while still pending (server recomputes total_minor)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a, 'role', 'authenticated')::text, true);
  v_res_row := public.update_pending_reservation_terms(
    p_reservation_id => v_res_pending,
    p_discount_minor => 10000
  );
  ASSERT v_res_row.total_minor = 275600, 'TEST 6i FAILED: server did not recompute total_minor accurately';

  -- Manager A confirms reservation via RPC
  v_res_row := public.transition_reservation_status(v_res_pending, 'confirmed');
  ASSERT v_res_row.status = 'confirmed', 'TEST 6j FAILED: Manager should confirm pending reservation';

  -- Once confirmed, even Owner A cannot amend agreed pricing/references via update_pending_reservation_terms
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);
  v_failed := false;
  BEGIN
    PERFORM public.update_pending_reservation_terms(
      p_reservation_id => v_res_pending,
      p_discount_minor => 50000
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6k FAILED: confirmed reservation pricing must not be modifiable';

  -- Overlapping pending reservation fails GiST exclusion constraint when confirming
  INSERT INTO public.reservations (
    agency_id, reference_code, vehicle_id, customer_id, status,
    pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
  )
  VALUES (
    v_agency_a, 'RES-2026-0002', v_vehicle_a, v_customer_a, 'pending',
    '2026-12-11 12:00+01', '2026-12-13 10:00+01', 120000, 240000, 45600, 0, 285600, v_owner_a
  )
  RETURNING id INTO v_res_overlap;

  v_failed := false;
  BEGIN
    PERFORM public.transition_reservation_status(v_res_overlap, 'confirmed');
  EXCEPTION WHEN exclusion_violation THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6l FAILED: overlapping confirmed reservation must fail GiST exclusion constraint';

  -- Back-to-back reservation starting exactly at previous return_at confirms cleanly
  INSERT INTO public.reservations (
    agency_id, reference_code, vehicle_id, customer_id, status,
    pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
  )
  VALUES (
    v_agency_a, 'RES-2026-0003', v_vehicle_a, v_customer_a, 'pending',
    '2026-12-12 10:00+01', '2026-12-14 10:00+01', 120000, 240000, 45600, 0, 285600, v_owner_a
  )
  RETURNING id INTO v_res_back_to_back;

  v_res_row := public.transition_reservation_status(v_res_back_to_back, 'confirmed');
  ASSERT v_res_row.status = 'confirmed', 'TEST 6m FAILED: back-to-back reservation should confirm cleanly';

  -- Invalid money total math must fail check constraint
  v_failed := false;
  BEGIN
    INSERT INTO public.reservations (
      agency_id, reference_code, vehicle_id, customer_id, status,
      pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
    )
    VALUES (
      v_agency_a, 'RES-2026-BAD', v_vehicle_a, v_customer_a, 'pending',
      '2026-12-20 10:00+01', '2026-12-21 10:00+01', 120000, 120000, 22800, 0, 999999, v_owner_a
    );
  EXCEPTION WHEN check_violation THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6n FAILED: inconsistent minor-unit total must fail check constraint';

  -- Complete lifecycle: confirmed -> active -> completed; then verify completed immutability
  v_res_row := public.transition_reservation_status(v_res_pending, 'active');
  ASSERT v_res_row.status = 'active', 'TEST 6o FAILED: confirmed -> active transition should succeed';

  v_res_row := public.transition_reservation_status(v_res_pending, 'completed');
  ASSERT v_res_row.status = 'completed', 'TEST 6p FAILED: active -> completed transition should succeed';

  -- Historical completed reservation cannot change status or even notes
  v_failed := false;
  BEGIN
    PERFORM public.transition_reservation_status(v_res_pending, 'cancelled');
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 6q FAILED: completed reservation must not change status';

  UPDATE public.reservations SET notes = 'Tampered after completion' WHERE id = v_res_pending;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ASSERT v_count = 0, 'TEST 6r FAILED: completed reservation must not be updatable via RLS';

  -- Draft deletion by owner succeeds, completed deletion fails
  DELETE FROM public.reservations WHERE id = v_res_pending;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ASSERT v_count = 0, 'TEST 6s FAILED: completed reservation must not be deletable';

  INSERT INTO public.reservations (
    agency_id, reference_code, vehicle_id, customer_id, status,
    pickup_at, return_at, daily_rate_minor, subtotal_minor, tax_minor, discount_minor, total_minor, created_by
  )
  VALUES (
    v_agency_a, 'RES-2026-DRAFT', v_vehicle_a2, v_customer_a, 'draft',
    '2026-12-25 10:00+01', '2026-12-26 10:00+01', 130000, 130000, 24700, 0, 154700, v_owner_a
  )
  RETURNING id INTO v_res_draft;

  DELETE FROM public.reservations WHERE id = v_res_draft;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  ASSERT v_count = 1, 'TEST 6t FAILED: owner should be able to delete draft reservation';

  -- ===========================================================================
  -- TEST 7: Suspended member immediately loses access
  -- ===========================================================================
  UPDATE public.agency_memberships
     SET status = 'suspended'
   WHERE agency_id = v_agency_a AND user_id = v_agent_a;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_agent_a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.vehicles WHERE agency_id = v_agency_a;
  ASSERT v_count = 0, 'TEST 7 FAILED: suspended member must not see agency vehicles';

  -- ===========================================================================
  -- TEST 8: Audit log security (no client fabrication, transactional server trail, immutable)
  -- ===========================================================================
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);

  -- Direct client INSERT into audit_logs must be denied even for active owner
  v_failed := false;
  BEGIN
    INSERT INTO public.audit_logs (agency_id, actor_user_id, action, entity_type, metadata)
    VALUES (v_agency_a, v_owner_a, 'fake.event', 'agencies', '{"forged":true}'::jsonb);
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 8a FAILED: authenticated client must not insert directly into audit_logs';

  -- Server-generated transactional audit trail exists and is readable by Owner & Manager
  SELECT count(DISTINCT action) INTO v_count
    FROM public.audit_logs
   WHERE agency_id = v_agency_a
     AND action IN ('agency.created', 'vehicle.created', 'reservation.created', 'reservation.status_changed', 'membership.updated');
  ASSERT v_count = 5, 'TEST 8b FAILED: expected all 5 distinct transactional server-generated audit action types for Agency A';

  SELECT id INTO v_audit_id FROM public.audit_logs WHERE agency_id = v_agency_a LIMIT 1;

  -- Manager A can read audit_logs
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_manager_a, 'role', 'authenticated')::text, true);
  SELECT count(*) INTO v_count FROM public.audit_logs WHERE agency_id = v_agency_a;
  ASSERT v_count >= 5, 'TEST 8c FAILED: Manager must be able to read agency audit_logs';

  -- Audit log DELETE denied for authenticated
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner_a, 'role', 'authenticated')::text, true);
  v_failed := false;
  BEGIN
    DELETE FROM public.audit_logs WHERE id = v_audit_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 8d FAILED: audit_logs DELETE must be denied';

  -- Verify immutability trigger even as privileged role
  EXECUTE 'RESET ROLE';
  v_failed := false;
  BEGIN
    UPDATE public.audit_logs SET action = 'tampered' WHERE id = v_audit_id;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 8e FAILED: audit_logs immutability trigger must block UPDATE';

  -- ===========================================================================
  -- TEST 9: Last active owner protection & immutable creation attribution
  -- ===========================================================================
  v_failed := false;
  BEGIN
    UPDATE public.agency_memberships
       SET role = 'manager'
     WHERE agency_id = v_agency_a AND user_id = v_owner_a;
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 9a FAILED: demoting the last active owner must raise exception';

  v_failed := false;
  BEGIN
    DELETE FROM public.agency_memberships
     WHERE agency_id = v_agency_a AND user_id = v_owner_a;
  EXCEPTION WHEN raise_exception THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 9b FAILED: deleting the last active owner must raise exception';

  -- When a second active owner exists, demoting one succeeds while the remaining one stays protected
  INSERT INTO public.agency_memberships (agency_id, user_id, role, status, invited_by)
  VALUES (v_agency_a, v_owner_a2, 'owner', 'active', v_owner_a);

  UPDATE public.agency_memberships
     SET role = 'manager'
   WHERE agency_id = v_agency_a AND user_id = v_owner_a2;

  -- Immutable created_by on agencies blocked by trigger
  v_failed := false;
  BEGIN
    UPDATE public.agencies SET created_by = v_owner_b WHERE id = v_agency_a;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 9c FAILED: modifying created_by on agencies must be blocked';

  -- Completed reservation trigger blocks UPDATE even as privileged role
  v_failed := false;
  BEGIN
    UPDATE public.reservations SET notes = 'Admin tamper' WHERE id = v_res_pending;
  EXCEPTION WHEN insufficient_privilege THEN
    v_failed := true;
  END;
  ASSERT v_failed, 'TEST 9d FAILED: guard_reservation_integrity must freeze completed reservations even for privileged roles';

  RAISE NOTICE 'ALL KIRALIS PHASE 3 HARDENED RLS & INTEGRITY TESTS PASSED.';
END
$$;

ROLLBACK;
