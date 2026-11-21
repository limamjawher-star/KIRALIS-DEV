import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAuthEntryRoute,
  isPublicAuthPath,
  mapSupabaseAuthErrorToFrench,
  NO_STORE_CACHE_HEADERS,
  sanitizeNextRedirectPath,
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
} from './validation';

test('isPublicAuthPath and isAuthEntryRoute classify public, callback, and protected routes accurately', () => {
  assert.equal(isPublicAuthPath('/login'), true);
  assert.equal(isPublicAuthPath('/signup'), true);
  assert.equal(isPublicAuthPath('/verify-email'), true);
  assert.equal(isPublicAuthPath('/forgot-password'), true);
  assert.equal(isPublicAuthPath('/reset-password'), true);
  assert.equal(isPublicAuthPath('/auth/callback'), true);
  assert.equal(isPublicAuthPath('/auth/confirm'), true);
  assert.equal(isPublicAuthPath('/api/health/supabase'), true);

  assert.equal(isPublicAuthPath('/'), false);
  assert.equal(isPublicAuthPath('/vehicles'), false);
  assert.equal(isPublicAuthPath('/reservations'), false);
  assert.equal(isPublicAuthPath('/settings'), false);

  assert.equal(isAuthEntryRoute('/login'), true);
  assert.equal(isAuthEntryRoute('/signup'), true);
  assert.equal(isAuthEntryRoute('/forgot-password'), true);
  // /reset-password and /verify-email must remain accessible even during an active recovery session
  assert.equal(isAuthEntryRoute('/reset-password'), false);
  assert.equal(isAuthEntryRoute('/verify-email'), false);
});

test('sanitizeNextRedirectPath blocks open redirects and auth loops while allowing valid internal paths', () => {
  assert.equal(sanitizeNextRedirectPath('/vehicles'), '/vehicles');
  assert.equal(
    sanitizeNextRedirectPath('/reservations?status=pending#list'),
    '/reservations?status=pending#list'
  );

  // Open redirects must fall back safely
  assert.equal(sanitizeNextRedirectPath('https://evil.example/phish'), '/');
  assert.equal(sanitizeNextRedirectPath('//evil.example/phish'), '/');
  assert.equal(sanitizeNextRedirectPath('/\\evil.example'), '/');
  assert.equal(sanitizeNextRedirectPath('javascript:alert(1)'), '/');
  assert.equal(sanitizeNextRedirectPath('/\nLocation: https://evil.example'), '/');

  // Auth loops must fall back safely
  assert.equal(sanitizeNextRedirectPath('/login'), '/');
  assert.equal(sanitizeNextRedirectPath('/signup'), '/');
  assert.equal(sanitizeNextRedirectPath('/auth/callback'), '/');
  assert.equal(sanitizeNextRedirectPath(null), '/');
});

test('email and password validators enforce French validation rules', () => {
  assert.ok(validateEmail(''));
  assert.ok(validateEmail('not-an-email'));
  assert.equal(validateEmail('agent@kiralis.tn'), null);

  assert.ok(validatePassword(''));
  assert.ok(validatePassword('short7'));
  assert.equal(validatePassword('StrongPass123'), null);
  assert.equal(validatePassword('1234', { requireMinimumLength: false }), null);

  assert.ok(validatePasswordConfirmation('StrongPass123', 'Different123'));
  assert.equal(validatePasswordConfirmation('StrongPass123', 'StrongPass123'), null);
});

test('mapSupabaseAuthErrorToFrench translates known auth failures cleanly without leaking internals', () => {
  assert.equal(
    mapSupabaseAuthErrorToFrench('Invalid login credentials', 'invalid_credentials'),
    'Adresse e-mail ou mot de passe incorrect.'
  );
  assert.match(
    mapSupabaseAuthErrorToFrench('Email not confirmed', 'email_not_confirmed'),
    /pas encore vérifiée/
  );
  assert.match(
    mapSupabaseAuthErrorToFrench('User already registered'),
    /existe déjà/
  );
  assert.match(
    mapSupabaseAuthErrorToFrench('Token has expired', 'otp_expired'),
    /expiré/
  );
  assert.match(
    mapSupabaseAuthErrorToFrench('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    /pas encore configurée/
  );
});

test('NO_STORE_CACHE_HEADERS prevent public caching of authenticated responses', () => {
  assert.match(NO_STORE_CACHE_HEADERS['Cache-Control'], /\bprivate\b/);
  assert.match(NO_STORE_CACHE_HEADERS['Cache-Control'], /\bno-store\b/);
});
