/**
 * Pure authentication validation, route classification, open-redirect protection,
 * and French error mapping helpers for KIRALIS Phase 4A.
 */

export const PUBLIC_AUTH_ROUTES = [
  '/login',
  '/signup',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
] as const;

export const AUTH_ENTRY_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
] as const;

export const NO_STORE_CACHE_HEADERS: Readonly<Record<string, string>> = {
  'Cache-Control': 'private, no-store, no-cache, must-revalidate, max-age=0',
  Pragma: 'no-cache',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Returns true if the pathname is a public authentication page,
 * Supabase auth callback endpoint, or public health probe.
 */
export function isPublicAuthPath(pathname: string): boolean {
  const normalized = pathname.trim() || '/';

  if (
    PUBLIC_AUTH_ROUTES.some(
      (route) => normalized === route || normalized.startsWith(`${route}/`)
    )
  ) {
    return true;
  }

  if (normalized === '/auth' || normalized.startsWith('/auth/')) {
    return true;
  }

  if (normalized === '/api/health' || normalized.startsWith('/api/health/')) {
    return true;
  }

  return false;
}

/**
 * Returns true for auth entry pages that an already-authenticated user
 * should be redirected away from (excludes /reset-password and /verify-email).
 */
export function isAuthEntryRoute(pathname: string): boolean {
  const normalized = pathname.trim() || '/';
  return AUTH_ENTRY_ROUTES.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`)
  );
}

/**
 * Validates a post-authentication redirect target and blocks open redirects
 * and redirect loops back into auth pages.
 */
export function sanitizeNextRedirectPath(
  rawNext: string | null | undefined,
  fallback = '/'
): string {
  if (!rawNext) {
    return fallback;
  }

  const trimmed = rawNext.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must be an internal single-slash relative path without backslashes or control chars
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    /[\u0000-\u001F\u007F]/.test(trimmed)
  ) {
    return fallback;
  }

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    if (parsed.origin !== 'http://localhost') {
      return fallback;
    }

    const candidatePath = parsed.pathname;
    // Prevent redirect loops into auth entry/callback routes
    if (
      isAuthEntryRoute(candidatePath) ||
      candidatePath === '/verify-email' ||
      candidatePath === '/auth' ||
      candidatePath.startsWith('/auth/')
    ) {
      return fallback;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function validateEmail(rawEmail: string): string | null {
  const email = rawEmail.trim();
  if (!email) {
    return 'Veuillez saisir votre adresse e-mail.';
  }
  if (!EMAIL_PATTERN.test(email)) {
    return 'Veuillez saisir une adresse e-mail valide.';
  }
  return null;
}

export function validatePassword(
  password: string,
  options: { requireMinimumLength?: boolean } = {}
): string | null {
  if (!password) {
    return 'Veuillez saisir un mot de passe.';
  }
  if (
    options.requireMinimumLength !== false &&
    password.length < MIN_PASSWORD_LENGTH
  ) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  return null;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string
): string | null {
  if (!confirmation) {
    return 'Veuillez confirmer votre mot de passe.';
  }
  if (password !== confirmation) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
}

/**
 * Translates Supabase Auth error codes/messages into clear French user messages
 * without exposing raw internal error traces.
 */
export function mapSupabaseAuthErrorToFrench(
  message?: string | null,
  code?: string | null
): string {
  const normalizedCode = (code ?? '').toLowerCase();
  const normalizedMsg = (message ?? '').toLowerCase();

  if (
    normalizedCode === 'invalid_credentials' ||
    normalizedMsg.includes('invalid login credentials') ||
    normalizedMsg.includes('invalid_credentials')
  ) {
    return 'Adresse e-mail ou mot de passe incorrect.';
  }

  if (
    normalizedCode === 'email_not_confirmed' ||
    normalizedMsg.includes('email not confirmed')
  ) {
    return 'Votre adresse e-mail n’est pas encore vérifiée. Consultez votre boîte de réception pour activer votre compte.';
  }

  if (
    normalizedCode === 'user_already_exists' ||
    normalizedMsg.includes('user already registered') ||
    normalizedMsg.includes('already been registered')
  ) {
    return 'Un compte existe déjà avec cette adresse e-mail.';
  }

  if (
    normalizedCode === 'weak_password' ||
    normalizedMsg.includes('password should be at least')
  ) {
    return `Le mot de passe est trop faible. Utilisez au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }

  if (
    normalizedCode === 'same_password' ||
    normalizedMsg.includes('new password should be different')
  ) {
    return 'Le nouveau mot de passe doit être différent de l’ancien.';
  }

  if (
    normalizedCode === 'over_email_send_rate_limit' ||
    normalizedCode === 'over_request_rate_limit' ||
    normalizedMsg.includes('rate limit') ||
    normalizedMsg.includes('too many requests') ||
    normalizedMsg.includes('for security purposes')
  ) {
    return 'Trop de tentatives effectuées récemment. Veuillez patienter quelques instants avant de réessayer.';
  }

  if (
    normalizedCode === 'otp_expired' ||
    normalizedMsg.includes('expired') ||
    normalizedMsg.includes('invalid token') ||
    normalizedMsg.includes('token has expired')
  ) {
    return 'Ce lien de vérification ou de réinitialisation a expiré ou n’est plus valide. Veuillez en demander un nouveau.';
  }

  if (
    normalizedMsg.includes('missing or invalid next_public_supabase') ||
    normalizedMsg.includes('missing next_public_supabase')
  ) {
    return 'L’authentification Supabase n’est pas encore configurée dans cet environnement (NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY requises).';
  }

  return 'Une erreur est survenue lors de l’authentification. Veuillez réessayer.';
}
