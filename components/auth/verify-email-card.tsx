'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performResendVerificationEmail } from '@/lib/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { cn } from '@/lib/utils';
import { AuthAlert } from './auth-alert';

export interface VerifyEmailCardProps {
  supabasePublicEnv: SupabasePublicEnv | null;
  initialEmail?: string | null;
}

export function VerifyEmailCard({
  supabasePublicEnv,
  initialEmail,
}: VerifyEmailCardProps) {
  const supabaseConfigured = Boolean(supabasePublicEnv);
  const [email, setEmail] = useState(initialEmail?.trim() ?? '');
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleResend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!supabasePublicEnv) {
      setErrorMessage(
        'L’authentification Supabase n’est pas configurée dans cet environnement.'
      );
      return;
    }

    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient(supabasePublicEnv);
      const result = await performResendVerificationEmail(
        supabase.auth,
        email,
        {
          configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
          requestOrigin: window.location.origin,
        }
      );

      if (!result.ok) {
        setErrorMessage(
          result.error ??
            'Impossible de renvoyer l’e-mail de vérification pour le moment.'
        );
        return;
      }

      setSuccessMessage(
        'Un nouvel e-mail de vérification vient d’être envoyé. Vérifiez votre boîte de réception ainsi que vos courriers indésirables.'
      );
    } catch {
      setErrorMessage(
        'Impossible de joindre le service d’authentification. Vérifiez votre connexion.'
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center text-center space-y-2.5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400">
          <MailCheck className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          Nous avons envoyé un lien de confirmation à votre adresse e-mail.
          Cliquez sur ce lien pour activer votre compte KIRALIS et accéder à
          votre espace.
        </p>
        {initialEmail ? (
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200">
            {initialEmail}
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <AuthAlert variant="error">{errorMessage}</AuthAlert>
      ) : null}

      {successMessage ? (
        <AuthAlert variant="success">{successMessage}</AuthAlert>
      ) : null}

      <form onSubmit={handleResend} noValidate className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <FormField
          id="verify-email-address"
          label="Vous n’avez rien reçu ?"
          helperText="Indiquez votre adresse e-mail pour renvoyer le lien de vérification."
        >
          <input
            id="verify-email-address"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={sending}
            placeholder="nom@agence.tn"
            className={cn(INPUT_BASE_CLASSES, getInputStateClasses(false))}
          />
        </FormField>

        <Button
          type="submit"
          variant="secondary"
          disabled={sending || !supabaseConfigured}
          className="w-full"
        >
          {sending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Envoi en cours…</span>
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Renvoyer l’e-mail de vérification</span>
            </>
          )}
        </Button>
      </form>

      <div className="pt-1 text-center">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retour à la connexion</span>
        </Link>
      </div>
    </div>
  );
}
