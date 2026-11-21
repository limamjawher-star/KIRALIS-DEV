import { NextResponse } from 'next/server';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Server-side logout handler ensuring Supabase Auth session cookies are
 * invalidated and never cached.
 */
export async function POST() {
  if (!hasSupabaseEnv(process.env)) {
    return NextResponse.json(
      { ok: false, error: 'Supabase environment variables are not configured.' },
      { status: 503, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500, headers: NO_STORE_CACHE_HEADERS }
    );
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE_CACHE_HEADERS });
}
