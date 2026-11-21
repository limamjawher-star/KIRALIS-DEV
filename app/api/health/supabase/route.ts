import { NextResponse } from 'next/server';
import { verifySupabaseConnection } from '@/lib/supabase/verify';

export const dynamic = 'force-dynamic';

/**
 * Safe, read-only Supabase connectivity & schema probe endpoint.
 * Never exposes environment variable values or secrets, and never modifies data.
 */
export async function GET() {
  const report = await verifySupabaseConnection(process.env);
  return NextResponse.json(report, {
    status: report.connection.reachable ? 200 : 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
