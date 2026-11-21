import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  REQUIRED_SUPABASE_ENV_VARS,
  buildApplicationRedirectUrl,
  getSupabaseEnv,
  hasSupabaseEnv,
  parseValidOrigin,
  resolveApplicationOrigin,
} from './env';

test('only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are required', () => {
  assert.deepEqual(REQUIRED_SUPABASE_ENV_VARS, [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  ]);

  const parsed = getSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://demo-project.supabase.co/',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_key',
  });
  assert.equal(parsed.url, 'https://demo-project.supabase.co');
  assert.equal(parsed.publishableKey, 'sb_publishable_example_key');
  assert.equal(
    hasSupabaseEnv({
      NEXT_PUBLIC_SUPABASE_URL: 'https://demo-project.supabase.co',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example_key',
    }),
    true
  );
});

test('getSupabaseEnv rejects missing vars, invalid URLs, and secret keys', () => {
  assert.throws(() => getSupabaseEnv({}), /NEXT_PUBLIC_SUPABASE_URL/);
  assert.throws(
    () =>
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'javascript:alert(1)',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_example',
      }),
    /NEXT_PUBLIC_SUPABASE_URL/
  );
  assert.throws(
    () =>
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://demo-project.supabase.co',
      }),
    /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/
  );
  assert.throws(
    () =>
      getSupabaseEnv({
        NEXT_PUBLIC_SUPABASE_URL: 'https://demo-project.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_never_expose_this',
      }),
    /secret key/
  );
});

test('resolveApplicationOrigin works in dev preview without NEXT_PUBLIC_APP_URL and supports canonical production URL', () => {
  assert.equal(
    resolveApplicationOrigin({
      configuredUrl: undefined,
      requestOrigin: 'https://preview-kiralis.vercel.app/login',
    }),
    'https://preview-kiralis.vercel.app'
  );

  assert.equal(
    resolveApplicationOrigin({
      configuredUrl: 'https://app.kiralis.tn/',
      requestOrigin: 'https://preview-kiralis.vercel.app',
    }),
    'https://app.kiralis.tn'
  );

  assert.equal(resolveApplicationOrigin({}), 'http://localhost:3000');
  assert.equal(parseValidOrigin('javascript:alert(1)'), null);
  assert.equal(parseValidOrigin('https://user:pass@evil.example'), null);
});

test('buildApplicationRedirectUrl blocks open redirects and builds clean internal URLs', () => {
  assert.equal(
    buildApplicationRedirectUrl('/auth/callback?next=/vehicles', {
      requestOrigin: 'https://preview-kiralis.vercel.app',
    }),
    'https://preview-kiralis.vercel.app/auth/callback?next=/vehicles'
  );

  assert.throws(
    () =>
      buildApplicationRedirectUrl('//evil.example/phish', {
        requestOrigin: 'https://app.kiralis.tn',
      }),
    /relative path/
  );
  assert.throws(
    () =>
      buildApplicationRedirectUrl('https://evil.example', {
        requestOrigin: 'https://app.kiralis.tn',
      }),
    /relative path/
  );
});

test('.env.example uses publishable key and omits legacy anon and service role keys', () => {
  const envExample = fs.readFileSync(
    path.join(process.cwd(), '.env.example'),
    'utf8'
  );
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_URL=$/m);
  assert.match(envExample, /^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$/m);
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(envExample, /SUPABASE_SERVICE_ROLE_KEY/);
});
