import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { evaluateAuthRouteGuard } from '@/lib/auth/route-guard';
import { NO_STORE_CACHE_HEADERS } from '@/lib/auth/validation';
import { getSupabaseEnv, hasSupabaseEnv } from './env';

function applyNoStoreHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(NO_STORE_CACHE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

function buildRedirectWithCookies(
  request: NextRequest,
  targetPath: string,
  sourceResponse: NextResponse
): NextResponse {
  const redirectUrl = new URL(targetPath, request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl);

  sourceResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return applyNoStoreHeaders(redirectResponse);
}

/**
 * Official @supabase/ssr Next.js 15 middleware session manager:
 * - Refreshes Supabase Auth tokens via cookie store
 * - Validates user identity using supabase.auth.getUser() (never trusts getSession() alone)
 * - Enforces protected route redirects (fail-closed if env config is missing)
 * - Prevents authenticated/protected responses from being publicly cached
 */
export async function updateSupabaseSession(
  request: NextRequest
): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;
  const nextParam = request.nextUrl.searchParams.get('next');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-kiralis-pathname', pathname);

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const configured = hasSupabaseEnv(process.env);
  if (!configured) {
    const decision = evaluateAuthRouteGuard({
      pathname,
      search,
      isAuthenticated: false,
      isSupabaseConfigured: false,
      nextParam,
    });

    if (decision.action === 'redirect') {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { ok: false, error: 'Configuration Supabase manquante.' },
          { status: 503, headers: NO_STORE_CACHE_HEADERS }
        );
      }
      return buildRedirectWithCookies(request, decision.location, supabaseResponse);
    }

    return applyNoStoreHeaders(supabaseResponse);
  }

  const { url, publishableKey } = getSupabaseEnv(process.env);

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always verify identity with getUser() rather than trusting getSession() user data.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const decision = evaluateAuthRouteGuard({
    pathname,
    search,
    isAuthenticated: Boolean(user),
    isSupabaseConfigured: true,
    nextParam,
  });

  if (decision.action === 'redirect') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { ok: false, error: 'Authentification requise.' },
        { status: 401, headers: NO_STORE_CACHE_HEADERS }
      );
    }
    return buildRedirectWithCookies(request, decision.location, supabaseResponse);
  }

  if (decision.protectedRoute || user) {
    applyNoStoreHeaders(supabaseResponse);
  }

  return supabaseResponse;
}
