import { NextResponse, type NextRequest } from 'next/server';
import { isTrustedOriginRequest } from '@/lib/agency/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { resolveAuthenticatedAgencyForApi } from '@/lib/vehicles/server';
import {
  HANDOVER_SELECT, eligibleHandover, isMissingInspectionTable, validateHandoverDraft,
} from '@/lib/handovers/domain';

export const dynamic = 'force-dynamic';

export async function GET() {
  const ctx = await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    { ok:false,error:ctx.error },{status:ctx.status,headers:NO_STORE_CACHE_HEADERS}
  );
  const {data,error}=await ctx.supabase.from('vehicle_handover_inspections')
    .select(HANDOVER_SELECT)
    .eq('agency_id',ctx.activeAgency.id)
    .order('created_at',{ascending:false}).limit(501);
  if (error && isMissingInspectionTable(error)) return NextResponse.json(
    {ok:true,inspections:[],schemaReady:false,limited:false,agencyId:ctx.activeAgency.id},
    {headers:NO_STORE_CACHE_HEADERS}
  );
  if (error) return NextResponse.json({ok:false,error:'Unable to load inspections.'},
    {status:503,headers:NO_STORE_CACHE_HEADERS});
  return NextResponse.json({
    ok:true,inspections:(data??[]).slice(0,500),
    schemaReady:true,limited:(data??[]).length>500,agencyId:ctx.activeAgency.id,
  },{headers:NO_STORE_CACHE_HEADERS});
}

export async function POST(request: NextRequest) {
  if (!isTrustedOriginRequest(request)) return NextResponse.json(
    {ok:false,error:'Untrusted origin.'},{status:403,headers:NO_STORE_CACHE_HEADERS}
  );
  const ctx=await resolveAuthenticatedAgencyForApi();
  if (!ctx.ok) return NextResponse.json(
    {ok:false,error:ctx.error},{status:ctx.status,headers:NO_STORE_CACHE_HEADERS}
  );
  // Owner, Manager, Agent may record inspections for their active agency.
  // No role, agency, staff signature, date or other privileged fields accepted.
  if (!['owner','manager','agent'].includes(ctx.activeMembership.role))
    return NextResponse.json({ok:false,error:'Active staff role required.'},
      {status:403,headers:NO_STORE_CACHE_HEADERS});

  if (Number(request.headers.get('content-length')||0)>8192)
    return NextResponse.json({ok:false,error:'Request exceeds 8 KB.'},
      {status:413,headers:NO_STORE_CACHE_HEADERS});
  let body:unknown;
  try {
    const text=await request.text();
    if (text.length>8192) return NextResponse.json({ok:false,error:'Request exceeds 8 KB.'},
      {status:413,headers:NO_STORE_CACHE_HEADERS});
    body=JSON.parse(text);
  } catch {
    return NextResponse.json({ok:false,error:'Invalid JSON body.'},
      {status:400,headers:NO_STORE_CACHE_HEADERS});
  }
  const checked=validateHandoverDraft(body);
  if(!checked.ok)return NextResponse.json({ok:false,error:checked.error},
    {status:400,headers:NO_STORE_CACHE_HEADERS});
  const draft=checked.draft;
  const {data:reservation,error:resError}=await ctx.supabase.from('reservations')
    .select('id,status,vehicle_id').eq('agency_id',ctx.activeAgency.id)
    .eq('id',draft.reservationId).maybeSingle();
  if(resError)return NextResponse.json({ok:false,error:'Unable to verify reservation.'},
    {status:503,headers:NO_STORE_CACHE_HEADERS});
  if(!reservation)return NextResponse.json({ok:false,error:'Reservation not found.'},
    {status:404,headers:NO_STORE_CACHE_HEADERS});

  const {data:prior,error:priorError}=await ctx.supabase
    .from('vehicle_handover_inspections')
    .select('inspection_kind,odometer_km')
    .eq('agency_id',ctx.activeAgency.id)
    .eq('reservation_id',draft.reservationId);
  if(priorError)return NextResponse.json({
    ok:false,error:isMissingInspectionTable(priorError)
      ? 'Handover migration 0011 has not been installed.'
      : 'Unable to check prior inspections.',
  },{status:503,headers:NO_STORE_CACHE_HEADERS});

  const pickup=prior?.find(x=>x.inspection_kind==='pickup');
  const hasReturn=prior?.some(x=>x.inspection_kind==='return')??false;
  if(!eligibleHandover(reservation.status,draft.kind,Boolean(pickup),hasReturn))
    return NextResponse.json({ok:false,error:'Inspection is not allowed for this booking status.'},
      {status:409,headers:NO_STORE_CACHE_HEADERS});
  if(draft.kind==='return' && pickup && draft.odometerKm<pickup.odometer_km)
    return NextResponse.json({ok:false,error:'Return mileage is below pickup mileage.'},
      {status:409,headers:NO_STORE_CACHE_HEADERS});

  // Never trust browser actor, tenant, vehicle, timestamps or status.
  const {data,error}=await ctx.supabase.from('vehicle_handover_inspections')
    .insert({
      agency_id:ctx.activeAgency.id,
      reservation_id:draft.reservationId,
      inspection_kind:draft.kind,
      odometer_km:draft.odometerKm,
      fuel_percent:draft.fuelPercent,
      exterior_condition:draft.exteriorCondition,
      interior_condition:draft.interiorCondition,
      damage_notes:draft.damageNotes.trim(),
      notes:draft.notes.trim(),
      keys_count:draft.keysCount,
      documents_present:draft.documentsPresent,
      staff_attested:true,
      recorded_by:ctx.user.id,
    })
    .select(HANDOVER_SELECT).single();
  if(error) {
    const status=error.code==='23505'||error.code==='23514'?409:
      error.code==='42501'?403:isMissingInspectionTable(error)?503:500;
    const errorMessage=error.code==='23505'
      ? 'An inspection of this type has already been recorded.'
      : error.code==='23514'
        ? 'Inspection details or booking state changed. Refresh and retry.'
        : error.code==='42501'
          ? 'Permission denied.'
          : isMissingInspectionTable(error)
            ? 'Handover schema is not installed yet.'
            : 'Unable to record inspection.';
    return NextResponse.json({ok:false,error:errorMessage},
      {status,headers:NO_STORE_CACHE_HEADERS});
  }
  return NextResponse.json({ok:true,inspection:data,agencyId:ctx.activeAgency.id},
    {status:201,headers:NO_STORE_CACHE_HEADERS});
}
