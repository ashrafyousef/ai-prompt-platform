"use client";

import type { Dispatch } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AgentDraft, WizardAction } from "@/hooks/useAgentWizard";

let _pid = 0;
function nextPid() {
  return `p-${++_pid}-${Date.now()}`;
}

export function AgentStarterPromptsStep({
  draft,
  dispatch,
}: {
  draft: AgentDraft;
  dispatch: Dispatch<WizardAction>;
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Starters</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          These appear when users first open the agent. Good starters show what the agent is best at.
        </p>
      </div>

      <div className="space-y-3">
        {draft.starterPrompts.map((p, i) => (
          <div key={p.id} className="flex items-start gap-3">
            <span className="mt-2.5 text-xs font-medium text-zinc-400">{i + 1}</span>
            <textarea
              rows={2}
              value={p.text}
              onChange={(e) =>
                dispatch({
                  type: "UPDATE_STARTER_PROMPT",
                  id: p.id,
                  text: e.target.value,
                })
              }
              placeholder="e.g. Draft a product launch email for…"
              className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "REMOVE_STARTER_PROMPT", id: p.id })}
              className="mt-2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
              aria-label="Remove prompt"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() =>
          dispatch({
            type: "ADD_STARTER_PROMPT",
            prompt: { id: nextPid(), text: "" },
          })
        }
        className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        <Plus className="h-4 w-4" />
        Add prompt
      </button>

      {draft.starterPrompts.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No starters yet. Without these, users see an empty chat with no guidance on what to ask.
        </p>
      ) : null}
    </div>
  );
}
