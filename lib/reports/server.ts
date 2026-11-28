import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { ReportBookingRow } from './analytics';

/** RLS-scoped and deliberately minimal booking projection for analytics. */
export async function listAgencyReportBookings(
  agencyId: string
): Promise<{ bookings: ReportBookingRow[]; limited: boolean; error: string | null }> {
  try {
    const supabase = await createSupabaseServerClient();
    // A bounded read protects the server from unexpectedly large agency histories.
    // Report UI states explicitly when a large dataset is not exhaustive.
    const { data, error } = await supabase.from('reservations')
      .select('id, reference_code, vehicle_id, status, pickup_at, return_at, total_minor')
      .eq('agency_id', agencyId)
      .order('pickup_at', { ascending: false })
      .limit(5001);
    if (error) return { bookings: [], limited: false, error: 'Unable to load booking report data.' };
    const rows = (data ?? []) as ReportBookingRow[];
    return { bookings: rows.slice(0, 5000), limited: rows.length > 5000, error: null };
  } catch {
    return { bookings: [], limited: false, error: 'Unable to load booking report data.' };
  }
}
