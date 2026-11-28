'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import {
  FormField,
  getInputStateClasses,
  INPUT_BASE_CLASSES,
} from '@/components/ui/form-field';
import { performEmailLogin } from '@/lib/auth/actions';
import type { SupportedLocale } from '@/lib/currency';
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

const LOGIN_COPY: Record<
  SupportedLocale,
  {
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    passwordPlaceholder: string;
    forgotPassword: string;
    showPassword: string;
    hidePassword: string;
    submit: string;
    submitting: string;
    resendVerification: string;
    missingConfig: string;
    genericError: string;
    networkError: string;
  }
> = {
  fr: {
    emailLabel: 'Adresse e-mail',
    emailPlaceholder: 'nom@agence.tn',
    passwordLabel: 'Mot de passe',
    passwordPlaceholder: 'Votre mot de passe',
    forgotPassword: 'Mot de passe oublié ?',
    showPassword: 'Afficher le mot de passe',
    hidePassword: 'Masquer le mot de passe',
    submit: 'Se connecter',
    submitting: 'Connexion en cours…',
    resendVerification: 'Renvoyer l’e-mail de vérification',
    missingConfig:
      'L’authentification Supabase n’est pas configurée dans cet environnement.',
    genericError: 'Impossible de vous connecter. Veuillez réessayer.',
    networkError:
      'Impossible de joindre le service d’authentification. Vérifiez votre connexion.',
  },
  en: {
    emailLabel: 'Email address',
    emailPlaceholder: 'name@agency.tn',
    passwordLabel: 'Password',
    passwordPlaceholder: 'Your password',
    forgotPassword: 'Forgot password?',
    showPassword: 'Show password',
    hidePassword: 'Hide password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    resendVerification: 'Resend verification email',
    missingConfig:
      'Supabase authentication is not configured in this environment.',
    genericError: 'Unable to sign in. Please try again.',
    networkError:
      'Unable to reach the authentication service. Check your connection.',
  },
  ar: {
    emailLabel: 'البريد الإلكتروني',
    emailPlaceholder: 'name@agency.tn',
    passwordLabel: 'كلمة المرور',
    passwordPlaceholder: 'كلمة المرور الخاصة بك',
    forgotPassword: 'هل نسيت كلمة المرور؟',
    showPassword: 'إظهار كلمة المرور',
    hidePassword: 'إخفاء كلمة المرور',
    submit: 'تسجيل الدخول',
    submitting: 'جارٍ تسجيل الدخول…',
    resendVerification: 'إعادة إرسال بريد التحقق',
    missingConfig: 'المصادقة عبر Supabase غير مهيأة في هذه البيئة.',
    genericError: 'تعذر تسجيل الدخول. يرجى المحاولة مجدداً.',
    networkError: 'تعذر الاتصال بخدمة المصادقة. تحقق من اتصال الإنترنت.',
  },
};

export function LoginForm({
  supabasePublicEnv,
  nextPath,
  initialError,
  initialNotice,
}: LoginFormProps) {
  const router = useRouter();
  const { locale } = useAppPreferences();
  const copy = LOGIN_COPY[locale];
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
      setErrorMessage(copy.missingConfig);
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
        setErrorMessage(result.error ?? copy.genericError);
        if (result.data?.unverifiedEmail) {
          setUnverifiedEmail(email.trim().toLowerCase());
        }
        return;
      }

      router.replace(result.data?.redirectTo ?? '/');
      router.refresh();
    } catch {
      setErrorMessage(copy.networkError);
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
                {copy.resendVerification}
              </Link>
            </p>
          ) : null}
        </AuthAlert>
      ) : null}

      <FormField id="login-email" label={copy.emailLabel} required>
        <input
          id="login-email"
          name="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder={copy.emailPlaceholder}
          className={cn(
            INPUT_BASE_CLASSES,
            getInputStateClasses(false),
            'rtl:text-right'
          )}
        />
      </FormField>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="login-password"
            className="block text-[13px] font-semibold text-slate-800 dark:text-slate-200"
          >
            {copy.passwordLabel}
            <span className="ms-1 text-red-600 dark:text-red-400" aria-hidden="true">
              *
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[#1D4ED8] transition-colors hover:text-[#1E40AF] hover:underline dark:text-blue-400 dark:hover:text-blue-300"
          >
            {copy.forgotPassword}
          </Link>
        </div>

        <div className="relative">
          <input
            id="login-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            dir="ltr"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder={copy.passwordPlaceholder}
            className={cn(
              INPUT_BASE_CLASSES,
              getInputStateClasses(false),
              'pe-11 rtl:text-right'
            )}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? copy.hidePassword : copy.showPassword}
            className="absolute inset-y-0 end-0 inline-flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:text-[#1D4ED8] dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer"
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
        className="mt-2 h-11 w-full sm:h-10"
      >
        {submitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>{copy.submitting}</span>
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4 rtl:-scale-x-100" aria-hidden="true" />
            <span>{copy.submit}</span>
          </>
        )}
      </Button>
    </form>
  );
}
