import {
  buildApplicationRedirectUrl,
  type ResolveOriginOptions,
} from '@/lib/supabase/env';
import {
  mapSupabaseAuthErrorToFrench,
  sanitizeNextRedirectPath,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './validation';

/**
 * Minimal structural subset of SupabaseClient['auth'] used by KIRALIS auth flows.
 * Enables deterministic unit testing without mocking private SDK internals.
 */
export interface SupabaseAuthLike {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data: { user: { id: string; email?: string | null } | null; session: unknown };
    error: { message: string; code?: string } | null;
  }>;
  signUp(credentials: {
    email: string;
    password: string;
    options?: {
      emailRedirectTo?: string;
      data?: Record<string, unknown>;
    };
  }): Promise<{
    data: { user: { id: string; email?: string | null } | null; session: unknown };
    error: { message: string; code?: string } | null;
  }>;
  resend(params: {
    type: 'signup';
    email: string;
    options?: { emailRedirectTo?: string };
  }): Promise<{
    error: { message: string; code?: string } | null;
  }>;
  resetPasswordForEmail(
    email: string,
    options?: { redirectTo?: string }
  ): Promise<{
    error: { message: string; code?: string } | null;
  }>;
  updateUser(attributes: { password: string }): Promise<{
    data: { user: { id: string; email?: string | null } | null };
    error: { message: string; code?: string } | null;
  }>;
  signOut(): Promise<{
    error: { message: string; code?: string } | null;
  }>;
}

export interface AuthActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  errorCode?: string;
  data?: T;
}

export async function performEmailLogin(
  auth: SupabaseAuthLike,
  input: { email: string; password: string; next?: string | null }
): Promise<AuthActionResult<{ redirectTo: string; unverifiedEmail?: boolean }>> {
  const emailError = validateEmail(input.email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const passwordError = validatePassword(input.password, {
    requireMinimumLength: false,
  });
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const { error } = await auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    const isUnverified =
      error.code?.toLowerCase() === 'email_not_confirmed' ||
      error.message.toLowerCase().includes('email not confirmed');

    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
      data: isUnverified ? { redirectTo: '/verify-email', unverifiedEmail: true } : undefined,
    };
  }

  return {
    ok: true,
    data: {
      redirectTo: sanitizeNextRedirectPath(input.next, '/'),
    },
  };
}

export async function performEmailRegistration(
  auth: SupabaseAuthLike,
  input: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
  },
  originOptions: ResolveOriginOptions
): Promise<AuthActionResult<{ requiresEmailVerification: boolean; redirectTo: string }>> {
  const cleanName = input.fullName.trim();
  if (cleanName.length < 2) {
    return {
      ok: false,
      error: 'Veuillez saisir votre nom complet (au moins 2 caractères).',
    };
  }

  const emailError = validateEmail(input.email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const passwordError = validatePassword(input.password, {
    requireMinimumLength: true,
  });
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const confirmError = validatePasswordConfirmation(
    input.password,
    input.confirmPassword
  );
  if (confirmError) {
    return { ok: false, error: confirmError };
  }

  const cleanEmail = input.email.trim().toLowerCase();
  const emailRedirectTo = buildApplicationRedirectUrl(
    '/auth/callback?next=/',
    originOptions
  );

  const { data, error } = await auth.signUp({
    email: cleanEmail,
    password: input.password,
    options: {
      emailRedirectTo,
      data: {
        full_name: cleanName,
      },
    },
  });

  if (error) {
    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
    };
  }

  const requiresEmailVerification = !data.session;
  const redirectTo = requiresEmailVerification
    ? `/verify-email?email=${encodeURIComponent(cleanEmail)}`
    : '/';

  return {
    ok: true,
    data: {
      requiresEmailVerification,
      redirectTo,
    },
  };
}

export async function performResendVerificationEmail(
  auth: SupabaseAuthLike,
  email: string,
  originOptions: ResolveOriginOptions
): Promise<AuthActionResult> {
  const emailError = validateEmail(email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const emailRedirectTo = buildApplicationRedirectUrl(
    '/auth/callback?next=/',
    originOptions
  );

  const { error } = await auth.resend({
    type: 'signup',
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo },
  });

  if (error) {
    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
    };
  }

  return { ok: true };
}

export async function performPasswordResetRequest(
  auth: SupabaseAuthLike,
  email: string,
  originOptions: ResolveOriginOptions
): Promise<AuthActionResult> {
  const emailError = validateEmail(email);
  if (emailError) {
    return { ok: false, error: emailError };
  }

  const redirectTo = buildApplicationRedirectUrl(
    '/auth/callback?next=/reset-password',
    originOptions
  );

  const { error } = await auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo }
  );

  if (error) {
    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
    };
  }

  return { ok: true };
}

export async function performPasswordUpdate(
  auth: SupabaseAuthLike,
  input: { password: string; confirmPassword: string }
): Promise<AuthActionResult> {
  const passwordError = validatePassword(input.password, {
    requireMinimumLength: true,
  });
  if (passwordError) {
    return { ok: false, error: passwordError };
  }

  const confirmError = validatePasswordConfirmation(
    input.password,
    input.confirmPassword
  );
  if (confirmError) {
    return { ok: false, error: confirmError };
  }

  const { error } = await auth.updateUser({ password: input.password });

  if (error) {
    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
    };
  }

  return { ok: true };
}

export async function performLogout(
  auth: SupabaseAuthLike
): Promise<AuthActionResult> {
  const { error } = await auth.signOut();
  if (error) {
    return {
      ok: false,
      error: mapSupabaseAuthErrorToFrench(error.message, error.code),
      errorCode: error.code,
    };
  }

  return { ok: true };
}
