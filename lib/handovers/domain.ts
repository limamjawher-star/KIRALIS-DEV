export type InspectionKind = 'pickup' | 'return';
export type VehicleCondition = 'good' | 'minor_wear' | 'damage';

export interface HandoverInspection {
  id: string;
  agency_id: string;
  reservation_id: string;
  inspection_kind: InspectionKind;
  odometer_km: number;
  fuel_percent: number;
  exterior_condition: VehicleCondition;
  interior_condition: VehicleCondition;
  damage_notes: string;
  notes: string;
  keys_count: number;
  documents_present: boolean;
  staff_attested: boolean;
  recorded_by: string | null;
  created_at: string;
}

export const HANDOVER_SELECT =
  'id, agency_id, reservation_id, inspection_kind, odometer_km, fuel_percent, ' +
  'exterior_condition, interior_condition, damage_notes, notes, keys_count, ' +
  'documents_present, staff_attested, recorded_by, created_at';

export type HandoverDraft = {
  reservationId: string;
  kind: InspectionKind;
  odometerKm: number;
  fuelPercent: number;
  exteriorCondition: VehicleCondition;
  interiorCondition: VehicleCondition;
  damageNotes: string;
  notes: string;
  keysCount: number;
  documentsPresent: boolean;
  attested: true;
};

const FIELDS = [
  'reservationId','kind','odometerKm','fuelPercent','exteriorCondition',
  'interiorCondition','damageNotes','notes','keysCount','documentsPresent','attested',
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONDITIONS = new Set<VehicleCondition>(['good','minor_wear','damage']);
const KINDS = new Set<InspectionKind>(['pickup','return']);

export type ValidationResult =
  | { ok: true; draft: HandoverDraft }
  | { ok: false; error: string };

export function validateHandoverDraft(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Invalid form body.' };
  }
  const input = raw as Record<string, unknown>;
  if (Object.keys(input).length !== FIELDS.length ||
      Object.keys(input).some(key => !FIELDS.includes(key as typeof FIELDS[number]))) {
    return { ok: false, error: 'Unexpected or missing form fields.' };
  }
  if (typeof input.reservationId !== 'string' || !UUID.test(input.reservationId)) {
    return { ok: false, error: 'Invalid reservation.' };
  }
  if (typeof input.kind !== 'string' || !KINDS.has(input.kind as InspectionKind)) {
    return { ok: false, error: 'Invalid handover type.' };
  }
  const whole=(value:unknown,min:number,max:number)=>
    typeof value==='number' && Number.isSafeInteger(value) && value>=min && value<=max;
  if (!whole(input.odometerKm,0,3_000_000)) return { ok:false,error:'Invalid odometer.' };
  if (!whole(input.fuelPercent,0,100)) return { ok:false,error:'Invalid fuel percentage.' };
  if (!whole(input.keysCount,0,10)) return { ok:false,error:'Invalid key count.' };
  if (typeof input.exteriorCondition !== 'string' ||
      !CONDITIONS.has(input.exteriorCondition as VehicleCondition) ||
      typeof input.interiorCondition !== 'string' ||
      !CONDITIONS.has(input.interiorCondition as VehicleCondition)) {
    return { ok:false,error:'Invalid vehicle condition.' };
  }
  if (typeof input.damageNotes !== 'string' || input.damageNotes.length > 1200 ||
      typeof input.notes !== 'string' || input.notes.length > 1000) {
    return { ok:false,error:'Notes exceed permitted length.' };
  }
  if ((input.exteriorCondition==='damage' || input.interiorCondition==='damage') &&
      input.damageNotes.trim().length < 3) {
    return { ok:false,error:'Describe recorded damage before submitting.' };
  }
  if (typeof input.documentsPresent !== 'boolean' || input.attested !== true) {
    return { ok:false,error:'Staff attestation is required.' };
  }
  return {
    ok:true,
    draft: input as HandoverDraft,
  };
}

export function eligibleHandover(
  status: string, kind: InspectionKind, alreadyPickup: boolean, alreadyReturn: boolean
): boolean {
  if (kind === 'pickup') return !alreadyPickup && (status === 'confirmed' || status === 'active');
  return alreadyPickup && !alreadyReturn && (status === 'active' || status === 'completed');
}

export function isMissingInspectionTable(error: {code?:string;message?:string}|null):boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' ||
    /could not find the table.*vehicle_handover_inspections|relation .*vehicle_handover_inspections.*does not exist/i.test(error.message??'');
}
