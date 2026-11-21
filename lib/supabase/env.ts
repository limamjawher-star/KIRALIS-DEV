/**
 * Supabase environment configuration (new publishable API key format)
 * and validated application origin helpers for KIRALIS.
 *
 * Ordinary agency operations use Supabase Auth, the publishable key,
 * user-scoped requests, and PostgreSQL Row Level Security (no service-role key).
 */

export const REQUIRED_SUPABASE_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
] as const;

export interface SupabasePublicEnv {
  url: string;
  publishableKey: string;
}

type EnvRecord = Readonly<Record<string, string | undefined>>;

function isSecretSupabaseKey(value: string): boolean {
  return value.startsWith('sb_secret_');
}

/**
 * Validates and normalizes an http/https origin string.
 * Rejects non-HTTP(S) schemes and URLs containing embedded credentials.
 */
export function parseValidOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return null;
    }
    if (parsed.username || parsed.password) {
      return null;
    }
    if (!parsed.hostname) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Reads and validates the only two required Supabase variables:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
 */
export function getSupabaseEnv(env: EnvRecord = process.env): SupabasePublicEnv {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const rawKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  const normalizedOrigin = parseValidOrigin(rawUrl);
  if (!normalizedOrigin) {
    throw new Error(
      'Missing or invalid NEXT_PUBLIC_SUPABASE_URL. Expected a valid http(s) Supabase project URL.'
    );
  }

  if (!rawKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Configure your Supabase publishable key.'
    );
  }

  if (isSecretSupabaseKey(rawKey)) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: a Supabase secret key (sb_secret_*) must never be used in a public variable.'
    );
  }

  return {
    url: normalizedOrigin,
    publishableKey: rawKey,
  };
}

/**
 * Returns the validated public Supabase URL and publishable key, or null when missing/invalid.
 * Always rejects secret keys (sb_secret_*). Safe for passing from Server Components to browser clients.
 */
export function getOptionalSupabaseEnv(
  env: EnvRecord = process.env
): SupabasePublicEnv | null {
  try {
    return getSupabaseEnv(env);
  } catch {
    return null;
  }
}

/**
 * Non-throwing check used to guard optional UI/server flows before Supabase is configured.
 */
export function hasSupabaseEnv(env: EnvRecord = process.env): boolean {
  return getOptionalSupabaseEnv(env) !== null;
}

export interface ResolveOriginOptions {
  /** Explicitly configured canonical production URL (e.g. NEXT_PUBLIC_APP_URL or APP_URL). */
  configuredUrl?: string | null;
  /** Runtime request or browser origin (e.g. from request headers or window.location.origin). */
  requestOrigin?: string | null;
  /** Safe development fallback when neither canonical URL nor request origin is present. */
  fallbackOrigin?: string;
}

const DEFAULT_DEV_ORIGIN = 'http://localhost:3000';

/**
 * Resolves the application origin without requiring NEXT_PUBLIC_APP_URL in development preview.
 * Priority:
 * 1. Explicitly configured canonical URL (for production redirects)
 * 2. Validated runtime request / browser origin
 * 3. Safe local development fallback (http://localhost:3000)
 */
export function resolveApplicationOrigin(
  options: ResolveOriginOptions = {}
): string {
  const configured = parseValidOrigin(options.configuredUrl);
  if (configured) {
    return configured;
  }

  const runtime = parseValidOrigin(options.requestOrigin);
  if (runtime) {
    return runtime;
  }

  const fallback = parseValidOrigin(options.fallbackOrigin ?? DEFAULT_DEV_ORIGIN);
  return fallback ?? DEFAULT_DEV_ORIGIN;
}

/**
 * Builds a safe absolute redirect URL anchored to the validated application origin.
 * Prevents open redirects via protocol-relative paths or external URLs.
 */
export function buildApplicationRedirectUrl(
  relativePath: string,
  options: ResolveOriginOptions = {}
): string {
  const origin = resolveApplicationOrigin(options);
  const trimmed = relativePath.trim();

  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\')
  ) {
    throw new Error(
      'Redirect path must be an internal relative path starting with a single "/".'
    );
  }

  return new URL(trimmed, origin).toString();
}
