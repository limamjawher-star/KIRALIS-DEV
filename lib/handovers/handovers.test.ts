import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  eligibleHandover,isMissingInspectionTable,validateHandoverDraft,
} from './domain';

const valid = {
  reservationId:'11111111-1111-4111-8111-111111111111',
  kind:'pickup',
  odometerKm:7500,
  fuelPercent:65,
  exteriorCondition:'good',
  interiorCondition:'minor_wear',
  damageNotes:'',
  notes:'Clean',
  keysCount:2,
  documentsPresent:true,
  attested:true,
};

test('Pickup/return fields are strictly validated and correctly typed',()=>{
  const checked=validateHandoverDraft(valid);
  assert.equal(checked.ok,true);
  if(checked.ok){
    assert.equal(checked.draft.odometerKm,7500);
    assert.equal(checked.draft.documentsPresent,true);
  }
  for(const input of [
    {...valid,agency_id:'other-agency'},
    {...valid,recorded_by:'fake actor'},
    {...valid,created_at:'yesterday'},
    {...valid,attested:false},
    {...valid,attested:'true'},
    {...valid,fuelPercent:101},
    {...valid,fuelPercent:-1},
    {...valid,odometerKm:1.5},
    {...valid,keysCount:11},
    {...valid,reservationId:'fake'},
    {...valid,kind:'return',notes:'x'.repeat(1001)},
  ])assert.equal(validateHandoverDraft(input).ok,false);
});

test('Damage requires an informative written description',()=>{
  assert.equal(validateHandoverDraft({...valid,exteriorCondition:'damage'}).ok,false);
  assert.equal(validateHandoverDraft({...valid,interiorCondition:'damage',damageNotes:'  '}).ok,false);
  assert.equal(validateHandoverDraft({...valid,interiorCondition:'damage',damageNotes:'Scratches on rear bumper'}).ok,true);
});

test('Inspection status machine prevents premature or repeated checks',()=>{
  assert.equal(eligibleHandover('pending','pickup',false,false),false);
  assert.equal(eligibleHandover('confirmed','pickup',false,false),true);
  assert.equal(eligibleHandover('active','pickup',false,false),true);
  assert.equal(eligibleHandover('active','pickup',true,false),false);
  assert.equal(eligibleHandover('confirmed','return',true,false),false);
  assert.equal(eligibleHandover('active','return',false,false),false);
  assert.equal(eligibleHandover('completed','return',true,false),true);
  assert.equal(eligibleHandover('completed','return',true,true),false);
  assert.equal(eligibleHandover('cancelled','return',true,false),false);
});

test('Handover table absence is detected without treating arbitrary failures as migration absence',()=>{
  assert.equal(isMissingInspectionTable({code:'42P01'}),true);
  assert.equal(isMissingInspectionTable({code:'PGRST205'}),true);
  assert.equal(isMissingInspectionTable({code:'42501'}),false);
});

const read=(p:string)=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
test('Migration enforces composite tenant boundary, staff actor and append-only grants',()=>{
  const sql=read('supabase/migrations/202611210011_vehicle_handover_inspections.sql');
  assert.match(sql,/FOREIGN KEY \(agency_id,reservation_id\)/);
  assert.match(sql,/UNIQUE \(agency_id,reservation_id,inspection_kind\)/);
  assert.match(sql,/FORCE ROW LEVEL SECURITY/);
  assert.match(sql,/GRANT INSERT \(/);
  assert.match(sql,/REVOKE ALL ON TABLE public\.vehicle_handover_inspections/);
  assert.doesNotMatch(sql,/GRANT (?:UPDATE|DELETE)/i);
  assert.match(sql,/public\.is_active_agency_member\(NEW\.agency_id\)/);
  assert.match(sql,/recorded_by=\(SELECT auth\.uid\(\)\)/);
  assert.match(sql,/return inspection requires active or completed/i);
  assert.match(sql,/handover\.inspection_recorded/);
  assert.match(sql,/FOR SHARE/);
});

test('API derives tenant and staff from active authenticated membership',()=>{
  const api=read('app/api/handovers/route.ts');
  assert.match(api,/resolveAuthenticatedAgencyForApi/);
  assert.match(api,/isTrustedOriginRequest/);
  assert.match(api,/validateHandoverDraft/);
  assert.match(api,/agency_id:ctx\.activeAgency\.id/);
  assert.match(api,/recorded_by:ctx\.user\.id/);
  assert.match(api,/isMissingInspectionTable/);
  assert.match(api,/return mileage is below pickup mileage/i);
  assert.doesNotMatch(api,/service_role/);
});

test('Printable preparation sheet requires verified agency, same-tenant rental and rejects unsigned previews',()=>{
  const page=read('app/contracts/preview/[reservationId]/page.tsx');
  const view=read('components/contracts/rental-agreement-preview.tsx');
  assert.match(page,/requireActiveAgencyContext/);
  assert.match(page,/isValidUuid/);
  assert.match(page,/\.eq\('agency_id',activeAgency\.id\)/);
  assert.match(page,/\['confirmed','active','completed'\]/);
  assert.match(view,/window\.print\(\)/);
  assert.match(view,/non-binding|non-binding|non contractuel|Non-binding|Non-binding/);
  assert.doesNotMatch(view,/DEMO_COMPONENTS|Math\.random/);
});

test('The inspection UI has no fake customer signature or insecure public file upload',()=>{
  const view=read('components/contracts/handover-workspace.tsx');
  const page=read('app/contracts/page.tsx');
  const sql=read('supabase/tests/verify_0011_vehicle_handover_readonly.sql');
  assert.match(view,/staff attestation/i);
  assert.match(view,/photoWarning/);
  assert.doesNotMatch(view,/upload\(|getPublicUrl\(|customerSignature\s*:/);
  assert.match(page,/listAgencyHandovers/);
  assert.match(sql,/no_public_trigger_rpc/);
});
