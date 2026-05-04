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
        <div className="flex items-center justify-center gap-2 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          <Sparkles className="h-3 w-3 shrink-0" />
          <span>Suggestions · {agent.name}</span>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
          {
            "Starters from this agent's configuration — they change when you switch agents."
          }
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {visiblePrompts.map((prompt, index) => (
          <button
            key={`${agent.id}-${prompt.id}-${index}`}
            type="button"
            onClick={() => onPromptClick(prompt.prompt)}
            className={`group rounded-xl border border-zinc-200/90 bg-white/75 p-3.5 text-left text-sm text-zinc-700 transition hover:border-violet-300 hover:bg-violet-50/50 hover:shadow-sm active:scale-[0.99] dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-violet-500 dark:hover:bg-violet-900/10 ${
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
