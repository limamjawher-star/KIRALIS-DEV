import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv } from './env';

/**
 * Creates a stateless user-scoped Supabase client using only the publishable API key.
 * Used by safe connectivity/schema probes and non-cookie server utilities.
 * Never uses secret or service-role keys.
 */
export function createSupabaseClient(
  env: Readonly<Record<string, string | undefined>> = process.env
): SupabaseClient {
  const { url, publishableKey } = getSupabaseEnv(env);

  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

let browserClientSingleton: SupabaseClient | null = null;

/**
 * Returns a memoized @supabase/ssr browser client configured with the public URL
 * and publishable key only, syncing auth sessions via cookies with Next.js SSR.
 */
export function getSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getSupabaseBrowserClient() can only be called in the browser.');
  }

  if (!browserClientSingleton) {
    const { url, publishableKey } = getSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    });

    browserClientSingleton = createBrowserClient(url, publishableKey);
  }

  return browserClientSingleton;
}
