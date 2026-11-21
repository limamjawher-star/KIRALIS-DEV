import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Mot de passe oublié — KIRALIS',
};

const ERROR_MESSAGES: Record<string, string> = {
  recovery_link_invalid:
    'Ce lien de réinitialisation est invalide ou a expiré. Veuillez saisir votre adresse e-mail pour en recevoir un nouveau.',
};

interface ForgotPasswordPageProps {
  searchParams: Promise<{
    error?: string;
  }>;
}

export default async function ForgotPasswordPage({
  searchParams,
}: ForgotPasswordPageProps) {
  const params = await searchParams;
  const supabaseConfigured = hasSupabaseEnv(process.env);
  const initialError = params.error ? ERROR_MESSAGES[params.error] ?? null : null;

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Indiquez votre adresse e-mail pour recevoir un lien de réinitialisation."
      supabaseConfigured={supabaseConfigured}
      footer={
        <p>
          Vous vous souvenez de votre mot de passe ?{' '}
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <ForgotPasswordForm
        supabaseConfigured={supabaseConfigured}
        initialError={initialError}
      />
    </AuthShell>
  );
}
