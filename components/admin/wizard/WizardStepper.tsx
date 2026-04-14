"use client";

import { Check } from "lucide-react";
import type { WizardStep } from "@/hooks/useAgentWizard";
import { STEP_LABELS } from "@/hooks/useAgentWizard";

export function WizardStepper({
  steps,
  current,
  onGo,
  canNavigate,
}: {
  steps: WizardStep[];
  current: WizardStep;
  onGo: (s: WizardStep) => void;
  canNavigate: (s: WizardStep) => boolean;
}) {
  const currentIdx = steps.indexOf(current);

  return (
    <>
      {/* Desktop vertical stepper */}
      <nav className="hidden flex-col gap-1 lg:flex" aria-label="Wizard steps">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = s === current;
          const reachable = canNavigate(s);

          return (
            <button
              key={s}
              type="button"
              onClick={() => reachable && onGo(s)}
              disabled={!reachable}
              aria-current={active ? "step" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-zinc-100 dark:text-zinc-900"
                  : done
                  ? "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  : reachable
                  ? "text-zinc-500 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                  : "cursor-not-allowed text-zinc-300 dark:text-zinc-600"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                    : done
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : "bg-zinc-200/70 text-zinc-500 dark:bg-zinc-700/50 dark:text-zinc-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className="truncate">{STEP_LABELS[s]}</span>
            </button>
          );
        })}
      </nav>

      {/* Mobile horizontal stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2 lg:hidden" aria-label="Wizard steps">
        {steps.map((s, i) => {
          const done = i < currentIdx;
          const active = s === current;
          return (
            <button
              key={s}
              type="button"
              onClick={() => canNavigate(s) && onGo(s)}
              disabled={!canNavigate(s)}
              aria-current={active ? "step" : undefined}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : done
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
              <span className="hidden sm:inline">{STEP_LABELS[s]}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
