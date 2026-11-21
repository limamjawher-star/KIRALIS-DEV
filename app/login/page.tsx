import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';
import { sanitizeNextRedirectPath } from '@/lib/auth/validation';
import { getOptionalSupabaseEnv } from '@/lib/supabase/env';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Connexion — KIRALIS',
};

const ERROR_MESSAGES: Record<string, string> = {
  auth_callback_error:
    'Le lien de connexion ou de vérification est invalide ou a expiré. Veuillez réessayer.',
  verification_link_invalid:
    'Ce lien de vérification d’e-mail est invalide ou a expiré. Demandez un nouvel e-mail.',
};

const NOTICE_MESSAGES: Record<string, string> = {
  password_updated:
    'Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.',
  signed_out: 'Vous avez été déconnecté en toute sécurité.',
};

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    error?: string;
    message?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const supabasePublicEnv = getOptionalSupabaseEnv(process.env);
  const nextPath = sanitizeNextRedirectPath(params.next, '/');
  const initialError = params.error ? ERROR_MESSAGES[params.error] ?? null : null;
  const initialNotice = params.message
    ? NOTICE_MESSAGES[params.message] ?? null
    : null;

  return (
    <AuthShell
      title="Connexion"
      subtitle="Accédez à votre espace de gestion KIRALIS."
      supabaseConfigured={Boolean(supabasePublicEnv)}
      footer={
        <p>
          Pas encore de compte ?{' '}
          <Link
            href="/signup"
            className="font-semibold text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Créer un compte
          </Link>
        </p>
      }
    >
      <LoginForm
        supabasePublicEnv={supabasePublicEnv}
        nextPath={nextPath}
        initialError={initialError}
        initialNotice={initialNotice}
      />
    </AuthShell>
  );
}
