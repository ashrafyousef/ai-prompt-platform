"use client";

import { Sparkles } from "lucide-react";
import type { UiAgent } from "@/lib/types";

export function AgentStarterPrompts({
  agent,
  onPromptClick,
}: {
  agent: UiAgent | undefined;
  onPromptClick: (text: string) => void;
}) {
  if (!agent) return null;
  const prompts = agent.starterPrompts;
  if (!prompts || prompts.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        <Sparkles className="h-3 w-3" />
        Try one of these
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {prompts.slice(0, 4).map((prompt, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onPromptClick(prompt)}
            className="group rounded-xl border border-zinc-200 bg-white/70 p-4 text-left text-sm text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-violet-500 dark:hover:bg-violet-900/10"
          >
            <span className="line-clamp-2 leading-relaxed">
              {prompt.length > 120 ? prompt.slice(0, 117) + "…" : prompt}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
