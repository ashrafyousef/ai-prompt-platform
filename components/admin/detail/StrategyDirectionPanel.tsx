"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentSummaryCard } from "./AgentSummaryCard";
import {
  STRATEGY_FIELD_DEFINITIONS,
  emptyStrategyDocument,
  type StrategyDocumentV1,
  type StrategyFieldKey,
} from "@/lib/strategyDocument";
import {
  STRATEGY_MARK_READY_CONFIRM_MESSAGE,
  STRATEGY_PREFILLED_BADGE_LABEL,
  areStrategyFieldsDirty,
  formatStrategyReadOnlyValue,
  isStrategyPrefilledField,
} from "@/lib/strategyUi";

type StrategyStatus = "DRAFT" | "READY_FOR_CREATIVE" | "ARCHIVED";

type StrategySummary = {
  id: string;
  projectId: string;
  sourceBriefId: string;
  status: StrategyStatus;
  responsesJson: StrategyDocumentV1;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function apiError(data: { error?: string; message?: string }, fallback: string): string {
  return data.message ?? data.error ?? fallback;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PrefilledBadge() {
  return (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
      {STRATEGY_PREFILLED_BADGE_LABEL}
    </span>
  );
}

function FieldLabel({ label, prefilled }: { label: string; prefilled: boolean }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
      {prefilled ? <PrefilledBadge /> : null}
    </div>
  );
}

function ReadOnlyStrategyField({
  label,
  value,
  prefilled,
}: {
  label: string;
  value: string;
  prefilled: boolean;
}) {
  return (
    <div className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-zinc-400">{label}</div>
        {prefilled ? <PrefilledBadge /> : null}
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {formatStrategyReadOnlyValue(value)}
      </p>
    </div>
  );
}

function syncFieldsFromStrategy(strategy: StrategySummary | null): StrategyDocumentV1["fields"] {
  return strategy?.responsesJson.fields ?? emptyStrategyDocument().fields;
}

export function StrategyDirectionPanel({
  projectId,
  initialStrategy,
}: {
  projectId: string;
  initialStrategy: StrategySummary | null;
}) {
  const [strategy, setStrategy] = useState<StrategySummary | null>(initialStrategy);
  const [fields, setFields] = useState<StrategyDocumentV1["fields"]>(
    syncFieldsFromStrategy(initialStrategy)
  );
  const [savedFields, setSavedFields] = useState<StrategyDocumentV1["fields"]>(
    syncFieldsFromStrategy(initialStrategy)
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const applyStrategy = useCallback((next: StrategySummary | null) => {
    const nextFields = syncFieldsFromStrategy(next);
    setStrategy(next);
    setFields(nextFields);
    setSavedFields(nextFields);
  }, []);

  useEffect(() => {
    applyStrategy(initialStrategy);
  }, [initialStrategy, applyStrategy]);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/strategy`);
      const data = (await res.json()) as { error?: string; message?: string; strategy?: StrategySummary };
      if (res.status === 404) {
        applyStrategy(null);
        return;
      }
      if (!res.ok || !data.strategy) {
        setError(apiError(data, "Failed to load strategy."));
        return;
      }
      applyStrategy(data.strategy);
    } catch {
      setError("Failed to load strategy.");
    } finally {
      setLoading(false);
    }
  }, [projectId, applyStrategy]);

  useEffect(() => {
    if (initialStrategy) return;
    void loadStrategy();
  }, [initialStrategy, loadStrategy]);

  const isDraft = strategy?.status === "DRAFT";
  const readOnly = strategy?.status === "READY_FOR_CREATIVE" || strategy?.status === "ARCHIVED";
  const dirty = isDraft && areStrategyFieldsDirty(savedFields, fields);

  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function onCreateStrategy() {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/strategy`, {
        method: "POST",
      });
      const data = (await res.json()) as { error?: string; message?: string; strategy?: StrategySummary };
      if (res.status === 409) {
        setSuccess("A strategy already exists for this project.");
        await loadStrategy();
        return;
      }
      if (!res.ok || !data.strategy) {
        setError(apiError(data, "Failed to create strategy."));
        return;
      }
      applyStrategy(data.strategy);
      setSuccess("Strategy direction created.");
    } catch {
      setError("Failed to create strategy.");
    } finally {
      setCreating(false);
    }
  }

  async function onSaveDraft() {
    if (!strategy) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/strategies/${encodeURIComponent(strategy.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsesJson: { fields },
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string; strategy?: StrategySummary };
      if (!res.ok || !data.strategy) {
        setError(apiError(data, "Failed to save strategy draft."));
        return;
      }
      applyStrategy(data.strategy);
      setSuccess("Strategy draft saved.");
    } catch {
      setError("Failed to save strategy draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onMarkReady() {
    if (!strategy) return;
    if (!window.confirm(STRATEGY_MARK_READY_CONFIRM_MESSAGE)) return;

    setMarkingReady(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/strategies/${encodeURIComponent(strategy.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY_FOR_CREATIVE" }),
      });
      const data = (await res.json()) as { error?: string; message?: string; strategy?: StrategySummary };
      if (!res.ok || !data.strategy) {
        setError(apiError(data, "Failed to mark strategy ready."));
        return;
      }
      applyStrategy(data.strategy);
      setSuccess("Strategy marked ready for creative.");
    } catch {
      setError("Failed to mark strategy ready.");
    } finally {
      setMarkingReady(false);
    }
  }

  const groups = useMemo(() => {
    const map = new Map<string, Array<(typeof STRATEGY_FIELD_DEFINITIONS)[number]>>();
    for (const def of STRATEGY_FIELD_DEFINITIONS) {
      const existing = map.get(def.group) ?? [];
      existing.push(def);
      map.set(def.group, existing);
    }
    return Array.from(map.entries());
  }, []);

  return (
    <AgentSummaryCard
      title="Strategy Direction"
      actions={
        strategy && isDraft ? (
          <div className="flex flex-wrap items-center gap-2">
            {dirty ? (
              <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                Unsaved changes
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => void onSaveDraft()}
              disabled={saving || markingReady || !dirty}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => void onMarkReady()}
              disabled={saving || markingReady || dirty}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {markingReady ? "Marking..." : "Mark Ready for Creative"}
            </button>
          </div>
        ) : null
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            {success}
          </div>
        ) : null}

        {!strategy ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No strategy direction exists yet for this approved brief.
            </p>
            <button
              type="button"
              onClick={() => void onCreateStrategy()}
              disabled={creating || loading}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {creating ? "Creating..." : "Create Strategy Direction"}
            </button>
          </div>
        ) : (
          <>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="flex items-baseline justify-between gap-4 py-1.5">
                <span className="text-xs text-zinc-400">Status</span>
                <span className="text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">
                  {strategy.status === "READY_FOR_CREATIVE" ? "Ready for Creative" : "Draft"}
                </span>
              </div>
              {strategy.readyAt ? (
                <div className="flex items-baseline justify-between gap-4 py-1.5">
                  <span className="text-xs text-zinc-400">Ready at</span>
                  <span className="text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {formatDateTime(strategy.readyAt)}
                  </span>
                </div>
              ) : null}
            </div>

            {groups.map(([groupName, defs]) => (
              <div key={groupName} className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {groupName}
                </h3>
                {readOnly ? (
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {defs.map((def) => (
                      <ReadOnlyStrategyField
                        key={def.key}
                        label={def.label}
                        value={fields[def.key as StrategyFieldKey]}
                        prefilled={isStrategyPrefilledField(def.key)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {defs.map((def) => (
                      <label key={def.key} className="block">
                        <FieldLabel
                          label={def.label}
                          prefilled={isStrategyPrefilledField(def.key)}
                        />
                        <textarea
                          value={fields[def.key as StrategyFieldKey]}
                          onChange={(event) =>
                            setFields((prev) => ({
                              ...prev,
                              [def.key]: event.target.value,
                            }))
                          }
                          disabled={saving || markingReady}
                          rows={4}
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </AgentSummaryCard>
  );
}
