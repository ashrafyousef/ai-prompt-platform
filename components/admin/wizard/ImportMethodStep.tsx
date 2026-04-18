"use client";

import { Wrench, Sparkles, BookOpen } from "lucide-react";
import type { AgentDraft, ImportMethod } from "@/hooks/useAgentWizard";

const METHODS: Array<{
  id: ImportMethod;
  icon: typeof Wrench;
  title: string;
  description: string;
  bestFor: string;
  expects: string;
  systemWill: string;
  reviewNeeded: string;
  nextStep: string;
}> = [
  {
    id: "manual",
    icon: Wrench,
    title: "Start from Scratch",
    description:
      "Fill in identity, behavior, knowledge, and output step by step.",
    bestFor: "New agents with clear requirements.",
    expects: "Nothing required upfront.",
    systemWill: "Create an empty draft you configure field by field.",
    reviewNeeded: "Complete all steps before publishing.",
    nextStep: "Next: Identity",
  },
  {
    id: "guided",
    icon: Sparkles,
    title: "Paste & Map",
    description:
      "Paste an existing prompt or config. The system suggests how to map it into structured fields.",
    bestFor: "Migrating prompts from other tools.",
    expects: "Prompt text, config exports, or notes.",
    systemWill: "Suggest mappings for name, behavior, starters, and knowledge. No content is auto-applied.",
    reviewNeeded: "Review every suggestion and edit before saving.",
    nextStep: "Next: Suggested Mapping",
  },
  {
    id: "knowledge-first",
    icon: BookOpen,
    title: "Knowledge First",
    description:
      "Upload reference material first, then build the agent's identity and behavior around it.",
    bestFor: "Document-heavy or policy-based agents.",
    expects: "Reference text or source files.",
    systemWill: "Pre-populate the Knowledge step with your sources.",
    reviewNeeded: "Review source type, priority, and active state.",
    nextStep: "Next: Knowledge Intake",
  },
];

export function ImportMethodStep({
  draft,
  updateDraft,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
}) {
  const selected = METHODS.find((m) => m.id === draft.importMethod) ?? METHODS[0];

  return (
    <div>
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        How do you want to start?
      </h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Pick a starting path. You can adjust everything in later steps regardless of your choice.
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
              <p className="mt-3 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                Best for: {m.bestFor}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Input: {m.expects}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                System: {m.systemWill}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                Review: {m.reviewNeeded}
              </p>
              <p className="mt-1 text-[11px] text-zinc-400">{m.nextStep}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Selected path
        </p>
        <p className="mt-1 text-sm font-medium text-zinc-800 dark:text-zinc-100">
          {selected.title}
        </p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Input: {selected.expects}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          System: {selected.systemWill}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Review: {selected.reviewNeeded}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{selected.nextStep}</p>
      </div>
    </div>
  );
}
