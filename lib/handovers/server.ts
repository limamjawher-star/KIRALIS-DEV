import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  HANDOVER_SELECT, isMissingInspectionTable,
  type HandoverInspection,
} from './domain';

export type HandoverListResult = {
  inspections: HandoverInspection[];
  schemaReady: boolean;
  limited: boolean;
  error: string | null;
};

/** Optional migration 0011 can remain uninstalled; UI degrades read-only. */
export async function listAgencyHandovers(agencyId:string): Promise<HandoverListResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('vehicle_handover_inspections')
      .select(HANDOVER_SELECT)
      .eq('agency_id',agencyId)
      .order('created_at',{ascending:false})
      .limit(501);
    if (error && isMissingInspectionTable(error)) {
      return { inspections: [], schemaReady: false, limited: false, error: null };
    }
    if (error) return { inspections: [], schemaReady: false, limited: false,
      error: 'Handover inspection data could not be loaded.' };
    const items=(data??[]) as HandoverInspection[];
    return { inspections: items.slice(0,500), schemaReady: true,
      limited: items.length>500, error:null };
  } catch {
    return { inspections:[], schemaReady:false, limited:false,
      error:'Handover inspection data could not be loaded.' };
  }
}
