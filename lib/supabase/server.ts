import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabaseEnv, hasSupabaseEnv } from './env';

/**
 * Official @supabase/ssr server client for Next.js 15 App Router
 * (Server Components, Route Handlers, Server Actions).
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY exclusively.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, publishableKey } = getSupabaseEnv(process.env);
  const cookieStore = await cookies();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where mutating response cookies is disallowed.
          // Session refresh is handled by middleware.ts before Server Component rendering.
        }
      },
    },
  });
}

export interface ServerAuthState {
  configured: boolean;
  user: User | null;
  error: string | null;
}

/**
 * Verifies the current user's identity on the server via supabase.auth.getUser()
 * (validates JWT with Supabase Auth rather than trusting getSession() user data).
 */
export async function getAuthenticatedUser(): Promise<ServerAuthState> {
  if (!hasSupabaseEnv(process.env)) {
    return {
      configured: false,
      user: null,
      error: 'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
    };
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      return {
        configured: true,
        user: null,
        error: error.message,
      };
    }

    return {
      configured: true,
      user: data.user ?? null,
      error: null,
    };
  } catch (err) {
    return {
      configured: true,
      user: null,
      error: err instanceof Error ? err.message : 'Unable to verify authenticated user.',
    };
  }
}
