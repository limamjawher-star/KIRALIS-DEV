'use client';

import React from 'react';
import { Bot, SendHorizontal, ShieldCheck } from 'lucide-react';
import { useAppPreferences } from '@/components/providers/app-preferences-provider';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModuleNotice } from '@/components/ui/module-notice';
import { PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';

export function AssistantView() {
  const { dict } = useAppPreferences();
  const moduleCopy = dict.modules.assistant;
  const assistantCopy = dict.assistant;

  return (
    <div className="space-y-6">
      <PageHeader
        title={moduleCopy.title}
        description={moduleCopy.description}
        plannedPhase="Phase 6"
      />

      <ModuleNotice
        title={assistantCopy.noticeTitle}
        body={assistantCopy.noticeBody}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Conversation shell (disabled in Phase 1 — server-side Gemini planned for Phase 6) */}
        <Surface className="xl:col-span-2 flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-3 bg-[#0B1220] px-5 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-blue-400">
                <Bot className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="font-display text-sm font-bold text-white">
                  {moduleCopy.title}
                </p>
                <p className="text-[11px] text-slate-400">
                  Exécution serveur isolée par agence · Gemini API
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <ShieldCheck
                className="h-3.5 w-3.5 text-blue-400"
                aria-hidden="true"
              />
              <span>Phase 6</span>
            </span>
          </div>

          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Bot className="h-5 w-5" aria-hidden="true" />}
              title={moduleCopy.emptyTitle}
              description={moduleCopy.emptyDescription}
              meta={`${dict.common.plannedFor} Phase 6 · Gemini API (serveur)`}
            />
          </div>

          <div className="border-t border-slate-200 bg-[#F4F6FA] p-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="assistant-prompt-input" className="sr-only">
                {assistantCopy.promptPlaceholder}
              </label>
              <input
                id="assistant-prompt-input"
                type="text"
                disabled
                value=""
                readOnly
                placeholder={assistantCopy.promptPlaceholder}
                className="h-11 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-500 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 sm:h-10 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:disabled:bg-slate-900/70"
              />
              <Button
                variant="primary"
                disabled
                title={assistantCopy.disabledFeedback}
              >
                <SendHorizontal
                  className="h-4 w-4 rtl:rotate-180"
                  aria-hidden="true"
                />
                <span>{assistantCopy.sendButton}</span>
              </Button>
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {assistantCopy.disabledFeedback}
            </p>
          </div>
        </Surface>

        {/* Planned capabilities */}
        <Surface className="overflow-hidden self-start">
          <div className="border-b border-slate-200 bg-[#F4F6FA] px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/60">
            <h2 className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
              {assistantCopy.plannedCapabilitiesTitle}
            </h2>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {assistantCopy.plannedCapabilities.map((item, idx) => (
              <li key={item.title} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#0B1220] font-mono text-[11px] font-bold text-white tabular-nums dark:bg-slate-800 dark:text-blue-400">
                  {idx + 1}
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </div>
  );
}
