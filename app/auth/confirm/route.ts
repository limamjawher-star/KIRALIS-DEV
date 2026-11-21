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
 * Official Supabase Auth email confirmation endpoint for custom email templates:
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email
 * {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get('token_hash');
  const rawType = searchParams.get('type') as EmailOtpType | null;
  const nextRaw = searchParams.get('next');
  const isRecovery = rawType === 'recovery';

  if (!hasSupabaseEnv(process.env)) {
    return redirectNoStore(new URL('/login?error=config_missing', origin));
  }

  if (!tokenHash || !rawType || !ALLOWED_OTP_TYPES.has(rawType)) {
    const errorTarget = isRecovery
      ? '/forgot-password?error=recovery_link_invalid'
      : '/login?error=verification_link_invalid';
    return redirectNoStore(new URL(errorTarget, origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({
    type: rawType,
    token_hash: tokenHash,
  });

  if (error) {
    const errorTarget = isRecovery
      ? '/forgot-password?error=recovery_link_invalid'
      : '/login?error=verification_link_invalid';
    return redirectNoStore(new URL(errorTarget, origin));
  }

  const destination = isRecovery
    ? '/reset-password'
    : sanitizeNextRedirectPath(nextRaw, '/');

  return redirectNoStore(new URL(destination, origin));
}
