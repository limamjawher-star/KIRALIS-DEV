'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { isOnboardingPath, type AgencySummary } from '@/lib/agency/types';
import { isPublicAuthPath } from '@/lib/auth/validation';
import type { SupabasePublicEnv } from '@/lib/supabase/env';
import { MobileBottomNav } from './mobile-bottom-nav';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  supabasePublicEnv?: SupabasePublicEnv | null;
  activeAgency?: AgencySummary | null;
  agencies?: AgencySummary[];
}

export function AppShell({
  children,
  userEmail = null,
  supabasePublicEnv = null,
  activeAgency = null,
  agencies = [],
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStandaloneShell =
    isPublicAuthPath(pathname) || isOnboardingPath(pathname);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMobileMenuOpen(false));
    return () => cancelAnimationFrame(id);
  }, [pathname]);

  if (isStandaloneShell) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#ECEFF4] text-slate-950 dark:bg-[#070B14] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          userEmail={userEmail}
          supabasePublicEnv={supabasePublicEnv}
          activeAgency={activeAgency}
          agencies={agencies}
        />

        <main
          id="main-content"
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10"
        >
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>

        <footer className="mt-auto hidden border-t border-slate-300/75 bg-white/60 px-6 py-3 text-xs text-slate-500 lg:block lg:px-8 dark:border-slate-800/90 dark:bg-slate-950/40 dark:text-slate-400">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
            <span className="font-medium text-slate-600 dark:text-slate-300">
              KIRALIS · Plateforme de gestion d’agence de location
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
              {activeAgency
                ? `${activeAgency.name} · ${activeAgency.slug} · TND · Africa/Tunis`
                : 'TND · Africa/Tunis'}
            </span>
          </div>
        </footer>
      </div>

      <MobileBottomNav
        onOpenMenu={() => setMobileMenuOpen(true)}
        menuOpen={mobileMenuOpen}
      />
    </div>
  );
}
