"use client";

import { useState } from "react";
import type { AgentDraft, KnowledgeSource } from "@/hooks/useAgentWizard";
import { mapGuidedImportText } from "@/lib/importGuidedMapping";
import { SOURCE_TYPE_LABELS } from "@/lib/agentConstants";

export function GuidedExtractionStep({
  draft,
  updateDraft,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
}) {
  const [mappedOnce, setMappedOnce] = useState(false);

  function runMapping() {
    const mapped = mapGuidedImportText(draft.guidedRawText);
    setMappedOnce(true);
    updateDraft({
      guidedSuggestions: {
        name: mapped.name,
        description: mapped.description,
        behaviorNotes: mapped.behaviorNotes,
        starterPrompts: mapped.starterPrompts,
        knowledgeCandidates: mapped.knowledgeCandidates,
      },
      guidedUnmappedText: mapped.unmappedText,
      guidedWarnings: mapped.warnings,
    });
  }

  function applyMappings() {
    const suggestion = draft.guidedSuggestions;
    const nextKnowledge = [
      ...draft.knowledgeSources,
      ...suggestion.knowledgeCandidates.filter(
        (candidate) =>
          !draft.knowledgeSources.some(
            (existing) =>
              existing.title.trim().toLowerCase() === candidate.title.trim().toLowerCase() &&
              (existing.content ?? "").trim() === (candidate.content ?? "").trim()
          )
      ),
    ];

    const nextStarterPrompts = [
      ...draft.starterPrompts,
      ...suggestion.starterPrompts
        .filter(Boolean)
        .filter(
          (text) =>
            !draft.starterPrompts.some(
              (prompt) => prompt.text.trim().toLowerCase() === text.trim().toLowerCase()
            )
        )
        .map((text, index) => ({
          id: `guided-sp-${Date.now()}-${index}`,
          text,
        })),
    ];

    const behaviorMerged =
      suggestion.behaviorNotes &&
      !draft.behaviorRules.toLowerCase().includes(suggestion.behaviorNotes.toLowerCase())
        ? [draft.behaviorRules, suggestion.behaviorNotes].filter(Boolean).join("\n\n")
        : draft.behaviorRules;

    updateDraft({
      name: draft.name || suggestion.name,
      description: draft.description || suggestion.description,
      behaviorRules: behaviorMerged,
      knowledgeSources: nextKnowledge as KnowledgeSource[],
      starterPrompts: nextStarterPrompts,
    });
  }

  const suggestionCount =
    (draft.guidedSuggestions.name ? 1 : 0) +
    (draft.guidedSuggestions.description ? 1 : 0) +
    (draft.guidedSuggestions.behaviorNotes ? 1 : 0) +
    draft.guidedSuggestions.starterPrompts.length +
    draft.guidedSuggestions.knowledgeCandidates.length;
  const rawLength = draft.guidedRawText.trim().length;
  const lowConfidence = mappedOnce && suggestionCount <= 1;
  const noMatches = mappedOnce && suggestionCount === 0;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Suggested Mapping
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Paste source text and generate suggested field mappings. Nothing is auto-applied — review and edit first.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <p><strong>You provide:</strong> prompt text, config exports, or migration notes.</p>
        <p className="mt-1"><strong>System suggests:</strong> identity, behavior, starters, and knowledge mappings using heuristics.</p>
        <p className="mt-1"><strong>You verify:</strong> accuracy, missing context, and unmapped content before applying.</p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Source text
        </label>
        <textarea
          rows={12}
          value={draft.guidedRawText}
          onChange={(event) => updateDraft({ guidedRawText: event.target.value })}
          placeholder="Paste GPT prompt, tool config, or structured notes..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-xs leading-relaxed shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={runMapping}
          disabled={rawLength === 0}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Generate suggestions
        </button>
        <button
          type="button"
          onClick={applyMappings}
          disabled={suggestionCount === 0}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-200"
        >
          Apply suggestions to draft
        </button>
        <span className="text-xs text-zinc-400">
          {rawLength > 0 ? `${rawLength} characters provided` : "Paste text to begin"}
        </span>
      </div>

      {!mappedOnce && rawLength > 0 && rawLength < 120 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          Input is short. Longer, more detailed text produces better suggestions.
        </p>
      ) : null}

      {draft.guidedWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          {draft.guidedWarnings.map((warning) => (
            <p key={warning}>• {warning}</p>
          ))}
        </div>
      ) : null}

      {noMatches ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-300">
          No clear mappings found. Try pasting more structured text with labeled fields (e.g. name:, behavior:, prompts:), or continue manually.
        </div>
      ) : null}

      {lowConfidence && !noMatches ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-300">
          Few suggestions found. Review carefully and expect to fill in gaps manually.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Identity suggestions
          </p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-200">
            Name: {draft.guidedSuggestions.name || "—"}
          </p>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
            Description: {draft.guidedSuggestions.description || "—"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Behavior suggestions
          </p>
          <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-300">
            {draft.guidedSuggestions.behaviorNotes || "None detected"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Starter suggestions ({draft.guidedSuggestions.starterPrompts.length})
        </p>
        {draft.guidedSuggestions.starterPrompts.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">None detected. You can add starters manually later.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-600 dark:text-zinc-300">
            {draft.guidedSuggestions.starterPrompts.map((prompt) => (
              <li key={prompt}>{prompt}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Knowledge candidates ({draft.guidedSuggestions.knowledgeCandidates.length})
        </p>
        {draft.guidedSuggestions.knowledgeCandidates.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">None detected. You can add knowledge sources later.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs text-zinc-600 dark:text-zinc-300">
            {draft.guidedSuggestions.knowledgeCandidates.map((item) => (
              <li key={item.id} className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950">
                <p className="font-medium">{item.title}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {SOURCE_TYPE_LABELS[item.sourceType]}
                  </span>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    P{item.priority}
                  </span>
                </div>
                <p className="line-clamp-2 text-zinc-500">{item.content || "—"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Unmapped content
        </p>
        <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
          Lines the system couldn't map. Review and incorporate manually — nothing is discarded.
        </p>
        <textarea
          rows={6}
          value={draft.guidedUnmappedText}
          onChange={(event) => updateDraft({ guidedUnmappedText: event.target.value })}
          placeholder="Unmapped lines appear here for manual review. Nothing is silently discarded."
          className="mt-2 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </div>
    </div>
  );
}
