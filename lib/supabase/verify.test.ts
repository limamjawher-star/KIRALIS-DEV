import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyTableProbe,
  inspectSupabaseEnv,
  verifySupabaseConnection,
} from './verify';

test('inspectSupabaseEnv reports key format safely without returning secret values', () => {
  const secretValue = 'sb_publishable_DO_NOT_ECHO_VALUE';
  const summary = inspectSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: secretValue,
  });

  assert.equal(summary.valid, true);
  assert.equal(summary.urlPresent, true);
  assert.equal(summary.urlValid, true);
  assert.equal(summary.keyPresent, true);
  assert.equal(summary.keyFormat, 'publishable');
  assert.equal(JSON.stringify(summary).includes(secretValue), false);
  assert.equal(JSON.stringify(summary).includes('example-project'), false);
});

test('inspectSupabaseEnv flags missing variables and forbidden secret keys', () => {
  const missing = inspectSupabaseEnv({});
  assert.equal(missing.valid, false);
  assert.equal(missing.urlPresent, false);
  assert.equal(missing.keyPresent, false);

  const forbidden = inspectSupabaseEnv({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_forbidden',
  });
  assert.equal(forbidden.valid, false);
  assert.equal(forbidden.keyFormat, 'forbidden_secret');
});

test('classifyTableProbe accurately distinguishes missing tables, anon denial, empty anon reads, and exposure', () => {
  assert.equal(
    classifyTableProbe({
      table: 'agencies',
      httpStatus: 404,
      errorCode: 'PGRST205',
      errorMessage: "Could not find the table 'public.agencies' in the schema cache",
      count: null,
    }).status,
    'missing'
  );

  assert.equal(
    classifyTableProbe({
      table: 'vehicles',
      httpStatus: 401,
      errorCode: '42501',
      errorMessage: 'permission denied for table vehicles',
      count: null,
    }).status,
    'exists_anon_blocked'
  );

  assert.equal(
    classifyTableProbe({
      table: 'customers',
      httpStatus: 200,
      errorCode: null,
      errorMessage: null,
      count: 0,
    }).status,
    'exists_anon_empty'
  );

  assert.equal(
    classifyTableProbe({
      table: 'reservations',
      httpStatus: 200,
      errorCode: null,
      errorMessage: null,
      count: 3,
    }).status,
    'exists_anon_exposed'
  );
});

test('verifySupabaseConnection reports unconfigured env safely without throwing', async () => {
  const report = await verifySupabaseConnection({});
  assert.equal(report.env.valid, false);
  assert.equal(report.connection.attempted, false);
  assert.equal(report.connection.reachable, false);
  assert.equal(report.rlsVerificationStatus, 'not_verified_from_publishable_client');
});
