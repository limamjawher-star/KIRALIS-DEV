import { createSupabaseClient } from './client';
import { getSupabaseEnv, parseValidOrigin } from './env';

export const EXPECTED_PHASE3_TABLES = [
  'agencies',
  'agency_memberships',
  'vehicles',
  'customers',
  'reservations',
  'audit_logs',
] as const;

export type ExpectedTableName = (typeof EXPECTED_PHASE3_TABLES)[number];

export type TableProbeStatus =
  | 'missing'
  | 'exists_anon_blocked'
  | 'exists_anon_empty'
  | 'exists_anon_exposed'
  | 'error';

export interface TableProbeResult {
  table: ExpectedTableName;
  status: TableProbeStatus;
  httpStatus: number | null;
  errorCode: string | null;
  detail: string;
}

export interface EnvValidationSummary {
  urlPresent: boolean;
  urlValid: boolean;
  keyPresent: boolean;
  keyFormat: 'publishable' | 'legacy_jwt' | 'forbidden_secret' | 'unknown' | 'missing';
  valid: boolean;
  error: string | null;
}

export interface SupabaseVerificationReport {
  env: EnvValidationSummary;
  connection: {
    attempted: boolean;
    reachable: boolean;
    authEndpointStatus: number | null;
    error: string | null;
  };
  tables: TableProbeResult[];
  migrations: {
    migration0001LikelyApplied: boolean | null;
    migration0002AnonLockdownObserved: boolean | null;
    note: string;
  };
  rlsVerificationStatus: 'not_verified_from_publishable_client';
}

type EnvRecord = Readonly<Record<string, string | undefined>>;

/**
 * Validates required Supabase env vars without ever returning or logging their values.
 */
export function inspectSupabaseEnv(env: EnvRecord = process.env): EnvValidationSummary {
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const rawKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  const urlPresent = rawUrl.length > 0;
  const urlValid = parseValidOrigin(rawUrl) !== null;
  const keyPresent = rawKey.length > 0;

  let keyFormat: EnvValidationSummary['keyFormat'] = 'missing';
  if (keyPresent) {
    if (rawKey.startsWith('sb_publishable_')) {
      keyFormat = 'publishable';
    } else if (rawKey.startsWith('sb_secret_')) {
      keyFormat = 'forbidden_secret';
    } else if (rawKey.startsWith('eyJ')) {
      keyFormat = 'legacy_jwt';
    } else {
      keyFormat = 'unknown';
    }
  }

  try {
    getSupabaseEnv(env);
    return {
      urlPresent,
      urlValid,
      keyPresent,
      keyFormat,
      valid: true,
      error: null,
    };
  } catch (err) {
    return {
      urlPresent,
      urlValid,
      keyPresent,
      keyFormat,
      valid: false,
      error: err instanceof Error ? err.message : 'Invalid Supabase environment configuration.',
    };
  }
}

/**
 * Interprets a read-only PostgREST HEAD probe response against an expected table.
 */
export function classifyTableProbe(input: {
  table: ExpectedTableName;
  httpStatus: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  count: number | null;
}): TableProbeResult {
  const { table, httpStatus, errorCode, errorMessage, count } = input;

  if (
    errorCode === 'PGRST205' ||
    errorCode === '42P01' ||
    (errorMessage && /could not find the table|does not exist/i.test(errorMessage))
  ) {
    return {
      table,
      status: 'missing',
      httpStatus,
      errorCode,
      detail: 'Table not found in Supabase schema cache (migration 0001 not applied).',
    };
  }

  if (
    errorCode === '42501' ||
    httpStatus === 401 ||
    httpStatus === 403 ||
    (errorMessage && /permission denied/i.test(errorMessage))
  ) {
    return {
      table,
      status: 'exists_anon_blocked',
      httpStatus,
      errorCode,
      detail: 'Table exists and anonymous access is rejected.',
    };
  }

  if (!errorCode && httpStatus !== null && httpStatus >= 200 && httpStatus < 300) {
    if ((count ?? 0) > 0) {
      return {
        table,
        status: 'exists_anon_exposed',
        httpStatus,
        errorCode: null,
        detail: 'WARNING: Anonymous query returned rows — review RLS and anon grants immediately.',
      };
    }

    return {
      table,
      status: 'exists_anon_empty',
      httpStatus,
      errorCode: null,
      detail:
        'Table exists and returned 0 rows to anon (anon SELECT grant still present; check migration 0002 REVOKE/RLS).',
    };
  }

  return {
    table,
    status: 'error',
    httpStatus,
    errorCode,
    detail: errorMessage ?? 'Unexpected response while probing table.',
  };
}

/**
 * Performs a safe, read-only, non-destructive verification of Supabase connectivity
 * and expected Phase 3 tables using ONLY the publishable key.
 */
export async function verifySupabaseConnection(
  env: EnvRecord = process.env
): Promise<SupabaseVerificationReport> {
  const envSummary = inspectSupabaseEnv(env);

  if (!envSummary.valid) {
    return {
      env: envSummary,
      connection: {
        attempted: false,
        reachable: false,
        authEndpointStatus: null,
        error: envSummary.error,
      },
      tables: [],
      migrations: {
        migration0001LikelyApplied: null,
        migration0002AnonLockdownObserved: null,
        note: 'Unable to probe tables because Supabase environment variables are not configured in this runtime.',
      },
      rlsVerificationStatus: 'not_verified_from_publishable_client',
    };
  }

  const { url, publishableKey } = getSupabaseEnv(env);
  let authEndpointStatus: number | null = null;
  let reachable = false;
  let connectionError: string | null = null;

  // 1. Safe non-destructive connectivity check via Supabase Auth settings endpoint
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: publishableKey,
      },
      cache: 'no-store',
    });
    authEndpointStatus = response.status;
    reachable = response.ok;
    if (!response.ok) {
      connectionError = `Supabase Auth endpoint responded with HTTP ${response.status}.`;
    }
  } catch (err) {
    connectionError =
      err instanceof Error ? err.message : 'Network error connecting to Supabase.';
  }

  if (!reachable) {
    return {
      env: envSummary,
      connection: {
        attempted: true,
        reachable: false,
        authEndpointStatus,
        error: connectionError,
      },
      tables: [],
      migrations: {
        migration0001LikelyApplied: null,
        migration0002AnonLockdownObserved: null,
        note: 'Database tables were not probed because the Supabase project could not be reached.',
      },
      rlsVerificationStatus: 'not_verified_from_publishable_client',
    };
  }

  // 2. Safe read-only HEAD probe on each expected Phase 3 table using @supabase/supabase-js
  const supabase = createSupabaseClient(env);
  const tables: TableProbeResult[] = [];

  for (const table of EXPECTED_PHASE3_TABLES) {
    try {
      const { count, error, status } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true });

      tables.push(
        classifyTableProbe({
          table,
          httpStatus: status ?? null,
          errorCode: error?.code ?? null,
          errorMessage: error?.message ?? null,
          count: count ?? null,
        })
      );
    } catch (err) {
      tables.push({
        table,
        status: 'error',
        httpStatus: null,
        errorCode: null,
        detail: err instanceof Error ? err.message : 'Unexpected client error.',
      });
    }
  }

  const allExist = tables.every(
    (t) =>
      t.status === 'exists_anon_blocked' ||
      t.status === 'exists_anon_empty' ||
      t.status === 'exists_anon_exposed'
  );
  const allAnonBlocked = tables.every((t) => t.status === 'exists_anon_blocked');
  const anyMissing = tables.some((t) => t.status === 'missing');

  return {
    env: envSummary,
    connection: {
      attempted: true,
      reachable: true,
      authEndpointStatus,
      error: null,
    },
    tables,
    migrations: {
      migration0001LikelyApplied: anyMissing ? false : allExist,
      migration0002AnonLockdownObserved: allExist ? allAnonBlocked : false,
      note:
        'A publishable-key probe can detect missing tables and anon rejection, but cannot prove authenticated multi-tenant RLS policies or triggers; execute supabase/tests/rls_verification.sql in Supabase to verify RLS.',
    },
    rlsVerificationStatus: 'not_verified_from_publishable_client',
  };
}
