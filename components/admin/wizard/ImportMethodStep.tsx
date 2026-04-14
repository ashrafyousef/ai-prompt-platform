"use client";

import { Wrench, Sparkles, BookOpen } from "lucide-react";
import type { AgentDraft, ImportMethod } from "@/hooks/useAgentWizard";

const METHODS: Array<{
  id: ImportMethod;
  icon: typeof Wrench;
  title: string;
  description: string;
}> = [
  {
    id: "manual",
    icon: Wrench,
    title: "Manual Setup",
    description:
      "Start from scratch — define identity, behavior, and output rules step by step.",
  },
  {
    id: "guided",
    icon: Sparkles,
    title: "Guided Extraction",
    description:
      "Paste an existing GPT system prompt or config and let the wizard break it into structured fields.",
  },
  {
    id: "knowledge-first",
    icon: BookOpen,
    title: "Knowledge-First",
    description:
      "Upload reference material first, then build the agent around it.",
  },
];

export function ImportMethodStep({
  draft,
  updateDraft,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        How would you like to import?
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Choose a starting approach. You can always adjust details in later steps.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {METHODS.map((m) => {
          const active = draft.importMethod === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => updateDraft({ importMethod: m.id })}
              className={`group flex flex-col items-start rounded-2xl border-2 p-5 text-left transition ${
                active
                  ? "border-violet-500 bg-violet-50/60 shadow-sm dark:border-violet-400 dark:bg-violet-950/30"
                  : "border-zinc-200 bg-white hover:border-zinc-300 hover:shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
              }`}
            >
              <m.icon
                className={`h-6 w-6 ${
                  active
                    ? "text-violet-600 dark:text-violet-400"
                    : "text-zinc-400 group-hover:text-zinc-600 dark:text-zinc-500"
                }`}
              />
              <p
                className={`mt-4 text-sm font-semibold ${
                  active ? "text-violet-900 dark:text-violet-200" : "text-zinc-900 dark:text-zinc-100"
                }`}
              >
                {m.title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
                {m.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
