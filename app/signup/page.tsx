import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignupForm } from '@/components/auth/signup-form';
import { hasSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Créer un compte — KIRALIS',
};

export default function SignupPage() {
  const supabaseConfigured = hasSupabaseEnv(process.env);

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Inscrivez-vous avec votre adresse e-mail professionnelle pour commencer."
      supabaseConfigured={supabaseConfigured}
      footer={
        <p>
          Vous avez déjà un compte ?{' '}
          <Link
            href="/login"
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Se connecter
          </Link>
        </p>
      }
    >
      <SignupForm supabaseConfigured={supabaseConfigured} />
    </AuthShell>
  );
}
