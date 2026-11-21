import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  performEmailLogin,
  performEmailRegistration,
  performLogout,
  performPasswordResetRequest,
  performPasswordUpdate,
  performResendVerificationEmail,
  type SupabaseAuthLike,
} from './actions';
import { evaluateAuthRouteGuard } from './route-guard';

function createStubAuth(
  overrides: Partial<SupabaseAuthLike> = {}
): SupabaseAuthLike {
  return {
    async signInWithPassword() {
      return {
        data: { user: { id: 'user-1', email: 'test@kiralis.test' }, session: {} },
        error: null,
      };
    },
    async signUp() {
      return {
        data: { user: { id: 'user-1', email: 'test@kiralis.test' }, session: null },
        error: null,
      };
    },
    async resend() {
      return { error: null };
    },
    async resetPasswordForEmail() {
      return { error: null };
    },
    async updateUser() {
      return {
        data: { user: { id: 'user-1', email: 'test@kiralis.test' } },
        error: null,
      };
    },
    async signOut() {
      return { error: null };
    },
    ...overrides,
  };
}

test('registration submits emailRedirectTo /auth/callback and redirects to /verify-email when confirmation is required', async () => {
  let capturedRedirect: string | undefined;
  let capturedFullName: unknown;

  const auth = createStubAuth({
    async signUp({ options }) {
      capturedRedirect = options?.emailRedirectTo;
      capturedFullName = options?.data?.full_name;
      return {
        data: { user: { id: 'u1', email: 'nouveau@kiralis.test' }, session: null },
        error: null,
      };
    },
  });

  const result = await performEmailRegistration(
    auth,
    {
      fullName: 'Youssef Ben Salem',
      email: 'Nouveau@Kiralis.Test',
      password: 'Password2026!',
      confirmPassword: 'Password2026!',
    },
    { requestOrigin: 'http://localhost:3000' }
  );

  assert.equal(result.ok, true);
  assert.equal(capturedRedirect, 'http://localhost:3000/auth/callback?next=/');
  assert.equal(capturedFullName, 'Youssef Ben Salem');
  assert.equal(result.data?.requiresEmailVerification, true);
  assert.equal(
    result.data?.redirectTo,
    '/verify-email?email=nouveau%40kiralis.test'
  );
});

test('correct login succeeds with sanitized next redirect and incorrect password is rejected cleanly', async () => {
  const okResult = await performEmailLogin(createStubAuth(), {
    email: 'owner@kiralis.test',
    password: 'Password2026!',
    next: '/vehicles?status=available',
  });
  assert.equal(okResult.ok, true);
  assert.equal(okResult.data?.redirectTo, '/vehicles?status=available');

  const openRedirectResult = await performEmailLogin(createStubAuth(), {
    email: 'owner@kiralis.test',
    password: 'Password2026!',
    next: 'https://evil.example/steal',
  });
  assert.equal(openRedirectResult.ok, true);
  assert.equal(openRedirectResult.data?.redirectTo, '/');

  const badPasswordAuth = createStubAuth({
    async signInWithPassword() {
      return {
        data: { user: null, session: null },
        error: {
          message: 'Invalid login credentials',
          code: 'invalid_credentials',
        },
      };
    },
  });

  const badResult = await performEmailLogin(badPasswordAuth, {
    email: 'owner@kiralis.test',
    password: 'WrongPassword!',
  });
  assert.equal(badResult.ok, false);
  assert.equal(badResult.error, 'Adresse e-mail ou mot de passe incorrect.');
});

test('unverified email login flags resend path and resend verification targets /auth/callback', async () => {
  const unverifiedAuth = createStubAuth({
    async signInWithPassword() {
      return {
        data: { user: null, session: null },
        error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
      };
    },
  });

  const loginRes = await performEmailLogin(unverifiedAuth, {
    email: 'pending@kiralis.test',
    password: 'Password2026!',
  });
  assert.equal(loginRes.ok, false);
  assert.equal(loginRes.data?.unverifiedEmail, true);

  let resendRedirect: string | undefined;
  const resendAuth = createStubAuth({
    async resend({ options }) {
      resendRedirect = options?.emailRedirectTo;
      return { error: null };
    },
  });

  const resendRes = await performResendVerificationEmail(
    resendAuth,
    'pending@kiralis.test',
    { configuredUrl: 'https://app.kiralis.tn' }
  );
  assert.equal(resendRes.ok, true);
  assert.equal(resendRedirect, 'https://app.kiralis.tn/auth/callback?next=/');
});

test('password reset request, password update, and logout flows work cleanly', async () => {
  let resetRedirect: string | undefined;
  let updatedPassword: string | undefined;
  let signedOut = false;

  const auth = createStubAuth({
    async resetPasswordForEmail(_email, options) {
      resetRedirect = options?.redirectTo;
      return { error: null };
    },
    async updateUser({ password }) {
      updatedPassword = password;
      return { data: { user: { id: 'u1' } }, error: null };
    },
    async signOut() {
      signedOut = true;
      return { error: null };
    },
  });

  const reqResult = await performPasswordResetRequest(
    auth,
    'owner@kiralis.test',
    { requestOrigin: 'http://localhost:3000' }
  );
  assert.equal(reqResult.ok, true);
  assert.equal(
    resetRedirect,
    'http://localhost:3000/auth/callback?next=/reset-password'
  );

  const mismatch = await performPasswordUpdate(auth, {
    password: 'NewPassword2026!',
    confirmPassword: 'OtherPassword2026!',
  });
  assert.equal(mismatch.ok, false);

  const updateResult = await performPasswordUpdate(auth, {
    password: 'NewPassword2026!',
    confirmPassword: 'NewPassword2026!',
  });
  assert.equal(updateResult.ok, true);
  assert.equal(updatedPassword, 'NewPassword2026!');

  const logoutResult = await performLogout(auth);
  assert.equal(logoutResult.ok, true);
  assert.equal(signedOut, true);
});

test('route guard enforces protected routes, redirects unauthenticated users, and fails closed when config is missing', () => {
  // Missing config must still protect private routes (fail closed) while allowing /login
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/vehicles',
      isAuthenticated: false,
      isSupabaseConfigured: false,
    }),
    {
      action: 'redirect',
      location: '/login?error=config_missing&next=%2Fvehicles',
      protectedRoute: true,
    }
  );

  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/login',
      isAuthenticated: false,
      isSupabaseConfigured: false,
    }),
    { action: 'allow', protectedRoute: false }
  );

  // Unauthenticated access to protected route redirects to /login with next param
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/reservations',
      search: '?status=pending',
      isAuthenticated: false,
      isSupabaseConfigured: true,
    }),
    {
      action: 'redirect',
      location: '/login?next=%2Freservations%3Fstatus%3Dpending',
      protectedRoute: true,
    }
  );

  // Authenticated access to protected route is allowed
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/',
      isAuthenticated: true,
      isSupabaseConfigured: true,
    }),
    { action: 'allow', protectedRoute: true }
  );

  // Authenticated user visiting /login is redirected to sanitized next target
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/login',
      isAuthenticated: true,
      isSupabaseConfigured: true,
      nextParam: '/customers',
    }),
    { action: 'redirect', location: '/customers', protectedRoute: false }
  );

  // Authenticated user visiting /login with open redirect falls back to /
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/login',
      isAuthenticated: true,
      isSupabaseConfigured: true,
      nextParam: 'https://evil.example',
    }),
    { action: 'redirect', location: '/', protectedRoute: false }
  );

  // Authenticated recovery session is allowed on /reset-password
  assert.deepEqual(
    evaluateAuthRouteGuard({
      pathname: '/reset-password',
      isAuthenticated: true,
      isSupabaseConfigured: true,
    }),
    { action: 'allow', protectedRoute: false }
  );
});

test('SSR server and middleware modules verify identity with getUser() and never trust getSession() or service_role', () => {
  const root = process.cwd();
  const middlewareSrc = fs.readFileSync(
    path.join(root, 'lib/supabase/middleware.ts'),
    'utf8'
  );
  const serverSrc = fs.readFileSync(
    path.join(root, 'lib/supabase/server.ts'),
    'utf8'
  );
  const browserSrc = fs.readFileSync(
    path.join(root, 'lib/supabase/browser.ts'),
    'utf8'
  );

  assert.match(middlewareSrc, /createServerClient/);
  assert.match(middlewareSrc, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(middlewareSrc, /supabase\.auth\.getSession\(/);
  assert.doesNotMatch(middlewareSrc, /service_role|SUPABASE_SERVICE_ROLE/i);
  assert.match(middlewareSrc, /NO_STORE_CACHE_HEADERS/);

  assert.match(serverSrc, /createServerClient/);
  assert.match(serverSrc, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(serverSrc, /supabase\.auth\.getSession\(/);
  assert.doesNotMatch(serverSrc, /service_role|SUPABASE_SERVICE_ROLE/i);

  assert.match(browserSrc, /createBrowserClient/);
  assert.doesNotMatch(browserSrc, /service_role|SUPABASE_SERVICE_ROLE/i);
});
