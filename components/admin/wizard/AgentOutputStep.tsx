"use client";

import type { Dispatch } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AgentDraft, OutputMode, StructuredSection, WizardAction } from "@/hooks/useAgentWizard";
import { validateOutput } from "@/hooks/useAgentWizard";
import {
  DEPTH_OPTIONS,
  CITATIONS_OPTIONS,
  FALLBACK_SUGGESTIONS,
  REQUIRED_SECTION_PRESETS,
  nextUid,
} from "@/lib/agentConstants";
import { ValidationWarnings } from "@/components/admin/shared/ConfigHealthStatus";
import { SchemaFieldBuilder } from "./SchemaFieldBuilder";

const OUTPUT_MODES: Array<{ id: OutputMode; label: string; desc: string }> = [
  {
    id: "markdown",
    label: "Freeform Markdown",
    desc: "No structural constraints — agent writes freely in markdown. Best for general-purpose agents.",
  },
  {
    id: "structured-markdown",
    label: "Structured Markdown",
    desc: "Define required/optional sections the agent must follow. Best for reports and analyses.",
  },
  {
    id: "json",
    label: "JSON",
    desc: "Agent returns valid JSON matching a schema you define. Best for API-style agents.",
  },
  {
    id: "template",
    label: "Template",
    desc: "Agent fills in a template with placeholder fields. Best for standardized outputs.",
  },
];

export function AgentOutputStep({
  draft,
  updateDraft,
  dispatch,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
  dispatch: Dispatch<WizardAction>;
}) {
  const errors = validateOutput(draft);

  function addSection() {
    const sec: StructuredSection = { id: nextUid("sec"), title: "", required: true };
    dispatch({ type: "ADD_SECTION", section: sec });
  }

  function addPresetSection(title: string) {
    const exists = draft.structuredSections.some(
      (s) => s.title.trim().toLowerCase() === title.toLowerCase()
    );
    if (exists) return;
    dispatch({
      type: "ADD_SECTION",
      section: { id: nextUid("sec"), title, required: true },
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Output</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Control response format, depth, required sections, and fallback behavior. This shapes every answer the agent gives.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        Format controls shape. Depth controls detail level. Fallback controls what happens when the agent can't fully satisfy the request.
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Current contract
        </p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {draft.outputMode.replace("-", " ")} · {draft.responseDepth} depth · citations {draft.citationsPolicy}
        </p>
      </div>

      {/* Response style */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Response style
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Choose how responses are shaped: open-ended, section-based, machine-readable, or template-filled.
          </p>
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Response format
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {OUTPUT_MODES.map((m) => {
            const active = draft.outputMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => updateDraft({ outputMode: m.id })}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-950/30"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <p className={`text-sm font-semibold ${active ? "text-violet-800 dark:text-violet-200" : "text-zinc-900 dark:text-zinc-100"}`}>
                  {m.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{m.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Response structure */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Response structure
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Set how much detail responses include and which sections appear consistently.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Response depth
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            How much detail each response should include.
          </p>
          <div className="space-y-2">
            {DEPTH_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                  draft.responseDepth === opt.value
                    ? "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/20"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="wiz-depth"
                  value={opt.value}
                  checked={draft.responseDepth === opt.value}
                  onChange={() => updateDraft({ responseDepth: opt.value })}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{opt.label}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{opt.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Citations policy
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Whether responses should reference attached knowledge sources.
          </p>
          <div className="space-y-2">
            {CITATIONS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                  draft.citationsPolicy === opt.value
                    ? "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/20"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="wiz-citations"
                  value={opt.value}
                  checked={draft.citationsPolicy === opt.value}
                  onChange={() => updateDraft({ citationsPolicy: opt.value })}
                  className="mt-0.5 h-4 w-4 accent-violet-600"
                />
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{opt.label}</p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{opt.hint}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      </div>
      </div>

      {/* Required/structured sections */}
      {draft.outputMode === "structured-markdown" || draft.outputMode === "markdown" ? (
        <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Required sections ({draft.structuredSections.length})
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                Sections that appear in every response. Users learn to expect them.
              </p>
            </div>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Plus className="h-3 w-3" />
              Add section
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {REQUIRED_SECTION_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => addPresetSection(preset)}
                className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-violet-600"
              >
                + {preset}
              </button>
            ))}
          </div>
          {draft.structuredSections.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
              No sections defined. Add sections for predictable, scannable responses.
            </p>
          ) : null}
          {draft.structuredSections.map((sec) => (
            <div
              key={sec.id}
              className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <input
                type="text"
                value={sec.title}
                onChange={(e) =>
                  updateDraft({
                    structuredSections: draft.structuredSections.map((s) =>
                      s.id === sec.id ? { ...s, title: e.target.value } : s
                    ),
                  })
                }
                placeholder="Section title"
                className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sec.required}
                  onChange={(e) =>
                    updateDraft({
                      structuredSections: draft.structuredSections.map((s) =>
                        s.id === sec.id ? { ...s, required: e.target.checked } : s
                      ),
                    })
                  }
                  className="h-4 w-4 rounded accent-violet-600"
                />
                Required
              </label>
              <button
                type="button"
                onClick={() => dispatch({ type: "REMOVE_SECTION", id: sec.id })}
                className="rounded-lg p-2 text-zinc-400 hover:text-red-600"
                aria-label="Remove section"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {/* Formatting rules — markdown modes */}
      {draft.outputMode === "structured-markdown" || draft.outputMode === "markdown" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <label
            htmlFor="wiz-mkrules"
            className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Additional formatting rules
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Additional rules for heading style, list formatting, or paragraph length.
          </p>
          <textarea
            id="wiz-mkrules"
            rows={3}
            value={draft.markdownRules}
            onChange={(e) => updateDraft({ markdownRules: e.target.value })}
            placeholder="Use concise headings, avoid very long lists, keep sections skimmable."
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      ) : null}

      {/* JSON schema builder */}
      {draft.outputMode === "json" ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              JSON schema
            </p>
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              Define the fields every JSON response must include.
            </p>
          </div>
          <SchemaFieldBuilder fields={draft.jsonSchema} dispatch={dispatch} />
        </div>
      ) : null}

      {/* Template */}
      {draft.outputMode === "template" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Template body
          </p>
          <label htmlFor="wiz-tmpl" className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Template body
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            {"Define the template the agent fills in. Use {{placeholder}} for dynamic fields."}
          </p>
          <textarea
            id="wiz-tmpl"
            rows={8}
            value={draft.templateText}
            onChange={(e) => updateDraft({ templateText: e.target.value })}
            placeholder={"## {{section_title}}\n{{section_content}}\n\n---\nGenerated by {{agent_name}}"}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <p className="mt-1 text-[11px] text-zinc-400">
            Keep placeholder names stable (for example: {"{{customer_name}}"} ) to reduce formatting drift.
          </p>
        </div>
      ) : null}

      {/* Source and citation behavior */}
      <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Citation behavior
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          How strongly responses should reference knowledge sources.
        </p>
        {draft.citationsPolicy === "required" ? (
          <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300">
            Users will see source references in every response when the agent can provide them.
          </p>
        ) : null}
      </div>

      {/* Uncertainty handling */}
      <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Uncertainty handling
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          What should the agent do when it can't fully answer — ask a question, give a partial answer, or decline?
        </p>
        <label
          htmlFor="wiz-fallback"
          className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Fallback behavior
        </label>
        <textarea
          id="wiz-fallback"
          rows={3}
          value={draft.fallbackBehavior}
          onChange={(event) => updateDraft({ fallbackBehavior: event.target.value })}
          placeholder="If constraints cannot be satisfied, explain what is missing and provide a best-effort response."
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FALLBACK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                const current = draft.fallbackBehavior.trim();
                const next = current ? `${current}\n${suggestion}` : suggestion;
                updateDraft({ fallbackBehavior: next });
              }}
              className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-violet-600"
            >
              + {suggestion}
            </button>
          ))}
        </div>
      </div>

      <ValidationWarnings errors={errors} />
    </div>
  );
}
