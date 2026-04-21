"use client";

import type { Dispatch } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AgentDraft, OutputMode, StructuredSection, WizardAction } from "@/hooks/useAgentWizard";
import { validateOutput } from "@/hooks/useAgentWizard";
import { SchemaFieldBuilder } from "./SchemaFieldBuilder";

const OUTPUT_MODES: Array<{ id: OutputMode; label: string; desc: string }> = [
  { id: "markdown", label: "Freeform Markdown", desc: "No structural constraints — agent writes freely in markdown." },
  { id: "structured-markdown", label: "Structured Markdown", desc: "Define required/optional sections the agent must follow." },
  { id: "json", label: "JSON", desc: "Agent returns valid JSON matching a schema you define." },
  { id: "template", label: "Template", desc: "Agent fills in a template with placeholder fields." },
];

let _sid = 0;
function nextSid() {
  return `s-${++_sid}-${Date.now()}`;
}

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
    const sec: StructuredSection = { id: nextSid(), title: "", required: true };
    dispatch({ type: "ADD_SECTION", section: sec });
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Output Rules</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Control the format and structure of the agent&apos;s responses.
        </p>
      </div>

      {/* Mode select */}
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
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{m.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Structured Markdown */}
      {draft.outputMode === "structured-markdown" ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Sections ({draft.structuredSections.length})
            </p>
            <button
              type="button"
              onClick={addSection}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Plus className="h-3 w-3" />
              Add section
            </button>
          </div>
          {draft.structuredSections.map((sec) => (
            <div key={sec.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
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
          <div>
            <label htmlFor="wiz-mkrules" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Additional formatting rules
            </label>
            <textarea
              id="wiz-mkrules"
              rows={3}
              value={draft.markdownRules}
              onChange={(e) => updateDraft({ markdownRules: e.target.value })}
              placeholder="Use bullet points within sections. Each section should have a concise heading…"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        </div>
      ) : null}

      {/* JSON */}
      {draft.outputMode === "json" ? (
        <SchemaFieldBuilder fields={draft.jsonSchema} dispatch={dispatch} />
      ) : null}

      {/* Template */}
      {draft.outputMode === "template" ? (
        <div>
          <label htmlFor="wiz-tmpl" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Template (use {"{{placeholder}}"} for dynamic fields)
          </label>
          <textarea
            id="wiz-tmpl"
            rows={8}
            value={draft.templateText}
            onChange={(e) => updateDraft({ templateText: e.target.value })}
            placeholder={"## {{section_title}}\n{{section_content}}\n\n---\nGenerated by {{agent_name}}"}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
        </div>
      ) : null}

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
