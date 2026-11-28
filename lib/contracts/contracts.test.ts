import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

function read(file: string) {
  return fs.readFileSync(path.join(process.cwd(),file),'utf8');
}

test('Contract migration 0010 is additive with composite tenant references',()=>{
  const sql=read('supabase/migrations/202611210010_rental_contract_drafts.sql');
  assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.rental_contracts/);
  assert.match(sql,/FOREIGN KEY \(agency_id,reservation_id\)/);
  assert.match(sql,/UNIQUE \(agency_id, reservation_id\)/);
  assert.match(sql,/REFERENCES public\.reservations \(agency_id,id\)/);
  assert.match(sql,/ENABLE ROW LEVEL SECURITY/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/public\.has_agency_role/);
});

test('Only Owner or Manager may draft and only confirmed/active/completed reservations qualify',()=>{
  const sql=read('supabase/migrations/202611210010_rental_contract_drafts.sql');
  const route=read('app/api/contracts/route.ts');
  assert.match(sql,/ARRAY\['owner','manager'\]::public\.agency_role\[\]/);
  assert.match(sql,/Only confirmed, active, or completed reservations/);
  assert.match(route,/\['owner','manager'\]/);
  assert.match(route,/\['confirmed','active','completed'\]/);
});

test('No direct client mutation of contract status or existing records',()=>{
  const sql=read('supabase/migrations/202611210010_rental_contract_drafts.sql');
  assert.match(sql,/REVOKE ALL ON TABLE public\.rental_contracts FROM PUBLIC, anon, authenticated/);
  assert.match(sql,/GRANT INSERT \(agency_id,reservation_id,created_by\)/);
  assert.doesNotMatch(sql,/CREATE POLICY\s+\w+\s+ON public\.rental_contracts FOR UPDATE/);
  assert.doesNotMatch(sql,/CREATE POLICY\s+\w+\s+ON public\.rental_contracts FOR DELETE/);
  assert.match(sql,/trg_audit_rental_contract_draft_creation/);
  assert.match(sql,/contract\.draft_created/);
  assert.match(sql,/SET search_path = ''/);
});

test('Contract API never accepts cross-agency, status or monetary fields from the browser',()=>{
  const route=read('app/api/contracts/route.ts');
  assert.match(route,/resolveAuthenticatedAgencyForApi/);
  assert.match(route,/isTrustedOriginRequest/);
  assert.match(route,/Object\.keys\(raw\)\.length !== 1/);
  assert.match(route,/agency_id: ctx\.activeAgency\.id/);
  assert.match(route,/created_by: ctx\.user\.id/);
  assert.match(route,/isMissingContractRegistry/);
  assert.doesNotMatch(route,/\bservice_role\b/);
});

test('Missing schema is handled gracefully without inventing persisted contracts',()=>{
  const server=read('lib/contracts/server.ts');
  const ui=read('components/contracts/contracts-workspace.tsx');
  const page=read('app/contracts/page.tsx');
  assert.match(server,/schemaReady: false/);
  assert.match(server,/rental_contracts/);
  assert.match(server,/\.eq\('agency_id', agencyId\)/);
  assert.match(ui,/!ready/);
  assert.match(ui,/role === 'owner' \|\| role === 'manager'/);
  assert.match(ui,/legalNotice/);
  assert.match(page,/requireActiveAgencyContext/);
  assert.match(page,/listAgencyContractDrafts/);
});

test('Read-only database verification checks forced RLS and least privilege',()=>{
  const sql=read('supabase/tests/verify_0010_rental_contract_drafts_readonly.sql');
  assert.match(sql,/rls_enabled_forced/);
  assert.match(sql,/no_client_update_delete/);
  assert.match(sql,/tenant_policies/);
  assert.match(sql,/trigger_helpers_not_publicly_executable/);
  assert.doesNotMatch(sql,/\b(?:INSERT INTO|UPDATE public\.|DELETE FROM public\.|DROP TABLE)\b/i);
});
