import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import '@fontsource-variable/plus-jakarta-sans';
import '@fontsource-variable/public-sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import { AppPreferencesProvider } from '@/components/providers/app-preferences-provider';
import { AppShell } from '@/components/layout/app-shell';
import { getServerAgencyContext } from '@/lib/agency/server';
import { isOnboardingPath, toAgencySummary } from '@/lib/agency/types';
import { isPublicAuthPath } from '@/lib/auth/validation';
import { getOptionalSupabaseEnv } from '@/lib/supabase/env';
import './globals.css';

export const metadata: Metadata = {
  title: 'KIRALIS — Gestion de location de véhicules',
  description:
    'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
  openGraph: {
    title: 'KIRALIS — Gestion de location de véhicules',
    description:
      'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KIRALIS — Gestion de location de véhicules',
    description:
      'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [headerStore, agencyCtx] = await Promise.all([
    headers(),
    getServerAgencyContext(),
  ]);
  const supabasePublicEnv = getOptionalSupabaseEnv(process.env);

  const pathname = headerStore.get('x-kiralis-pathname');
  if (pathname && !isPublicAuthPath(pathname)) {
    if (!agencyCtx.user) {
      redirect('/login');
    }
    if (!isOnboardingPath(pathname) && agencyCtx.memberships.length === 0) {
      redirect('/onboarding');
    }
  }

  const agencies = agencyCtx.memberships.map(toAgencySummary);
  const activeAgency = agencyCtx.activeMembership
    ? toAgencySummary(agencyCtx.activeMembership)
    : null;

  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="min-h-screen bg-[#ECEFF4] text-slate-950 antialiased dark:bg-[#070B14] dark:text-slate-100"
      >
        <AppPreferencesProvider>
          <AppShell
            userEmail={agencyCtx.user?.email ?? null}
            supabasePublicEnv={supabasePublicEnv}
            activeAgency={activeAgency}
            agencies={agencies}
          >
            {children}
          </AppShell>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
