import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),'utf8');
const sql=read('supabase/migrations/202611280001_secure_reservation_operations.sql');
const server=read('lib/reservations/server.ts');
const api=read('app/api/reservations/[id]/route.ts');

test('Migration is atomic and never deletes agency data or rewrites existing bookings',()=>{
  assert.match(sql,/BEGIN;/);
  assert.match(sql,/COMMIT;/);
  assert.doesNotMatch(sql,/\bDELETE FROM public\.|\bTRUNCATE TABLE|\bDROP TABLE/i);
  assert.match(sql,/Required|prerequisites absent/i);
});

test('No authenticated TRUNCATE, TRIGGER or REFERENCES privileges on core tables',()=>{
  assert.match(sql,/REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE/);
  for(const t of ['agencies','agency_memberships','vehicles','customers',
    'reservations','audit_logs','customer_drivers','vehicle_seasonal_rates']){
    assert.ok(sql.includes(`public.${t}`));
  }
  assert.match(sql,/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.audit_logs/);
});

test('Bookings have no direct client insert/update/delete path',()=>{
  assert.match(sql,/REVOKE UPDATE, DELETE, INSERT ON TABLE public\.reservations/);
  assert.match(sql,/DROP POLICY IF EXISTS reservations_insert_active_member/);
  assert.match(sql,/DROP POLICY IF EXISTS reservations_update_active_member/);
  assert.match(sql,/DROP POLICY IF EXISTS reservations_delete_owner_manager_draft_only/);
  assert.match(sql,/GRANT SELECT ON TABLE public\.reservations TO authenticated/);
  assert.match(server,/\.rpc\('create_agency_reservation_secure'/);
  assert.doesNotMatch(server,/\.from\('reservations'\)\s*\.insert/);
});

test('Database creation recomputes agency scoped price and generates actor/reference',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.create_agency_reservation_secure/);
  assert.match(sql,/SECURITY DEFINER SET search_path = ''/);
  assert.match(sql,/v_actor uuid := auth\.uid\(\)/);
  assert.match(sql,/public\.is_active_agency_member\(v_vehicle\.agency_id\)/);
  assert.match(sql,/v_vehicle\.currency_code <> 'TND'/);
  assert.match(sql,/v_vehicle\.status IN \('maintenance','retired'\)/);
  assert.match(sql,/kiralis_private\.standard_segment_price/);
  assert.match(sql,/FROM public\.vehicle_seasonal_rates/);
  assert.match(sql,/v_amount <> p_expected_subtotal_minor/);
  assert.match(sql,/v_vehicle\.deposit_minor <> p_expected_deposit_minor/);
  assert.match(sql,/FOREIGN KEY|public\.reservations/);
});

test('Booking status transition enforces DB roles and terminal-state rules',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.transition_reservation_status/);
  assert.match(sql,/WHERE id=p_reservation_id FOR UPDATE/);
  assert.match(sql,/public\.has_agency_role\(v_booking\.agency_id/);
  assert.match(sql,/v_booking\.status IN \('completed','cancelled'\)/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.transition_reservation_status/);
  assert.match(api,/\.rpc\('transition_reservation_status'/);
});

test('Audit is transactional with no customer documents or notes',()=>{
  assert.match(sql,/CREATE OR REPLACE FUNCTION public\.audit_booking_lifecycle/);
  assert.match(sql,/trg_reservations_audit_booking/);
  assert.match(sql,/reservation\.created/);
  assert.match(sql,/reservation\.status_changed/);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.audit_booking_lifecycle/);
  assert.doesNotMatch(sql,/jsonb_build_object\([\s\S]*?(customer_id|notes)/);
});

test('Verification SQL tests core RLS, API access and destructive permissions',()=>{
  const checks=read('supabase/tests/verify_20261128_secure_reservations_readonly.sql');
  for(const needle of ['creation_rpc_installed','transition_rpc_installed',
    'no_direct_reservation_insert','no_unsafe_client_table_privileges',
    'audit_log_not_mutable','booking_overlap_constraint','core_rls_forced']){
    assert.match(checks,new RegExp(needle));
  }
  assert.doesNotMatch(checks,/\bINSERT INTO\b|\bDROP TABLE\b/i);
});
