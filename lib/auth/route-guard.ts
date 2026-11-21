import {
  isAuthEntryRoute,
  isPublicAuthPath,
  sanitizeNextRedirectPath,
} from './validation';

export type RouteGuardDecision =
  | { action: 'allow'; protectedRoute: boolean }
  | { action: 'redirect'; location: string; protectedRoute: boolean };

export interface RouteGuardInput {
  pathname: string;
  search?: string;
  isAuthenticated: boolean;
  isSupabaseConfigured: boolean;
  nextParam?: string | null;
}

/**
 * Pure server-side route protection decision engine shared by middleware and unit tests.
 *
 * Security invariants:
 * - Protected routes ALWAYS require a verified user (fail closed even if env config is missing).
 * - Public auth pages remain accessible when unauthenticated or when config is missing.
 * - Authenticated users visiting /login, /signup, or /forgot-password are redirected to a
 *   validated internal destination (default '/').
 */
export function evaluateAuthRouteGuard(input: RouteGuardInput): RouteGuardDecision {
  const pathname = input.pathname || '/';
  const search = input.search ?? '';
  const publicPath = isPublicAuthPath(pathname);

  if (!input.isSupabaseConfigured) {
    if (publicPath) {
      return { action: 'allow', protectedRoute: false };
    }

    const params = new URLSearchParams();
    const requestedTarget = sanitizeNextRedirectPath(`${pathname}${search}`, '');
    if (requestedTarget && requestedTarget !== '/') {
      params.set('next', requestedTarget);
    }
    const query = params.toString();

    return {
      action: 'redirect',
      location: query ? `/login?${query}` : '/login',
      protectedRoute: true,
    };
  }

  if (!input.isAuthenticated) {
    if (publicPath) {
      return { action: 'allow', protectedRoute: false };
    }

    const params = new URLSearchParams();
    const requestedTarget = sanitizeNextRedirectPath(`${pathname}${search}`, '');
    if (requestedTarget && requestedTarget !== '/') {
      params.set('next', requestedTarget);
    }
    const query = params.toString();

    return {
      action: 'redirect',
      location: query ? `/login?${query}` : '/login',
      protectedRoute: true,
    };
  }

  // Authenticated user hitting /login, /signup, or /forgot-password -> redirect to app
  if (isAuthEntryRoute(pathname)) {
    const safeTarget = sanitizeNextRedirectPath(input.nextParam, '/');
    return {
      action: 'redirect',
      location: safeTarget,
      protectedRoute: false,
    };
  }

  return {
    action: 'allow',
    protectedRoute: !publicPath,
  };
}
