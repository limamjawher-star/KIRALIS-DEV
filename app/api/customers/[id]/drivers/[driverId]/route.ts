import type { NextRequest } from 'next/server';
import { handlePatchCustomerDriver } from '@/lib/drivers/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string; driverId: string }>;
}

/**
 * PATCH /api/customers/[id]/drivers/[driverId]
 * Applies a validated partial update to an authorized driver strictly scoped
 * to the verified customer and active agency via Supabase Auth SSR and
 * PostgreSQL RLS. Restricted to active Owners and Managers.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id, driverId } = await params;
  return handlePatchCustomerDriver(request, id, driverId);
}
