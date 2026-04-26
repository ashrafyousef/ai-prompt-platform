"use client";

import useSWR from "swr";
import type { AgentDraft } from "@/hooks/useAgentWizard";
import { validateIdentity } from "@/hooks/useAgentWizard";

const EMOJIS = ["🤖", "🧠", "✍️", "📸", "🎨", "📊", "💡", "🔬", "📝", "🚀", "🎯", "💬"];

const CATEGORIES = [
  "",
  "Content & Copy",
  "Design & Visual",
  "Code & Technical",
  "Research & Analysis",
  "Strategy & Planning",
  "Custom",
];

const teamFetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  return data as { teams: { id: string; name: string }[] };
};

export function AgentIdentityStep({
  draft,
  updateDraft,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
}) {
  const { data: teamsData } = useSWR("/api/admin/teams", teamFetcher);
  const teams = teamsData?.teams ?? [];
  const errors = validateIdentity(draft);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Agent Identity</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Define how the agent appears and is organized within the platform.
        </p>
      </div>

      {/* Icon */}
      <fieldset>
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Icon
        </legend>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => updateDraft({ icon: e })}
              className={`flex h-10 w-10 items-center justify-center rounded-xl text-xl transition ${
                draft.icon === e
                  ? "bg-violet-100 ring-2 ring-violet-500 dark:bg-violet-900/40"
                  : "bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Name */}
      <div>
        <label htmlFor="wiz-name" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="wiz-name"
          type="text"
          value={draft.name}
          onChange={(e) => updateDraft({ name: e.target.value })}
          placeholder="e.g. Brand Copy Writer"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="wiz-desc" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Short description
        </label>
        <textarea
          id="wiz-desc"
          rows={2}
          value={draft.description}
          onChange={(e) => updateDraft({ description: e.target.value })}
          placeholder="One or two sentences about what this agent does…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {/* Category */}
      <div>
        <label htmlFor="wiz-cat" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Category
        </label>
        <select
          id="wiz-cat"
          value={draft.category}
          onChange={(e) => updateDraft({ category: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c || "— None —"}
            </option>
          ))}
        </select>
      </div>

      {/* Scope + Team */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="wiz-scope" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Scope
          </label>
          <select
            id="wiz-scope"
            value={draft.scope}
            onChange={(e) => {
              const nextScope = e.target.value as "TEAM" | "GLOBAL";
              updateDraft({
                scope: nextScope,
                teamId: nextScope === "GLOBAL" ? "" : draft.teamId,
              });
            }}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="GLOBAL">Global</option>
            <option value="TEAM">Team</option>
          </select>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Global appears across the workspace. Team scope limits visibility to one assigned team.
          </p>
        </div>
        <div>
          <label htmlFor="wiz-team" className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Team {draft.scope === "TEAM" ? <span className="text-red-500">*</span> : null}
          </label>
          <select
            id="wiz-team"
            value={draft.teamId}
            onChange={(e) => updateDraft({ teamId: e.target.value })}
            disabled={draft.scope !== "TEAM"}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">— None —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            Required only for Team scope.
          </p>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 ? (
        <ul className="space-y-1 text-xs text-red-600 dark:text-red-400">
          {errors.map((e) => (
            <li key={e}>• {e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
