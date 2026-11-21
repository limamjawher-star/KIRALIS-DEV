'use client';

import React, { useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performPasswordResetRequest } from '@/lib/auth/actions';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { AuthAlert } from './auth-alert';

export interface ForgotPasswordFormProps {
  supabaseConfigured: boolean;
  initialError?: string | null;
}

export function ForgotPasswordForm({
  supabaseConfigured,
  initialError,
}: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError ?? null
  );
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitted(false);

    if (!supabaseConfigured) {
      setErrorMessage(
        'L’authentification Supabase n’est pas configurée dans cet environnement.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const result = await performPasswordResetRequest(supabase.auth, email, {
        configuredUrl: process.env.NEXT_PUBLIC_APP_URL,
        requestOrigin: window.location.origin,
      });

      if (!result.ok) {
        setErrorMessage(
          result.error ??
            'Impossible d’envoyer l’e-mail de réinitialisation pour le moment.'
        );
        return;
      }

      setSubmitted(true);
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

      {submitted ? (
        <AuthAlert variant="success" title="Demande enregistrée">
          Si un compte est associé à cette adresse e-mail, un lien de
          réinitialisation vient d’être envoyé. Consultez votre boîte de
          réception.
        </AuthAlert>
      ) : null}

      <FormField
        id="forgot-email"
        label="Adresse e-mail"
        required
        helperText="Vous recevrez un lien sécurisé valable pour une durée limitée."
      >
        <input
          id="forgot-email"
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

      <Button
        type="submit"
        variant="primary"
        disabled={submitting || !supabaseConfigured}
        className="w-full"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Envoi du lien…</span>
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" aria-hidden="true" />
            <span>Envoyer le lien de réinitialisation</span>
          </>
        )}
      </Button>
    </form>
  );
}
