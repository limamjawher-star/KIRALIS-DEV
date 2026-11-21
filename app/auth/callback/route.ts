import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import {
  NO_STORE_CACHE_HEADERS,
  sanitizeNextRedirectPath,
} from '@/lib/auth/validation';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  'signup',
  'email',
  'recovery',
  'email_change',
]);

function redirectNoStore(target: URL): NextResponse {
  return NextResponse.redirect(target, {
    headers: NO_STORE_CACHE_HEADERS,
  });
}

/**
 * Supabase Auth callback Route Handler supporting:
 * - PKCE code exchange (?code=...)
 * - Email verification / password recovery token_hash (?token_hash=...&type=...)
 * Validates the `next` destination to prevent open redirects.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type') as EmailOtpType | null;
  const nextRaw = searchParams.get('next');
  const isRecoveryFlow = rawType === 'recovery' || nextRaw === '/reset-password';

  if (!hasSupabaseEnv(process.env)) {
    return redirectNoStore(new URL('/login?error=config_missing', origin));
  }

  const safeNext = isRecoveryFlow
    ? '/reset-password'
    : sanitizeNextRedirectPath(nextRaw, '/');

  const supabase = await createSupabaseServerClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return redirectNoStore(new URL(safeNext, origin));
    }

    const fallbackUrl = isRecoveryFlow
      ? new URL('/forgot-password?error=recovery_link_invalid', origin)
      : new URL('/login?error=auth_callback_error', origin);
    return redirectNoStore(fallbackUrl);
  }

  if (tokenHash && rawType && ALLOWED_OTP_TYPES.has(rawType)) {
    const { error } = await supabase.auth.verifyOtp({
      type: rawType,
      token_hash: tokenHash,
    });

    if (!error) {
      return redirectNoStore(new URL(safeNext, origin));
    }

    const fallbackUrl = isRecoveryFlow
      ? new URL('/forgot-password?error=recovery_link_invalid', origin)
      : new URL('/login?error=auth_callback_error', origin);
    return redirectNoStore(fallbackUrl);
  }

  const fallbackUrl = isRecoveryFlow
    ? new URL('/forgot-password?error=recovery_link_invalid', origin)
    : new URL('/login?error=auth_callback_error', origin);
  return redirectNoStore(fallbackUrl);
}
