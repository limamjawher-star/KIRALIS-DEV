import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getAuthenticatedUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Réinitialiser le mot de passe — KIRALIS',
};

export default async function ResetPasswordPage() {
  const authState = await getAuthenticatedUser();

  return (
    <AuthShell
      title="Réinitialiser le mot de passe"
      subtitle="Définissez un nouveau mot de passe sécurisé pour votre compte KIRALIS."
      supabaseConfigured={authState.configured}
      footer={
        <p>
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Retour à la connexion
          </Link>
        </p>
      }
    >
      <ResetPasswordForm
        supabaseConfigured={authState.configured}
        hasRecoverySession={Boolean(authState.user)}
      />
    </AuthShell>
  );
}
