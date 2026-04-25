"use client";

import { Loader2 } from "lucide-react";
import type { AgentDraft } from "@/hooks/useAgentWizard";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">{title}</h3>
      <div className="text-sm text-zinc-700 dark:text-zinc-300">{children}</div>
    </div>
  );
}

export function AgentReviewStep({
  draft,
  saving,
  onSaveDraft,
  onPublish,
  onGoBack,
}: {
  draft: AgentDraft;
  saving: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onGoBack: () => void;
}) {
  const readinessItems = [
    {
      label: "Identity configured",
      ready: draft.name.trim().length > 0,
      detail: draft.name.trim().length > 0 ? "Name is set." : "Add an agent name.",
    },
    {
      label: "Behavior configured",
      ready: draft.systemInstructions.trim().length > 0,
      detail:
        draft.systemInstructions.trim().length > 0
          ? "Core instructions are present."
          : "Add system instructions.",
    },
    {
      label: "Scope assignment is sensible",
      ready: draft.scope === "GLOBAL" || (draft.scope === "TEAM" && draft.teamId.trim().length > 0),
      detail:
        draft.scope === "TEAM" && draft.teamId.trim().length === 0
          ? "Team scope selected without a team."
          : draft.scope === "TEAM"
          ? "Team scope is assigned."
          : "Global scope selected.",
    },
    {
      label: "Starter prompts (optional)",
      ready: draft.starterPrompts.length > 0,
      detail:
        draft.starterPrompts.length > 0
          ? `${draft.starterPrompts.length} prompt(s) configured.`
          : "No prompts yet — chat will use a generic empty state.",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Review & Save</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Confirm everything looks correct before saving.
        </p>
      </div>

      <div className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-zinc-50/50 dark:divide-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/50">
        <div className="p-5">
          <Section title="Identity">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{draft.icon}</span>
              <div>
                <p className="font-semibold text-zinc-900 dark:text-zinc-100">{draft.name || "Untitled"}</p>
                <p className="text-xs text-zinc-500">{draft.description || "No description"}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <AgentStatusBadge status={draft.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT"} />
              <AgentScopeBadge scope={draft.scope} />
              {draft.category ? (
                <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                  {draft.category}
                </span>
              ) : null}
            </div>
          </Section>
        </div>

        <div className="p-5">
          <Section title="Behavior">
            <p className="line-clamp-4 whitespace-pre-wrap">{draft.systemInstructions || "—"}</p>
            {draft.behaviorRules ? <p className="mt-2 line-clamp-2 text-xs text-zinc-500">Rules: {draft.behaviorRules}</p> : null}
            <p className="mt-2 text-xs text-zinc-400">
              Temp: {draft.temperature} · Max tokens: {draft.maxTokens}
              {draft.strictMode ? " · Strict" : ""}
            </p>
          </Section>
        </div>

        <div className="p-5">
          <Section title="Knowledge">
            {draft.knowledgeSources.length === 0 ? (
              <p className="text-zinc-500">None added.</p>
            ) : (
              <ul className="list-disc pl-4">
                {draft.knowledgeSources.map((k) => (
                  <li key={k.id}>
                    {k.title} ({k.type}) — {(k.content.length / 1000).toFixed(1)}k chars
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="p-5">
          <Section title="Output rules">
            <p className="font-medium capitalize">{draft.outputMode.replace("-", " ")}</p>
            {draft.outputMode === "structured-markdown" && draft.structuredSections.length > 0 ? (
              <p className="mt-1 text-xs text-zinc-500">
                {draft.structuredSections.length} section(s): {draft.structuredSections.map((s) => s.title || "Untitled").join(", ")}
              </p>
            ) : null}
            {draft.outputMode === "json" && draft.jsonSchema.length > 0 ? (
              <p className="mt-1 text-xs text-zinc-500">
                {draft.jsonSchema.length} field(s): {draft.jsonSchema.map((f) => f.name || "unnamed").join(", ")}
              </p>
            ) : null}
          </Section>
        </div>

        <div className="p-5">
          <Section title="Starter prompts">
            {draft.starterPrompts.length === 0 ? (
              <p className="text-zinc-500">None.</p>
            ) : (
              <ul className="list-decimal pl-4">
                {draft.starterPrompts.map((p) => (
                  <li key={p.id} className="line-clamp-1">
                    {p.text || "—"}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Publish readiness (informational)
        </h3>
        <ul className="mt-3 space-y-2">
          {readinessItems.map((item) => (
            <li key={item.label} className="flex items-start justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-zinc-800 dark:text-zinc-200">{item.label}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">{item.detail}</p>
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  item.ready
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                    : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {item.ready ? "Ready" : "Needs attention"}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save Draft
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50 dark:bg-emerald-500 dark:hover:bg-emerald-600"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Publish Agent
        </button>
        <button
          type="button"
          onClick={onGoBack}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Go back and edit
        </button>
      </div>
    </div>
  );
}
