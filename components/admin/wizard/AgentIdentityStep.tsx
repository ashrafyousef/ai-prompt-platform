"use client";

import { useState } from "react";
import useSWR from "swr";
import { Sparkles } from "lucide-react";
import type { AgentDraft } from "@/hooks/useAgentWizard";
import { validateIdentity } from "@/hooks/useAgentWizard";
import { AGENT_PRESETS, type AgentPreset } from "@/lib/agentConstants";

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

function applyPreset(
  preset: AgentPreset,
  updateDraft: (p: Partial<AgentDraft>) => void
) {
  const d = preset.defaults;
  updateDraft({
    icon: preset.icon,
    category: preset.category,
    systemInstructions: d.systemInstructions,
    toneGuidance: d.toneGuidance,
    outputMode: d.outputMode,
    responseDepth: d.responseDepth,
    citationsPolicy: d.citationsPolicy,
    fallbackBehavior: d.fallbackBehavior,
    temperature: d.temperature,
    maxTokens: d.maxTokens,
    structuredSections: d.structuredSections,
    starterPrompts: d.starterPrompts,
  });
}

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
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(true);

  function handlePreset(preset: AgentPreset) {
    applyPreset(preset, updateDraft);
    setAppliedPreset(preset.id);
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Identity</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Set the agent's name, description, and visibility. This is what users see before they start a conversation.
        </p>
      </div>

      {/* Preset picker */}
      {showPresets ? (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-500" />
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Quick start
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPresets(false)}
              className="text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              Dismiss
            </button>
          </div>
          <p className="mb-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Pick a preset to prefill behavior, output, and starters. Everything stays editable.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {AGENT_PRESETS.map((preset) => {
              const active = appliedPreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePreset(preset)}
                  className={`flex items-start gap-2.5 rounded-xl border-2 p-3 text-left transition ${
                    active
                      ? "border-violet-500 bg-violet-50/60 dark:border-violet-400 dark:bg-violet-950/30"
                      : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-600"
                  }`}
                >
                  <span className="mt-0.5 text-lg leading-none">{preset.icon}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${active ? "text-violet-800 dark:text-violet-200" : "text-zinc-900 dark:text-zinc-100"}`}>
                      {preset.label}
                    </p>
                    <p className="mt-0.5 text-[10px] leading-snug text-zinc-500 dark:text-zinc-400">
                      {preset.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
          {appliedPreset ? (
            <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400">
              Preset applied. Behavior, output, and starters have been prefilled. All fields remain editable.
            </p>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPresets(true)}
          className="flex items-center gap-1.5 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          <Sparkles className="h-3 w-3" />
          Show quick-start presets
        </button>
      )}

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
        <p className="mt-1 text-[11px] text-zinc-400">
          Choose a clear, role-based name — this appears in the agent picker.
        </p>
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
            onChange={(e) => updateDraft({ scope: e.target.value as "TEAM" | "GLOBAL" })}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="GLOBAL">Global</option>
            <option value="TEAM">Team</option>
          </select>
          <p className="mt-1 text-[11px] text-zinc-400">
            Global = visible to all users. Team = visible only to team members.
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
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="">— Select team —</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-zinc-400">
            {draft.scope === "TEAM"
              ? "Required. Only members of this team will see the agent."
              : "Only needed when scope is Team."}
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
