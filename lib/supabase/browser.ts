'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseEnv, hasSupabaseEnv } from './env';

let browserClient: SupabaseClient | null = null;

function getPublicBrowserEnvRecord(): Readonly<Record<string, string | undefined>> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseBrowserConfigured(): boolean {
  return hasSupabaseEnv(getPublicBrowserEnvRecord());
}

/**
 * Official @supabase/ssr browser client using NEXT_PUBLIC_SUPABASE_URL
 * and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY exclusively.
 * Persists and refreshes auth cookies automatically in sync with SSR middleware.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('createSupabaseBrowserClient() can only be called in the browser.');
  }

  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv(getPublicBrowserEnvRecord());
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
