'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performEmailLogin } from '@/lib/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';
import { AuthAlert } from './auth-alert';

export interface LoginFormProps {
  supabasePublicEnv: SupabasePublicEnv | null;
  nextPath: string;
  initialError?: string | null;
  initialNotice?: string | null;
}

export function LoginForm({
  supabasePublicEnv,
  nextPath,
  initialError,
  initialNotice,
}: LoginFormProps) {
  const router = useRouter();
  const supabaseConfigured = Boolean(supabasePublicEnv);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null
  );
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setUnverifiedEmail(null);

    if (!supabasePublicEnv) {
      setErrorMessage(
        'L’authentification Supabase n’est pas configurée dans cet environnement.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient(supabasePublicEnv);
      const result = await performEmailLogin(supabase.auth, {
        email,
        password,
        next: nextPath,
      });

      if (!result.ok) {
        setErrorMessage(
          result.error ?? 'Impossible de vous connecter. Veuillez réessayer.'
        );
        if (result.data?.unverifiedEmail) {
          setUnverifiedEmail(email.trim().toLowerCase());
        }
        return;
      }

      router.replace(result.data?.redirectTo ?? '/');
      router.refresh();
    } catch {
      setErrorMessage(
        'Impossible de joindre le service d’authentification. Vérifiez votre connexion.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {initialNotice && !errorMessage ? (
        <AuthAlert variant="success">{initialNotice}</AuthAlert>
      ) : null}

      {errorMessage ? (
        <AuthAlert variant="error">
          <p>{errorMessage}</p>
          {unverifiedEmail ? (
            <p className="mt-1.5">
              <Link
                href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                className="font-semibold underline underline-offset-2 hover:opacity-80"
              >
                Renvoyer l’e-mail de vérification
              </Link>
            </p>
          ) : null}
        </AuthAlert>
      ) : null}

      <FormField id="login-email" label="Adresse e-mail" required>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder="nom@agence.tn"
          className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
        />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="login-password"
            className="block text-sm font-medium text-slate-800 dark:text-slate-200"
          >
            Mot de passe
            <span className="ms-1 text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-blue-700 transition-colors hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            Mot de passe oublié ?
          </Link>
        </div>

        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="Votre mot de passe"
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
      </div>

      <Button
        type="submit"
        variant="primary"
        disabled={submitting || !supabaseConfigured}
        className="mt-2 w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Connexion en cours…</span>
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" aria-hidden="true" />
            <span>Se connecter</span>
          </>
        )}
      </Button>
    </form>
  );
}
