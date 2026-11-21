'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { isPublicAuthPath } from '@/lib/auth/validation';
import { createSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  supabaseConfigured?: boolean;
}

export function AppShell({
  children,
  userEmail = null,
  supabaseConfigured = false,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { dict } = useAppPreferences();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isAuthPage = isPublicAuthPath(pathname);

  useEffect(() => {
    if (isAuthPage || !supabaseConfigured) {
      return;
    }

    const supabase = createSupabaseBrowserClient();
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
  }, [isAuthPage, supabaseConfigured, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen w-full bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          userEmail={userEmail}
          supabaseConfigured={supabaseConfigured}
        />

        <main className="mx-auto w-full max-w-[1360px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
          <div className="mx-auto flex max-w-[1360px] flex-wrap items-center justify-between gap-2">
            <span>
              KIRALIS · {dict.brandSubtitle}
            </span>
            <span className="font-mono text-[11px] tabular-nums">
              {dict.common.tunisia} · TND · Africa/Tunis
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
}
