import type { Metadata } from 'next';
import { AuthShell } from '@/components/auth/auth-shell';
import { VerifyEmailCard } from '@/components/auth/verify-email-card';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Vérifier votre e-mail — KIRALIS',
};

interface VerifyEmailPageProps {
  searchParams: Promise<{
    email?: string;
  }>;
}

export default async function VerifyEmailPage({
  searchParams,
}: VerifyEmailPageProps) {
  const params = await searchParams;
  const supabaseConfigured = hasSupabaseEnv(process.env);

  return (
    <AuthShell
      title="Vérifier votre e-mail"
      subtitle="Une dernière étape avant d’accéder à votre espace KIRALIS."
      supabaseConfigured={supabaseConfigured}
    >
      <VerifyEmailCard
        supabaseConfigured={supabaseConfigured}
        initialEmail={params.email ?? null}
      />
    </AuthShell>
  );
}
