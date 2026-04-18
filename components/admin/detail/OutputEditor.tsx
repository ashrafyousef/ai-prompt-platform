"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AgentOutputConfig } from "@/lib/agentConfig";
import {
  DEPTH_OPTIONS,
  CITATIONS_OPTIONS,
  FALLBACK_SUGGESTIONS,
  REQUIRED_SECTION_PRESETS,
  validateOutputConfig,
} from "@/lib/agentConstants";
import { ValidationWarnings } from "@/components/admin/shared/ConfigHealthStatus";

type OutputFormat = AgentOutputConfig["format"];

const FORMAT_OPTIONS: Array<{ id: OutputFormat; label: string; desc: string }> = [
  {
    id: "markdown",
    label: "Markdown",
    desc: "Agent responds in freeform or structured markdown. Best for general-purpose agents.",
  },
  {
    id: "json",
    label: "JSON",
    desc: "Agent returns valid JSON. Use for API-style agents that feed into other systems.",
  },
  {
    id: "template",
    label: "Template",
    desc: "Agent fills in a template with placeholders. Use for standardized reports or forms.",
  },
];

const inputCls =
  "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

export function OutputEditor({
  config,
  onChange,
}: {
  config: AgentOutputConfig;
  onChange: (next: AgentOutputConfig) => void;
}) {
  const [sectionInput, setSectionInput] = useState("");
  const errors = validateOutputConfig(config);

  function patch(p: Partial<AgentOutputConfig>) {
    onChange({ ...config, ...p });
  }

  function addSection() {
    const title = sectionInput.trim();
    if (!title) return;
    if (config.requiredSections.includes(title)) return;
    patch({ requiredSections: [...config.requiredSections, title] });
    setSectionInput("");
  }

  function removeSection(idx: number) {
    patch({ requiredSections: config.requiredSections.filter((_, i) => i !== idx) });
  }

  function addPresetSection(title: string) {
    const exists = config.requiredSections.some(
      (s) => s.trim().toLowerCase() === title.toLowerCase()
    );
    if (exists) return;
    patch({ requiredSections: [...config.requiredSections, title] });
  }

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Current contract
        </p>
        <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
          {config.format} · {config.responseDepth} depth · citations {config.citationsPolicy}
        </p>
      </div>

      {/* Response style */}
      <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Response style
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            Choose the overall answer shape users will consistently receive.
          </p>
        </div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Response format
        </p>
        <p className="mb-3 text-xs text-zinc-400 dark:text-zinc-500">
          Determines the structural contract of the agent's output. This shapes how the LLM formats every response.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {FORMAT_OPTIONS.map((opt) => {
            const active = config.format === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => patch({ format: opt.id })}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  active
                    ? "border-violet-500 bg-violet-50/50 dark:border-violet-400 dark:bg-violet-950/30"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <p
                  className={`text-sm font-semibold ${
                    active ? "text-violet-800 dark:text-violet-200" : "text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  {opt.label}
                </p>
                <p className="mt-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">
                  {opt.desc}
                </p>
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
            Tune detail level and structure so responses are predictable and easy to consume.
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Response depth
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Controls how much detail the agent provides. Affects system prompt framing.
          </p>
          <div className="space-y-2">
            {DEPTH_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                  config.responseDepth === opt.value
                    ? "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/20"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="responseDepth"
                  value={opt.value}
                  checked={config.responseDepth === opt.value}
                  onChange={() => patch({ responseDepth: opt.value })}
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
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Citations policy
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Whether the agent should reference its knowledge sources in responses.
          </p>
          <div className="space-y-2">
            {CITATIONS_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 transition ${
                  config.citationsPolicy === opt.value
                    ? "border-violet-500 bg-violet-50/40 dark:border-violet-400 dark:bg-violet-950/20"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="radio"
                  name="citationsPolicy"
                  value={opt.value}
                  checked={config.citationsPolicy === opt.value}
                  onChange={() => patch({ citationsPolicy: opt.value })}
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

      {/* Required sections — markdown and structured-markdown */}
      {config.format === "markdown" ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Required sections
          </label>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Add sections users should always see. Leave empty only for fully freeform markdown.
          </p>
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

          {config.requiredSections.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {config.requiredSections.map((sec, idx) => (
                <li
                  key={`${sec}-${idx}`}
                  className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                >
                  <span className="flex-1 text-sm text-zinc-800 dark:text-zinc-200">{sec}</span>
                  <button
                    type="button"
                    onClick={() => removeSection(idx)}
                    className="rounded-lg p-1 text-zinc-400 hover:text-red-600 dark:hover:text-red-400"
                    aria-label="Remove section"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex gap-2">
            <input
              type="text"
              value={sectionInput}
              onChange={(e) => setSectionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addSection();
                }
              }}
              placeholder="Add a section name…"
              className={inputCls + " flex-1"}
            />
            <button
              type="button"
              onClick={addSection}
              disabled={!sectionInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </button>
          </div>
        </div>
      ) : null}

      {/* Template body — conditional */}
      {config.format === "template" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Template body
          </p>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Define the exact response frame. Use {"{{placeholder}}"} tokens for dynamic values.
          </p>
          <textarea
            rows={8}
            value={config.template ?? ""}
            onChange={(e) => patch({ template: e.target.value })}
            placeholder={"## {{section_title}}\n{{section_content}}\n\n---\nGenerated by {{agent_name}}"}
            className={inputCls + " font-mono text-xs leading-relaxed"}
          />
          {!config.template?.trim() ? (
            <p className="text-[11px] text-amber-500">Template mode requires a body. Add one before saving.</p>
          ) : null}
        </div>
      ) : null}

      {/* JSON schema — conditional */}
      {config.format === "json" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            JSON schema
          </p>
          <p className="mb-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            Optional. Define expected keys so downstream consumers receive consistent structured fields.
          </p>
          <textarea
            rows={8}
            value={config.schema ? JSON.stringify(config.schema, null, 2) : ""}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (!raw) {
                patch({ schema: null });
                return;
              }
              try {
                patch({ schema: JSON.parse(raw) });
              } catch {
                // Allow typing invalid JSON — only persist when valid
              }
            }}
            placeholder={'{\n  "type": "object",\n  "properties": {\n    "summary": { "type": "string" }\n  }\n}'}
            className={inputCls + " font-mono text-xs leading-relaxed"}
          />
        </div>
      ) : null}

      {/* Citation behavior summary */}
      {config.citationsPolicy !== "none" ? (
        <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Citation behavior
          </p>
          <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-300">
            {config.citationsPolicy === "required"
              ? "Responses will include source references when knowledge is available."
              : "Responses may include source references when the agent considers them useful."}
          </p>
        </div>
      ) : null}

      {/* Uncertainty handling */}
      <div className="space-y-2 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-950/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Uncertainty handling
        </p>
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Defines behavior for missing data, ambiguous prompts, or incompatible output constraints.
        </p>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Fallback behavior
        </label>
        <textarea
          rows={3}
          value={config.fallbackBehavior}
          onChange={(e) => patch({ fallbackBehavior: e.target.value })}
          placeholder="Explain what is missing, then provide a best-effort response."
          className={inputCls}
        />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FALLBACK_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => {
                const current = config.fallbackBehavior.trim();
                const next = current ? `${current}\n${suggestion}` : suggestion;
                patch({ fallbackBehavior: next });
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
