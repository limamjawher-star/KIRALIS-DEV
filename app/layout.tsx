import type { Metadata } from 'next';
import {
  IBM_Plex_Mono,
  Plus_Jakarta_Sans,
  Public_Sans,
} from 'next/font/google';
import { AppPreferencesProvider } from '@/components/providers/app-preferences-provider';
import { AppShell } from '@/components/layout/app-shell';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

const publicSans = Public_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-public-sans',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-ibm-plex-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KIRALIS — Gestion de location de véhicules',
  description:
    'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
  openGraph: {
    title: 'KIRALIS — Gestion de location de véhicules',
    description:
      'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KIRALIS — Gestion de location de véhicules',
    description:
      'Plateforme SaaS de gestion d’agence de location de véhicules pour la Tunisie et la région MENA.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${plusJakartaSans.variable} ${publicSans.variable} ${ibmPlexMono.variable}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen bg-slate-50 text-slate-950 antialiased dark:bg-slate-950 dark:text-slate-100"
      >
        <AppPreferencesProvider>
          <AppShell>{children}</AppShell>
        </AppPreferencesProvider>
      </body>
    </html>
  );
}
