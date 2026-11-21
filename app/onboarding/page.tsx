import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AgencyOnboardingForm } from '@/components/onboarding/agency-onboarding-form';
import { OnboardingShell } from '@/components/onboarding/onboarding-shell';
import { getServerAgencyContext } from '@/lib/agency/server';
import { getOptionalSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créer votre agence — KIRALIS',
};

export default async function OnboardingPage() {
  const ctx = await getServerAgencyContext();

  if (!ctx.user) {
    redirect('/login?next=%2Fonboarding');
  }

  const supabasePublicEnv = getOptionalSupabaseEnv(process.env);
  const hasExistingAgency = ctx.memberships.length > 0;

  return (
    <OnboardingShell
      userEmail={ctx.user.email ?? null}
      hasExistingAgency={hasExistingAgency}
      supabasePublicEnv={supabasePublicEnv}
    >
      <AgencyOnboardingForm
        defaultEmail={ctx.user.email ?? null}
        isFirstAgency={!hasExistingAgency}
      />
    </OnboardingShell>
  );
}
