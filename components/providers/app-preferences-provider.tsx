'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from 'react';
import type { SupportedLocale } from '@/lib/currency';
import {
  getDictionary,
  SUPPORTED_LOCALES,
  type Dictionary,
} from '@/lib/i18n/dictionaries';

export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'kiralis-theme';
const LOCALE_STORAGE_KEY = 'kiralis-locale';
const PREFS_EVENT = 'kiralis-preferences-change';

interface AppPreferencesContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  locale: SupportedLocale;
  setLocale: (locale: SupportedLocale) => void;
  dict: Dictionary;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(
  null
);

function isSupportedLocale(value: string | null): value is SupportedLocale {
  return (
    value !== null && (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

function subscribePreferences(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => onStoreChange();
  window.addEventListener('storage', handler);
  window.addEventListener(PREFS_EVENT, handler);
  return () => {
    window.removeEventListener('storage', handler);
    window.removeEventListener(PREFS_EVENT, handler);
  };
}

function getThemeSnapshot(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      return stored;
    }
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark';
    }
  } catch {
    // Ignore storage access errors
  }
  return 'light';
}

function getLocaleSnapshot(): SupportedLocale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isSupportedLocale(stored)) {
      return stored;
    }
  } catch {
    // Ignore storage access errors
  }
  return 'fr';
}

function notifyPreferencesChanged() {
  window.dispatchEvent(new Event(PREFS_EVENT));
}

export function AppPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = useSyncExternalStore<ThemeMode>(
    subscribePreferences,
    getThemeSnapshot,
    () => 'light'
  );

  const locale = useSyncExternalStore<SupportedLocale>(
    subscribePreferences,
    getLocaleSnapshot,
    () => 'fr'
  );

  // Synchronize external DOM attributes on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    const currentDict = getDictionary(locale);
    root.lang = locale;
    root.dir = currentDict.dir;
  }, [theme, locale]);

  const setTheme = useCallback((nextTheme: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors
    }
    notifyPreferencesChanged();
  }, []);

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = getThemeSnapshot() === 'dark' ? 'light' : 'dark';
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors
    }
    notifyPreferencesChanged();
  }, []);

  const setLocale = useCallback((nextLocale: SupportedLocale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    } catch {
      // Ignore storage errors
    }
    notifyPreferencesChanged();
  }, []);

  const dict = useMemo(() => getDictionary(locale), [locale]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      locale,
      setLocale,
      dict,
    }),
    [theme, setTheme, toggleTheme, locale, setLocale, dict]
  );

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences(): AppPreferencesContextValue {
  const ctx = useContext(AppPreferencesContext);
  if (!ctx) {
    throw new Error(
      'useAppPreferences must be used inside AppPreferencesProvider.'
    );
  }
  return ctx;
}
