"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import useSWR from "swr";
import { Loader2, Check, AlertTriangle, Info, CheckCircle2, XCircle } from "lucide-react";
import { useAdminAgent } from "@/hooks/useAdminAgent";
import { useToast } from "@/components/ui/Toast";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import type { AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";
import { KnowledgeEditor } from "./KnowledgeEditor";
import { OutputEditor } from "./OutputEditor";

/* ------------------------------------------------------------------ */
/*  Tabs                                                               */
/* ------------------------------------------------------------------ */

const TABS = ["General", "Behavior", "Knowledge", "Output", "Starter Prompts", "Access"] as const;
type Tab = (typeof TABS)[number];
const TAB_GUIDANCE: Record<Tab, string> = {
  General: "Name, description, and how the agent appears to users.",
  Behavior: "System instructions, rules, tone, and generation controls.",
  Knowledge: "Reference material the agent can draw on.",
  Output: "Response format, depth, sections, and fallback behavior.",
  "Starter Prompts": "Quick-start suggestions users see when they open the agent.",
  Access: "Scope, team assignment, and publishing state.",
};

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

function SaveBar({ saving, onSave, disabled, dirty, tab, justSaved }: {
  saving: boolean;
  onSave: () => void;
  disabled: boolean;
  dirty: boolean;
  tab: string;
  justSaved: boolean;
}) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5 mt-6 flex items-center justify-between border-t border-zinc-200 bg-white/90 px-5 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90 sm:-mx-8 sm:px-8">
      <div className="flex items-center gap-3">
        {dirty ? (
          <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Unsaved changes in {tab}
          </span>
        ) : justSaved ? (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            Saved
          </span>
        ) : (
          <span className="text-xs text-zinc-400">No pending changes</span>
        )}
      </div>
      <button
        type="button"
        onClick={onSave}
        disabled={saving || disabled}
        className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {saving ? "Saving…" : `Save ${tab}`}
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
/*  Publish-readiness hints (shown when status = PUBLISHED)            */
/* ------------------------------------------------------------------ */

function EditReadinessHints({ form }: { form: Record<string, unknown> }) {
  type HintLevel = "blocking" | "recommended" | "confidence";
  const hints: { level: HintLevel; msg: string; fix: string }[] = [];

  const name = ((form.name as string) ?? "").trim();
  const desc = ((form.description as string) ?? "").trim();
  const prompt = ((form.systemPrompt as string) ?? "").trim();
  const items = (form.knowledgeItems as AgentKnowledgeItem[]) ?? [];
  const starters = (form.starterPrompts as string[]) ?? [];
  const oc = form.outputConfig as AgentOutputConfig | undefined;
  const scope = (form.scope as string) ?? "GLOBAL";
  const teamId = (form.teamId as string) ?? "";

  if (!name) hints.push({ level: "blocking", msg: "Agent has no name.", fix: "Go to General." });
  if (!prompt) hints.push({ level: "blocking", msg: "System prompt is empty.", fix: "Go to Behavior." });
  if (scope === "TEAM" && !teamId) hints.push({ level: "blocking", msg: "Team-scoped but no team assigned.", fix: "Assign a team below." });

  if (!desc) hints.push({ level: "recommended", msg: "No description — users can't tell what the agent does.", fix: "Add one in General." });
  if (oc?.citationsPolicy === "required" && items.length === 0) {
    hints.push({ level: "recommended", msg: "Citations required but no knowledge sources.", fix: "Add sources in Knowledge or change policy in Output." });
  }

  if (items.length === 0) hints.push({ level: "confidence", msg: "No knowledge sources.", fix: "Add sources in Knowledge for domain grounding." });
  if (!starters.some((p) => p.trim())) hints.push({ level: "confidence", msg: "No starter prompts.", fix: "Add prompts in Starter Prompts." });
  if (oc && !oc.fallbackBehavior?.trim()) hints.push({ level: "confidence", msg: "No fallback behavior defined.", fix: "Set fallback in Output." });

  if (hints.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Configuration looks complete for publishing.</p>
      </div>
    );
  }

  const blockCount = hints.filter((h) => h.level === "blocking").length;
  const icons: Record<HintLevel, React.ReactNode> = {
    blocking: <XCircle className="h-3 w-3 shrink-0 text-red-500" />,
    recommended: <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />,
    confidence: <Info className="h-3 w-3 shrink-0 text-zinc-400" />,
  };
  const colors: Record<HintLevel, string> = {
    blocking: "text-red-600 dark:text-red-300",
    recommended: "text-amber-700 dark:text-amber-300",
    confidence: "text-zinc-500 dark:text-zinc-400",
  };

  return (
    <div className={`rounded-xl border p-3 ${blockCount > 0 ? "border-red-200 bg-red-50/50 dark:border-red-900/60 dark:bg-red-950/10" : "border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/10"}`}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Publish readiness
      </p>
      <ul className="space-y-1.5">
        {hints.map((h) => (
          <li key={h.msg} className="flex items-start gap-1.5">
            {icons[h.level]}
            <span className={`text-[11px] ${colors[h.level]}`}>
              {h.msg} <span className="italic opacity-75">{h.fix}</span>
            </span>
          </li>
        ))}
      </ul>
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
  const [justSaved, setJustSaved] = useState(false);
  const justSavedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleTabSwitch(next: Tab) {
    if (next === tab) return;
    if (dirty) {
      const confirmed = window.confirm(
        `You have unsaved changes in ${tab}. Switch tabs and discard them?`
      );
      if (!confirmed) return;
    }
    setTab(next);
    setJustSaved(false);
  }

  const [form, setForm] = useState<Record<string, unknown>>({});
  const [initialized, setInitialized] = useState(false);
  const initialSnapshot = useRef<string>("");

  if (!initialized && agent) {
    const normalizedInputSchema = normalizeAgentInputSchema(agent.inputSchema);
    const init = {
      name: agent.name,
      description: agent.description ?? "",
      systemPrompt: agent.systemPrompt,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      outputFormat: agent.outputFormat,
      outputConfig: normalizedInputSchema.outputConfig,
      scope: agent.scope,
      teamId: agent.teamId ?? "",
      status: agent.status,
      starterPrompts: normalizedInputSchema.starterPrompts,
      knowledgeItems: normalizedInputSchema.knowledgeItems,
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
    ? "System instructions are required." : undefined;

  async function handleSave() {
    if (saving) return;
    if (nameError) { toast(nameError, "error"); return; }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {};

      if (tab === "General") {
        const name = (form.name as string)?.trim();
        if (!name) { toast("Name is required.", "error"); return; }
        body.name = name;
        body.description = (form.description as string)?.trim() || null;
      }

      if (tab === "Behavior") {
        const prompt = (form.systemPrompt as string)?.trim();
        if (!prompt) { toast("System instructions are required.", "error"); return; }
        body.systemPrompt = prompt;
        body.temperature = form.temperature;
        body.maxTokens = form.maxTokens;
      }

      if (tab === "Output") {
        const oc = form.outputConfig as AgentOutputConfig;
        if (oc.format === "template" && !oc.template?.trim()) {
          toast("Template mode requires a template body.", "error");
          return;
        }
        const sanitized: AgentOutputConfig = {
          ...oc,
          requiredSections: (oc.requiredSections ?? []).map((s) => s.trim()).filter(Boolean),
        };
        body.outputConfig = sanitized;
      }

      if (tab === "Access") {
        const scope = form.scope as string;
        const teamId = (form.teamId as string) || null;
        if (scope === "TEAM" && !teamId) {
          toast("Team-scoped agents require a team assignment.", "error");
          return;
        }
        body.scope = scope;
        body.teamId = teamId;
        body.status = form.status;
      }

      if (tab === "Knowledge") {
        const items = (form.knowledgeItems as AgentKnowledgeItem[]) ?? [];
        const validItems = items.filter(
          (item) =>
            item.title.trim().length > 0 &&
            ((item.content ?? "").trim().length > 0 || item.fileRef?.fileName)
        );
        body.knowledgeItems = validItems;
      }

      if (tab === "Starter Prompts") {
        const prompts = (form.starterPrompts as string[]).filter((p) => p.trim());
        body.starterPrompts = prompts;
      }

      if (Object.keys(body).length === 0) {
        toast("No changes detected in this tab.", "error");
        return;
      }

      await patchAgent(body);
      initialSnapshot.current = JSON.stringify(form);
      setDirty(false);
      setJustSaved(true);
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 4000);
      toast("Changes saved.");
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

      {/* Tabs */}
      <div className="-mx-1 flex gap-0.5 overflow-x-auto border-b border-zinc-200 px-1 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => handleTabSwitch(t)}
            aria-current={t === tab ? "page" : undefined}
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
        <p className="mb-5 text-xs text-zinc-500 dark:text-zinc-400">{TAB_GUIDANCE[tab]}</p>
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
            <Field label="Description" hint="A short description users see in the agent picker.">
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

        {tab === "Behavior" ? (() => {
          const promptLength = ((form.systemPrompt as string) ?? "").length;
          const promptLengthHint =
            promptLength === 0
              ? ""
              : promptLength < 50
              ? "Very short — consider adding more detail."
              : promptLength > 4000
              ? "Long prompt — keep it focused for best results."
              : `${promptLength.toLocaleString()} characters`;
          return (
            <div className="space-y-6">
              <Field label="System Instructions" required hint="Primary instructions that shape the agent's role and personality." error={promptError}>
                <textarea
                  rows={10}
                  value={(form.systemPrompt as string) ?? ""}
                  onChange={(e) => set("systemPrompt", e.target.value)}
                  className={inputCls + " font-mono text-xs leading-relaxed"}
                  placeholder="You are a…"
                />
                {promptLengthHint ? (
                  <p className={`mt-1.5 text-[11px] ${
                    promptLength < 50 || promptLength > 4000
                      ? "text-amber-500"
                      : "text-zinc-400"
                  }`}>
                    {promptLengthHint}
                  </p>
                ) : null}
              </Field>
              <div className="grid gap-6 sm:grid-cols-2">
                <Field label={`Temperature (${form.temperature ?? 0.4})`} hint="Lower = focused. Higher = creative.">
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
          );
        })() : null}

        {tab === "Knowledge" ? (
          <KnowledgeEditor
            items={(form.knowledgeItems as AgentKnowledgeItem[]) ?? []}
            onChange={(next) => set("knowledgeItems", next)}
          />
        ) : null}

        {tab === "Output" ? (
          <OutputEditor
            config={(form.outputConfig as AgentOutputConfig) ?? {
              format: "markdown",
              requiredSections: [],
              responseDepth: "standard",
              citationsPolicy: "none",
              fallbackBehavior: "",
              template: null,
              schema: null,
            }}
            onChange={(next) => set("outputConfig", next)}
          />
        ) : null}

        {tab === "Starter Prompts" ? (() => {
          const starters = (form.starterPrompts as string[]) ?? [];
          const filledCount = starters.filter((p) => p.trim()).length;
          return (
            <div className="space-y-4">
              {starters.length > 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    {filledCount} prompt{filledCount !== 1 ? "s" : ""} configured
                  </p>
                  {filledCount < 2 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      Aim for 2–4 prompts so users have meaningful choices.
                    </p>
                  ) : filledCount > 6 ? (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400">
                      More than 6 can feel overwhelming — consider trimming.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {starters.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-zinc-200 py-10 text-center dark:border-zinc-700">
                  <p className="text-sm font-medium text-zinc-400">No starters yet</p>
                  <p className="mt-1 text-xs text-zinc-400">
                    Add 2–4 prompts that showcase the agent's strengths. Users see these as quick-start options.
                  </p>
                  <button
                    type="button"
                    onClick={() => set("starterPrompts", [""])}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                  >
                    + Add first prompt
                  </button>
                </div>
              ) : null}

              {starters.map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="mt-2.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    {i + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={p}
                    onChange={(e) => {
                      const next = [...starters];
                      next[i] = e.target.value;
                      set("starterPrompts", next);
                    }}
                    className={inputCls + " flex-1"}
                    placeholder={
                      i === 0
                        ? "e.g. Summarize the key points of…"
                        : i === 1
                        ? "e.g. Compare the pros and cons of…"
                        : "Write a starter prompt…"
                    }
                  />
                  <button
                    type="button"
                    onClick={() => set("starterPrompts", starters.filter((_, idx) => idx !== i))}
                    className="mt-2 rounded-lg p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400"
                    aria-label="Remove prompt"
                  >
                    ×
                  </button>
                </div>
              ))}

              {starters.length > 0 ? (
                <button
                  type="button"
                  onClick={() => set("starterPrompts", [...starters, ""])}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  + Add prompt
                </button>
              ) : null}
            </div>
          );
        })() : null}

        {tab === "Access" ? (() => {
          const currentStatus = (form.status as string) ?? "DRAFT";
          const originalStatus = initialized ? (JSON.parse(initialSnapshot.current) as Record<string, unknown>).status as string : currentStatus;
          const isDemoting = originalStatus === "PUBLISHED" && (currentStatus === "DRAFT" || currentStatus === "ARCHIVED");
          const isArchiving = originalStatus !== "ARCHIVED" && currentStatus === "ARCHIVED";
          return (
            <div className="space-y-6">
              <Field label="Status" hint="Published = visible to users. Draft = hidden. Archived = retired.">
                <select
                  value={currentStatus}
                  onChange={(e) => set("status", e.target.value)}
                  className={inputCls}
                >
                  <option value="DRAFT">Draft</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </Field>

              {isDemoting ? (
                <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    This agent is currently published. Changing to {currentStatus.toLowerCase()} will remove it from all users immediately.
                  </p>
                </div>
              ) : null}

              {isArchiving && originalStatus !== "PUBLISHED" ? (
                <div className="flex items-start gap-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-400" />
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Archived agents are hidden but preserved. You can restore them later.
                  </p>
                </div>
              ) : null}

              {currentStatus === "PUBLISHED" ? (
                <EditReadinessHints form={form} />
              ) : null}

              <Field label="Scope" hint="Global = all users. Team = only members of the assigned team.">
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
          );
        })() : null}

        <SaveBar saving={saving} onSave={handleSave} disabled={!dirty} dirty={dirty} tab={tab} justSaved={justSaved} />
      </div>
    </div>
  );
}
