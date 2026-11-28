import { createSupabaseServerClient } from '@/lib/supabase/server';

export type RentalContractDraft = {
  id: string;
  agency_id: string;
  reservation_id: string;
  contract_number: string;
  status: 'draft' | 'issued' | 'signed' | 'closed' | 'void';
  template_version: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const DRAFT_CONTRACT_COLUMNS =
  'id, agency_id, reservation_id, contract_number, status, template_version, created_by, created_at, updated_at';

export type DraftListResult = {
  contracts: RentalContractDraft[];
  schemaReady: boolean;
  limited: boolean;
  error: string | null;
};

export function isMissingContractRegistry(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || error.code === 'PGRST205' ||
    /could not find the table.*rental_contracts|relation .*rental_contracts.*does not exist/i.test(error.message || '');
}

/** Safe RLS-scoped read. A missing optional migration must not break the page. */
export async function listAgencyContractDrafts(agencyId: string): Promise<DraftListResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('rental_contracts')
      .select(DRAFT_CONTRACT_COLUMNS)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(501);
    if (error && isMissingContractRegistry(error)) {
      return { contracts: [], schemaReady: false, limited: false, error: null };
    }
    if (error) return {
      contracts: [], schemaReady: false, limited: false,
      error: 'Unable to read the contract registry.',
    };
    const all = (data ?? []) as RentalContractDraft[];
    return {
      contracts: all.slice(0,500), schemaReady: true,
      limited: all.length > 500, error: null,
    };
  } catch {
    return {
      contracts: [], schemaReady: false, limited: false,
      error: 'Unable to read the contract registry.',
    };
  }
}
