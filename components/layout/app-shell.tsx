'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { isOnboardingPath, type AgencySummary } from '@/lib/agency/types';
import { isPublicAuthPath } from '@/lib/auth/validation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
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
  const router = useRouter();
  const { dict } = useAppPreferences();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isStandalonePage =
    isPublicAuthPath(pathname) || isOnboardingPath(pathname);

  useEffect(() => {
    if (isPublicAuthPath(pathname) || !supabasePublicEnv) {
      return;
    }

    const supabase = createSupabaseBrowserClient(supabasePublicEnv);
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/login?message=signed_out');
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, supabasePublicEnv, router]);

  if (isStandalonePage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-[#F6F7F9] text-slate-950 dark:bg-[#090D16] dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col pb-[72px] lg:pb-0">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          userEmail={userEmail}
          supabasePublicEnv={supabasePublicEnv}
          activeAgency={activeAgency}
          agencies={agencies}
        />

        <main className="mx-auto w-full max-w-[1380px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-6"
          >
            {children}
          </motion.div>
        </main>

        <footer className="mt-auto border-t border-slate-200/80 px-4 py-3.5 text-xs text-slate-500 sm:px-6 lg:px-8 dark:border-slate-800/80 dark:text-slate-400">
          <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2">
            <span className="font-medium">
              KIRALIS · {activeAgency ? activeAgency.name : dict.brandSubtitle}
            </span>
            <span className="font-mono text-[11px] tabular-nums">
              {dict.common.tunisia} · TND · Africa/Tunis
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
