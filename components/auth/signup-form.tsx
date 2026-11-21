'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performEmailRegistration } from '@/lib/auth/actions';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth/validation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';
import { AuthAlert } from './auth-alert';

export interface SignupFormProps {
  supabasePublicEnv: SupabasePublicEnv | null;
}

export function SignupForm({ supabasePublicEnv }: SignupFormProps) {
  const router = useRouter();
  const supabaseConfigured = Boolean(supabasePublicEnv);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!supabasePublicEnv) {
      setErrorMessage(
        'L’authentification Supabase n’est pas configurée dans cet environnement.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient(supabasePublicEnv);
      const result = await performEmailRegistration(
        supabase.auth,
        {
          fullName,
          email,
          password,
          confirmPassword,
        },
        {
          configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
          requestOrigin: window.location.origin,
        }
      );

      if (!result.ok) {
        setErrorMessage(
          result.error ??
            'Impossible de créer le compte. Veuillez vérifier vos informations.'
        );
        return;
      }

      router.replace(result.data?.redirectTo ?? '/verify-email');
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
      {errorMessage ? (
        <AuthAlert variant="error">{errorMessage}</AuthAlert>
      ) : null}

      <FormField id="signup-full-name" label="Nom complet" required>
        <input
          id="signup-full-name"
          name="fullName"
          type="text"
          autoComplete="name"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          disabled={submitting}
          placeholder="Ex. Youssef Ben Salem"
          className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
        />
      </FormField>

      <FormField id="signup-email" label="Adresse e-mail professionnelle" required>
        <input
          id="signup-email"
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

      <FormField
        id="signup-password"
        label="Mot de passe"
        required
        helperText={`Au moins ${MIN_PASSWORD_LENGTH} caractères.`}
      >
        <div className="relative">
          <input
            id="signup-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="Choisissez un mot de passe robuste"
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
        id="signup-confirm-password"
        label="Confirmer le mot de passe"
        required
      >
        <input
          id="signup-confirm-password"
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={submitting}
          placeholder="Saisissez à nouveau le mot de passe"
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
            <span>Création du compte…</span>
          </>
        ) : (
          <>
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>Créer un compte</span>
          </>
        )}
      </Button>
    </form>
  );
}
