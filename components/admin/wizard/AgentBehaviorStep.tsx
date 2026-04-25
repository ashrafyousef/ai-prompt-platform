"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { AgentDraft } from "@/hooks/useAgentWizard";

function Textarea({
  id,
  label,
  helper,
  placeholder,
  value,
  onChange,
  rows = 4,
}: {
  id: string;
  label: string;
  helper: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">{helper}</p>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      />
    </div>
  );
}

export function AgentBehaviorStep({
  draft,
  updateDraft,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const warnings: string[] = [];
  if (!draft.systemInstructions.trim()) warnings.push("System instructions are empty — the agent won't have core guidance.");
  if (draft.systemInstructions.length > 0 && draft.systemInstructions.length < 40)
    warnings.push("Instructions seem very short; consider being more specific.");
  if (draft.avoidRules && draft.systemInstructions.includes(draft.avoidRules.slice(0, 30)))
    warnings.push("Avoid rules overlap with system instructions — check for contradictions.");

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Behavior & Instructions</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Define <strong>how</strong> the agent responds. Knowledge is about <em>what</em> the agent knows (next step).
        </p>
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
          These settings feed the effective runtime prompt interpretation shown in detail/test views.
        </p>
      </div>

      <Textarea
        id="wiz-sys"
        label="System Instructions *"
        helper="The core instructions given to the LLM. This shapes the agent's personality and role."
        placeholder="You are a professional copywriter who creates compelling marketing content…"
        value={draft.systemInstructions}
        onChange={(v) => updateDraft({ systemInstructions: v })}
        rows={6}
      />

      <Textarea
        id="wiz-rules"
        label="Behavior Rules"
        helper="Specific rules for responses (structure, formatting, scope)."
        placeholder="Always include 3 variant options. Keep responses under 300 words…"
        value={draft.behaviorRules}
        onChange={(v) => updateDraft({ behaviorRules: v })}
      />

      <Textarea
        id="wiz-tone"
        label="Tone & Style"
        helper="Describe the voice and style the agent should use."
        placeholder="Professional but approachable. Avoid jargon. Use active voice…"
        value={draft.toneGuidance}
        onChange={(v) => updateDraft({ toneGuidance: v })}
        rows={3}
      />

      <Textarea
        id="wiz-avoid"
        label="What to Avoid"
        helper="Things the agent must not do or say."
        placeholder="Never invent statistics. Avoid unverified claims. Don't apologize excessively…"
        value={draft.avoidRules}
        onChange={(v) => updateDraft({ avoidRules: v })}
        rows={3}
      />

      {/* Warnings */}
      {warnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            Suggestions
          </div>
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">
            {warnings.map((w) => (
              <li key={w}>• {w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Advanced */}
      <div className="border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Advanced settings
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showAdvanced ? (
          <div className="mt-5 grid gap-6 sm:grid-cols-3">
            <div>
              <label htmlFor="wiz-temp" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Temperature ({draft.temperature})
              </label>
              <input
                id="wiz-temp"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={draft.temperature}
                onChange={(e) => updateDraft({ temperature: parseFloat(e.target.value) })}
                className="w-full accent-violet-600"
              />
              <p className="mt-1 text-[11px] text-zinc-400">Low = focused, High = creative</p>
            </div>
            <div>
              <label htmlFor="wiz-tok" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Max tokens
              </label>
              <input
                id="wiz-tok"
                type="number"
                min={100}
                max={4096}
                step={50}
                value={draft.maxTokens}
                onChange={(e) => updateDraft({ maxTokens: parseInt(e.target.value) || 800 })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.strictMode}
                  onChange={(e) => updateDraft({ strictMode: e.target.checked })}
                  className="h-4 w-4 rounded border-zinc-300 accent-violet-600"
                />
                Strict response mode
              </label>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
