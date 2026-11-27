import type { NextRequest } from 'next/server';
import {
  handleGetCustomerDrivers,
  handlePostCustomerDriver,
} from '@/lib/drivers/server';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/customers/[id]/drivers
 * Reads authorized drivers for a customer strictly scoped to the authenticated
 * user's verified active agency via Supabase Auth SSR and PostgreSQL RLS.
 * Accessible to active Owners, Managers, and Agents (with verification_notes
 * withheld from read-only Agents).
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return handleGetCustomerDrivers(id);
}

/**
 * POST /api/customers/[id]/drivers
 * Registers a new authorized driver for an existing customer in the verified
 * active agency. Restricted to active Owners and Managers via server RBAC and
 * PostgreSQL RLS; always initializes verification_status='unverified' and
 * is_active=true.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  return handlePostCustomerDriver(request, id);
}
