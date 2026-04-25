"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { useAdminAgent } from "@/hooks/useAdminAgent";
import { useToast } from "@/components/ui/Toast";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = ["General", "Behavior", "Knowledge", "Output", "Starter Prompts", "Access"] as const;
type Tab = (typeof TABS)[number];

/* ------------------------------------------------------------------ */
/*  Teams fetcher                                                      */
/* ------------------------------------------------------------------ */

const teamFetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  return data as { teams: { id: string; name: string }[] };
};

/* ------------------------------------------------------------------ */
/*  Reusable field helpers                                             */
/* ------------------------------------------------------------------ */

function Field({ label, required, hint, error, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label} {required ? <span className="text-red-500">*</span> : null}
      </label>
      {hint ? <p className="mb-2 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p> : null}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertTriangle className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}

const inputCls = "w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100";

/* ------------------------------------------------------------------ */
/*  Save bar                                                           */
/* ------------------------------------------------------------------ */

function SaveBar({ saving, onSave, disabled, dirty }: {
  saving: boolean;
  onSave: () => void;
  disabled: boolean;
  dirty: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex items-center justify-between border-t border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-8 sm:px-8">
      {dirty ? (
        <span className="text-xs text-amber-600 dark:text-amber-400">You have unsaved changes</span>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        Save changes
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Skeleton                                                           */
/* ------------------------------------------------------------------ */

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-7 w-64 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800" />)}
      </div>
      <div className="h-72 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main                                                               */
/* ------------------------------------------------------------------ */

export function AgentEditPage({ agentId }: { agentId: string }) {
  const { agent, isLoading, error, patchAgent } = useAdminAgent(agentId);
  const { toast } = useToast();
  const { data: teamsData } = useSWR("/api/admin/teams", teamFetcher);
  const teams = teamsData?.teams ?? [];

  const [tab, setTab] = useState<Tab>("General");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [initialized, setInitialized] = useState(false);
  const initialSnapshot = useRef<string>("");

  if (!initialized && agent) {
    const init = {
      name: agent.name,
      description: agent.description ?? "",
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      outputFormat: agent.effectiveConfig?.outputConfig.format ?? agent.outputFormat,
      scope: agent.scope,
      teamId: agent.teamId ?? "",
      status: agent.status,
      starterPrompts:
        (agent.effectiveConfig?.starterPrompts ?? []).map((prompt) => prompt.prompt) ?? [],
    };
    setForm(init);
    initialSnapshot.current = JSON.stringify(init);
    setInitialized(true);
  }

  useEffect(() => {
    if (!initialized) return;
    setDirty(JSON.stringify(form) !== initialSnapshot.current);
  }, [form, initialized]);

  const set = useCallback((k: string, v: unknown) => setForm((p) => ({ ...p, [k]: v })), []);

  const nameError = initialized && !(form.name as string)?.trim() ? "Name is required." : undefined;
  const promptError = initialized && tab === "Behavior" && !(form.systemPrompt as string)?.trim()
    ? "System prompt cannot be empty." : undefined;

  async function handleSave() {
    if (nameError) { toast(nameError, "error"); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};

      if (tab === "General") {
        body.name = (form.name as string)?.trim();
        body.description = (form.description as string)?.trim() || null;
      }
      if (tab === "Behavior") {
        body.systemPrompt = form.systemPrompt;
        body.temperature = form.temperature;
        body.maxTokens = form.maxTokens;
      }
      if (tab === "Output") {
        body.outputFormat = form.outputFormat;
      }
      if (tab === "Access") {
        body.scope = form.scope;
        body.teamId = (form.teamId as string) || null;
        body.status = form.status;
      }
      if (tab === "Starter Prompts") {
        const prompts = (form.starterPrompts as string[]).filter((p) => p.trim());
        const inputSchema = agent?.inputSchema as Record<string, unknown> | null;
        body.inputSchema = { ...(inputSchema ?? {}), starterPrompts: prompts };
      }

      if (Object.keys(body).length === 0) {
        toast("No changes to save for this section", "error");
        return;
      }

      await patchAgent(body);
      initialSnapshot.current = JSON.stringify(form);
      setDirty(false);
      toast("Changes saved successfully");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <Skeleton />;
  if (error || !agent) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Agent not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Agents", href: "/admin/agents" },
          { label: agent.name, href: `/admin/agents/${agent.id}` },
          { label: "Edit" },
        ]}
      />

      <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Edit {agent.name}</h1>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        Detail and test views show the <span className="font-medium">effective normalized configuration</span> used for runtime interpretation.
      </div>

      {/* Tabs */}
      <div className="-mx-1 flex gap-0.5 overflow-x-auto border-b border-zinc-200 px-1 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              t === tab
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 sm:p-8">
        {tab === "General" ? (
          <div className="space-y-6">
            <Field label="Name" required error={nameError}>
              <input
                type="text"
                value={(form.name as string) ?? ""}
                onChange={(e) => set("name", e.target.value)}
                className={inputCls}
                placeholder="Agent name"
              />
            </Field>
            <Field label="Description" hint="A short public description users will see.">
              <textarea
                rows={3}
                value={(form.description as string) ?? ""}
                onChange={(e) => set("description", e.target.value)}
                className={inputCls}
                placeholder="What does this agent do?"
              />
            </Field>
          </div>
        ) : null}

        {tab === "Behavior" ? (
          <div className="space-y-6">
            <Field label="System Prompt" required hint="The core instructions given to the LLM." error={promptError}>
              <textarea
                rows={10}
                value={(form.systemPrompt as string) ?? ""}
                onChange={(e) => set("systemPrompt", e.target.value)}
                className={inputCls + " font-mono text-xs leading-relaxed"}
                placeholder="You are a…"
              />
            </Field>
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label={`Temperature (${form.temperature ?? 0.4})`} hint="Low = focused, High = creative">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={(form.temperature as number) ?? 0.4}
                  onChange={(e) => set("temperature", parseFloat(e.target.value))}
                  className="w-full accent-violet-600"
                />
              </Field>
              <Field label="Max tokens">
                <input
                  type="number"
                  min={100}
                  max={8192}
                  step={50}
                  value={(form.maxTokens as number) ?? 800}
                  onChange={(e) => set("maxTokens", parseInt(e.target.value) || 800)}
                  className={inputCls}
                />
              </Field>
            </div>
          </div>
        ) : null}

        {tab === "Knowledge" ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Knowledge is shown here as an effective snapshot for review. Inline editing is currently managed in the create/import workflow.
              </p>
            </div>
            {(() => {
              const schema = agent.inputSchema as Record<string, unknown> | null;
              const knowledge = (schema?.knowledge ?? []) as Array<{ type: string; title: string; content: string }>;
              if (knowledge.length === 0) {
                return (
                  <div className="rounded-xl border-2 border-dashed border-zinc-200 py-10 text-center dark:border-zinc-700">
                    <p className="text-sm font-medium text-zinc-400">No knowledge sources attached.</p>
                    <p className="mt-1 text-xs text-zinc-400">Add knowledge when creating or duplicating this agent.</p>
                  </div>
                );
              }
              return (
                <ul className="space-y-2">
                  {knowledge.map((k, i) => (
                    <li key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                      <p className="font-medium text-zinc-800 dark:text-zinc-200">{k.title}</p>
                      <p className="text-xs text-zinc-500">{k.type} · {(k.content.length / 1000).toFixed(1)}k chars</p>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        ) : null}

        {tab === "Output" ? (
          <div className="space-y-6">
            <Field label="Output format" hint="Controls how the agent structures its responses.">
              <select
                value={(form.outputFormat as string) ?? "markdown"}
                onChange={(e) => set("outputFormat", e.target.value)}
                className={inputCls}
              >
                <option value="markdown">Markdown</option>
                <option value="json">JSON</option>
                <option value="template">Template</option>
              </select>
            </Field>
            {agent.outputSchema ? (
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Current Schema</p>
                <pre className="max-h-48 overflow-auto rounded-xl bg-zinc-900 p-4 text-[11px] leading-relaxed text-zinc-300">
                  {JSON.stringify(agent.outputSchema, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === "Starter Prompts" ? (
          <div className="space-y-4">
            {((form.starterPrompts as string[]) ?? []).length === 0 ? (
              <div className="rounded-xl border-2 border-dashed border-zinc-200 py-10 text-center dark:border-zinc-700">
                <p className="text-sm font-medium text-zinc-400">No starter prompts yet.</p>
                <p className="mt-1 text-xs text-zinc-400">Add prompts users will see as quick-start suggestions.</p>
              </div>
            ) : null}
            {((form.starterPrompts as string[]) ?? []).map((p: string, i: number) => (
              <div key={i} className="flex items-start gap-3">
                <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {i + 1}
                </span>
                <textarea
                  rows={2}
                  value={p}
                  onChange={(e) => {
                    const next = [...(form.starterPrompts as string[])];
                    next[i] = e.target.value;
                    set("starterPrompts", next);
                  }}
                  className={inputCls + " flex-1"}
                  placeholder="Write a starter prompt…"
                />
                <button
                  type="button"
                  onClick={() => set("starterPrompts", (form.starterPrompts as string[]).filter((_, idx) => idx !== i))}
                  className="mt-2 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                  aria-label="Remove prompt"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => set("starterPrompts", [...((form.starterPrompts as string[]) ?? []), ""])}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              + Add prompt
            </button>
          </div>
        ) : null}

        {tab === "Access" ? (
          <div className="space-y-6">
            <Field label="Status" hint="Published agents are available to users. Draft agents are hidden.">
              <select
                value={(form.status as string) ?? "DRAFT"}
                onChange={(e) => set("status", e.target.value)}
                className={inputCls}
              >
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </Field>
            <Field label="Scope" hint="Team-scoped agents are only visible to members of the assigned team.">
              <select
                value={(form.scope as string) ?? "GLOBAL"}
                onChange={(e) => set("scope", e.target.value)}
                className={inputCls}
              >
                <option value="GLOBAL">Global</option>
                <option value="TEAM">Team</option>
              </select>
            </Field>
            {form.scope === "TEAM" ? (
              <Field label="Team" required>
                <select
                  value={(form.teamId as string) ?? ""}
                  onChange={(e) => set("teamId", e.target.value)}
                  className={inputCls}
                >
                  <option value="">— Select team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </Field>
            ) : null}
          </div>
        ) : null}

        <SaveBar saving={saving} onSave={handleSave} disabled={tab === "Knowledge"} dirty={dirty} />
      </div>
    </div>
  );
}
