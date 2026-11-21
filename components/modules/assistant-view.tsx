'use client';

import React from 'react';
import { SendHorizontal, Sparkles } from 'lucide-react';
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
        {/* Conversation shell (disabled in Phase 1) */}
        <Surface className="xl:col-span-2 flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<Sparkles className="h-5 w-5" aria-hidden="true" />}
              title={moduleCopy.emptyTitle}
              description={moduleCopy.emptyDescription}
              meta={`${dict.common.plannedFor} Phase 6 · Gemini API (serveur)`}
            />
          </div>

          <div className="border-t border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
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
                className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-500 placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:disabled:bg-slate-900/70"
              />
              <Button
                variant="primary"
                disabled
                title={assistantCopy.disabledFeedback}
              >
                <SendHorizontal className="h-4 w-4" aria-hidden="true" />
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
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-950 dark:text-slate-50">
              {assistantCopy.plannedCapabilitiesTitle}
            </h2>
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {assistantCopy.plannedCapabilities.map((item) => (
              <li key={item.title} className="px-5 py-4 space-y-1">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {item.description}
                </p>
              </li>
            ))}
          </ul>
        </Surface>
      </div>
    </div>
  );
}
