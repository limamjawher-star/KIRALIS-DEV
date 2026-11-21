'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv, hasSupabaseEnv, type SupabasePublicEnv } from './env';

let browserClient: SupabaseClient | null = null;
let browserClientSignature: string | null = null;

function getPublicBrowserEnvRecord(
  override?: SupabasePublicEnv | null
): Readonly<Record<string, string | undefined>> {
  return {
    NEXT_PUBLIC_SUPABASE_URL:
      override?.url ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      override?.publishableKey ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseBrowserConfigured(
  override?: SupabasePublicEnv | null
): boolean {
  return hasSupabaseEnv(getPublicBrowserEnvRecord(override));
}

/**
 * Official @supabase/ssr browser client using NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY exclusively.
 * Accepts server-resolved public config so runtime-injected secrets work
 * seamlessly even when client bundles are built ahead of container startup.
 */
export function createSupabaseBrowserClient(
  override?: SupabasePublicEnv | null
): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseBrowserClient() can only be called in the browser.');
  }

  const { url, publishableKey } = getSupabaseEnv(
    getPublicBrowserEnvRecord(override)
  );
  const signature = `${url}|${publishableKey}`;

  if (!browserClient || browserClientSignature !== signature) {
    browserClient = createBrowserClient(url, publishableKey);
    browserClientSignature = signature;
  }

  return browserClient;
}
