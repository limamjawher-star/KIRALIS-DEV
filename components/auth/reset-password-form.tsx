'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performLogout, performPasswordUpdate } from '@/lib/auth/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { AuthAlert } from './auth-alert';

export interface ResetPasswordFormProps {
  supabaseConfigured: boolean;
  hasRecoverySession: boolean;
}

export function ResetPasswordForm({
  supabaseConfigured,
  hasRecoverySession,
}: ResetPasswordFormProps) {
  const router = useRouter();
  const [sessionReady, setSessionReady] = useState(hasRecoverySession);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!supabaseConfigured || sessionReady) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setSessionReady(true);
      }
    });

    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) {
        setSessionReady(true);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabaseConfigured, sessionReady]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabaseConfigured) {
      setErrorMessage(
        'L’authentification Supabase n’est pas configurée dans cet environnement.'
      );
      return;
    }

    if (!sessionReady) {
      setErrorMessage(
        'Aucune session de réinitialisation active n’a été détectée. Demandez un nouveau lien par e-mail.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await performPasswordUpdate(supabase.auth, {
        password,
        confirmPassword,
      });

      if (!result.ok) {
        setErrorMessage(
          result.error ??
            'Impossible de mettre à jour votre mot de passe. Veuillez réessayer.'
        );
        return;
      }

      // Sign out cleanly after password reset so the user authenticates with the new password
      await performLogout(supabase.auth);
      await fetch('/auth/signout', { method: 'POST' }).catch(() => null);

      router.replace('/login?message=password_updated');
      router.refresh();
    } catch {
      setErrorMessage(
        'Impossible de joindre le service d’authentification. Vérifiez votre connexion.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (supabaseConfigured && !sessionReady) {
    return (
      <div className="space-y-4">
        <AuthAlert variant="warning" title="Lien expiré ou session manquante">
          Ouvrez le lien reçu par e-mail depuis votre messagerie pour définir un
          nouveau mot de passe, ou demandez un nouveau lien ci-dessous.
        </AuthAlert>

        <Link
          href="/forgot-password"
          className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-medium text-white transition-colors hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {errorMessage ? (
        <AuthAlert variant="error">{errorMessage}</AuthAlert>
      ) : null}

      <FormField
        id="reset-password"
        label="Nouveau mot de passe"
        required
        helperText={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
      >
        <div className="relative">
          <input
            id="reset-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="Choisissez un nouveau mot de passe"
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(false),
              'pe-10'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={
              showPassword
                ? 'Masquer le mot de passe'
                : 'Afficher le mot de passe'
            }
            className="absolute inset-y-0 end-0 inline-flex w-10 items-center justify-center text-slate-400 transition-colors hover:text-slate-700 focus-visible:outline-none focus-visible:text-blue-700 dark:text-slate-500 dark:hover:text-slate-200 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </FormField>

      <FormField
        id="reset-confirm-password"
        label="Confirmer le nouveau mot de passe"
        required
      >
        <input
          id="reset-confirm-password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
          placeholder="Confirmez le nouveau mot de passe"
          className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
        />
      </FormField>

      <Button
        type="submit"
        variant="primary"
        disabled={submitting || !supabaseConfigured}
        className="mt-2 w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Mise à jour…</span>
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            <span>Mettre à jour le mot de passe</span>
          </>
        )}
      </Button>
    </form>
  );
}
