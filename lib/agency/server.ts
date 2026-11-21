import { cache } from 'react';
import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ACTIVE_AGENCY_COOKIE_NAME,
  resolveSelectedMembership,
  type AgencyDashboardStats,
  type AgencyMembershipWithAgency,
  type AgencyRecord,
  type AgencyRole,
  type MembershipStatus,
} from './types';

export interface ServerAgencyContext {
  configured: boolean;
  user: User | null;
  memberships: AgencyMembershipWithAgency[];
  activeMembership: AgencyMembershipWithAgency | null;
  activeAgency: AgencyRecord | null;
  error: string | null;
}

export interface VerifiedActiveAgencyContext {
  user: User;
  memberships: AgencyMembershipWithAgency[];
  activeMembership: AgencyMembershipWithAgency;
  activeAgency: AgencyRecord;
}

interface RawMembershipRow {
  id: string;
  agency_id: string;
  role: AgencyRole;
  status: MembershipStatus;
  created_at: string;
  agency: AgencyRecord | AgencyRecord[] | null;
}

function normalizeMembershipRows(
  rows: RawMembershipRow[] | null | undefined
): AgencyMembershipWithAgency[] {
  if (!Array.isArray(rows)) {
    return [];
  }

  const normalized: AgencyMembershipWithAgency[] = [];
  for (const row of rows) {
    if (row.status !== 'active') {
      continue;
    }

    const joinedAgency = Array.isArray(row.agency) ? row.agency[0] : row.agency;
    if (!joinedAgency || !joinedAgency.id) {
      continue;
    }

    normalized.push({
      id: row.id,
      agency_id: row.agency_id,
      role: row.role,
      status: row.status,
      created_at: row.created_at,
      agency: joinedAgency,
    });
  }

  return normalized;
}

/**
 * Cookie options for persisting the user's selected active agency ID.
 * Note: The server ALWAYS re-verifies this ID against public.agency_memberships.
 */
export function getActiveAgencyCookieOptions(request?: NextRequest) {
  const forwardedProto = request?.headers.get('x-forwarded-proto');
  const isHttps =
    forwardedProto === 'https' || request?.nextUrl.protocol === 'https:';

  return {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    secure: isHttps,
    sameSite: (isHttps ? 'none' : 'lax') as 'none' | 'lax',
    ...(isHttps ? { partitioned: true } : {}),
  };
}

/**
 * Verifies same-origin requests on cookie-authenticated state-changing endpoints.
 */
export function isTrustedOriginRequest(request: NextRequest): boolean {
  const originHeader = request.headers.get('origin');
  if (!originHeader) {
    return true;
  }

  const expectedHost =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  if (!expectedHost) {
    return false;
  }

  try {
    const parsedOrigin = new URL(originHeader);
    return parsedOrigin.host.toLowerCase() === expectedHost.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Per-request cached server lookup using official @supabase/ssr + getUser().
 * Reads active memberships exclusively through RLS with the user's own JWT.
 */
export const getServerAgencyContext = cache(
  async (): Promise<ServerAgencyContext> => {
    if (!hasSupabaseEnv(process.env)) {
      return {
        configured: false,
        user: null,
        memberships: [],
        activeMembership: null,
        activeAgency: null,
        error:
          'Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.',
      };
    }

    try {
      const supabase = await createSupabaseServerClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        return {
          configured: true,
          user: null,
          memberships: [],
          activeMembership: null,
          activeAgency: null,
          error: authError?.message ?? null,
        };
      }

      const { data: rawRows, error: membershipError } = await supabase
        .from('agency_memberships')
        .select(
          `
          id,
          agency_id,
          role,
          status,
          created_at,
          agency:agencies (
            id,
            name,
            legal_name,
            slug,
            tax_id,
            email,
            phone,
            city,
            address,
            country_code,
            currency_code,
            currency_minor_unit,
            timezone,
            default_locale,
            vat_rate_bps,
            created_at,
            updated_at
          )
        `
        )
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true });

      if (membershipError) {
        return {
          configured: true,
          user,
          memberships: [],
          activeMembership: null,
          activeAgency: null,
          error: membershipError.message,
        };
      }

      const memberships = normalizeMembershipRows(
        rawRows as RawMembershipRow[] | null
      );

      const cookieStore = await cookies();
      const requestedAgencyId =
        cookieStore.get(ACTIVE_AGENCY_COOKIE_NAME)?.value ?? null;

      const activeMembership = resolveSelectedMembership(
        memberships,
        requestedAgencyId
      );

      return {
        configured: true,
        user,
        memberships,
        activeMembership,
        activeAgency: activeMembership?.agency ?? null,
        error: null,
      };
    } catch (err) {
      return {
        configured: true,
        user: null,
        memberships: [],
        activeMembership: null,
        activeAgency: null,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to load agency context.',
      };
    }
  }
);

/**
 * Enforces an authenticated user with at least one verified active agency.
 * Redirects unauthenticated callers to /login and onboard-pending users to /onboarding.
 */
export async function requireActiveAgencyContext(): Promise<VerifiedActiveAgencyContext> {
  const ctx = await getServerAgencyContext();

  if (!ctx.user) {
    redirect('/login');
  }

  if (!ctx.activeMembership || !ctx.activeAgency) {
    redirect('/onboarding');
  }

  return {
    user: ctx.user,
    memberships: ctx.memberships,
    activeMembership: ctx.activeMembership,
    activeAgency: ctx.activeAgency,
  };
}

/**
 * Reads exact, RLS-scoped counts for the active agency from Supabase.
 * Never fabricates statistics; returns 0 when the agency has no records.
 */
export async function getAgencyDashboardStats(
  agencyId: string
): Promise<AgencyDashboardStats> {
  if (!hasSupabaseEnv(process.env)) {
    return {
      vehicleCount: 0,
      customerCount: 0,
      reservationCount: 0,
      activeRentalCount: 0,
    };
  }

  try {
    const supabase = await createSupabaseServerClient();

    const [vehiclesRes, customersRes, reservationsRes, activeRentalsRes] =
      await Promise.all([
        supabase
          .from('vehicles')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId),
        supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('status', 'active'),
      ]);

    return {
      vehicleCount: vehiclesRes.count ?? 0,
      customerCount: customersRes.count ?? 0,
      reservationCount: reservationsRes.count ?? 0,
      activeRentalCount: activeRentalsRes.count ?? 0,
    };
  } catch {
    return {
      vehicleCount: 0,
      customerCount: 0,
      reservationCount: 0,
      activeRentalCount: 0,
    };
  }
}
