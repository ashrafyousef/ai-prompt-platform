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
  const prompts = agent.starterPrompts
    .filter((prompt) => prompt.isActive !== false && prompt.prompt.trim().length > 0)
    .sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  if (!prompts || prompts.length === 0) return null;
  const visiblePrompts = prompts.slice(0, 4);

  return (
    <div className="mt-6" data-agent-id={agent.id}>
      <div className="mb-2.5 flex flex-col items-center gap-1 text-center">
        <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <Sparkles className="h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-500" />
          <span>Suggestions · {agent.name}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-400">
          {
            "Starters from this agent's configuration — they change when you switch agents."
          }
        </p>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
        {visiblePrompts.map((prompt, index) => (
          <button
            key={`${agent.id}-${prompt.id}-${index}`}
            type="button"
            onClick={() => onPromptClick(prompt.prompt)}
            className={`group rounded-2xl border border-zinc-200/80 bg-white p-3.5 text-left text-sm text-zinc-800 shadow-sm transition-colors hover:border-zinc-300 hover:bg-zinc-50/90 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/35 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/70 dark:focus-visible:ring-zinc-600 dark:focus-visible:ring-offset-zinc-950 ${
              index >= 2 ? "hidden sm:block" : ""
            }`}
          >
            <span className="line-clamp-3 text-[13px] leading-relaxed">
              {prompt.prompt.trim().length > 140
                ? `${prompt.prompt.trim().slice(0, 137)}...`
                : prompt.prompt.trim()}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
