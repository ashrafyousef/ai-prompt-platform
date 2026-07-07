"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AgentSummaryCard } from "./AgentSummaryCard";
import {
  STRATEGY_FIELD_DEFINITIONS,
  emptyStrategyDocument,
  type StrategyDocumentV1,
  type StrategyFieldKey,
} from "@/lib/strategyDocument";

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

export function StrategyDirectionPanel({
  projectId,
  initialStrategy,
}: {
  projectId: string;
  initialStrategy: StrategySummary | null;
}) {
  const [strategy, setStrategy] = useState<StrategySummary | null>(initialStrategy);
  const [fields, setFields] = useState<StrategyDocumentV1["fields"]>(
    initialStrategy?.responsesJson.fields ?? emptyStrategyDocument().fields
  );
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setStrategy(initialStrategy);
    setFields(initialStrategy?.responsesJson.fields ?? emptyStrategyDocument().fields);
  }, [initialStrategy]);

  const loadStrategy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/strategy`);
      const data = (await res.json()) as { error?: string; message?: string; strategy?: StrategySummary };
      if (res.status === 404) {
        setStrategy(null);
        setFields(emptyStrategyDocument().fields);
        return;
      }
      if (!res.ok || !data.strategy) {
        setError(apiError(data, "Failed to load strategy."));
        return;
      }
      setStrategy(data.strategy);
      setFields(data.strategy.responsesJson.fields);
    } catch {
      setError("Failed to load strategy.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (initialStrategy) return;
    void loadStrategy();
  }, [initialStrategy, loadStrategy]);

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
      setStrategy(data.strategy);
      setFields(data.strategy.responsesJson.fields);
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
      setStrategy(data.strategy);
      setFields(data.strategy.responsesJson.fields);
      setSuccess("Strategy draft saved.");
    } catch {
      setError("Failed to save strategy draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onMarkReady() {
    if (!strategy) return;
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
      setStrategy(data.strategy);
      setFields(data.strategy.responsesJson.fields);
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

  const readOnly = strategy?.status === "READY_FOR_CREATIVE" || strategy?.status === "ARCHIVED";

  return (
    <AgentSummaryCard
      title="Strategy Direction"
      actions={
        strategy && !readOnly ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSaveDraft()}
              disabled={saving || markingReady}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => void onMarkReady()}
              disabled={saving || markingReady}
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
                <div className="space-y-3">
                  {defs.map((def) => (
                    <label key={def.key} className="block">
                      <div className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {def.label}
                      </div>
                      <textarea
                        value={fields[def.key as StrategyFieldKey]}
                        onChange={(event) =>
                          setFields((prev) => ({
                            ...prev,
                            [def.key]: event.target.value,
                          }))
                        }
                        disabled={readOnly || saving || markingReady}
                        rows={4}
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:disabled:bg-zinc-900/60 dark:disabled:text-zinc-500"
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </AgentSummaryCard>
  );
}
