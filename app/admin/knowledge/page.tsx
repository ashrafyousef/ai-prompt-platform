"use client";

import { useEffect, useState } from "react";

type KnowledgeRow = {
  agentId: string;
  agentName: string;
  agentScope: "GLOBAL" | "TEAM";
  teamId: string | null;
  teamName: string | null;
  knowledgeId: string;
  title: string;
  sourceType: string;
  isActive: boolean;
  processingStatus: string;
  hasContent: boolean;
};

export default function AdminKnowledgePage() {
  const [rows, setRows] = useState<KnowledgeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/knowledge");
      const data = (await res.json()) as { error?: string; knowledge?: KnowledgeRow[] };
      if (!res.ok || !data.knowledge) {
        setError(data.error ?? "Failed to load knowledge.");
        return;
      }
      setRows(data.knowledge);
    } catch {
      setError("Failed to load knowledge.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(row: KnowledgeRow) {
    const key = `${row.agentId}:${row.knowledgeId}`;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/admin/knowledge/${row.agentId}/${row.knowledgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to update knowledge.");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.agentId === row.agentId && r.knowledgeId === row.knowledgeId
            ? { ...r, isActive: !r.isActive }
            : r
        )
      );
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) return <div className="py-10 text-sm text-zinc-500">Loading knowledge...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Knowledge</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Phase 2.2 scope rule: knowledge inherits owning agent scope (workspace-wide for GLOBAL agents, team-scoped for
          TEAM agents).
        </p>
      </div>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}
      <section className="space-y-3 md:hidden">
        <h3 className="px-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge items</h3>
        {rows.length === 0 ? (
          <article className="rounded-2xl border border-zinc-200/80 bg-white p-4 text-sm text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No knowledge items available in your current scope.
          </article>
        ) : (
          rows.map((row) => {
            const key = `${row.agentId}:${row.knowledgeId}`;
            const scopeLabel =
              row.agentScope === "TEAM" ? `${row.agentScope} (${row.teamName ?? "No team"})` : row.agentScope;
            return (
              <article
                key={`mobile-knowledge-${key}`}
                className="rounded-2xl border border-zinc-200/80 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div>
                  <p className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.title}</p>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.hasContent ? "Text/File present" : "No content"}
                  </p>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 min-[430px]:grid-cols-2">
                  <p className="min-w-0">
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Agent:</span>{" "}
                    <span className="break-words">{row.agentName}</span>
                  </p>
                  <p>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Scope:</span>{" "}
                    {scopeLabel}
                  </p>
                  <p>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Type:</span>{" "}
                    {row.sourceType}
                  </p>
                  <p>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">Status:</span>{" "}
                    {row.isActive ? "Active" : "Inactive"} / {row.processingStatus}
                  </p>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void toggle(row)}
                    disabled={savingKey === key}
                    className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    {savingKey === key ? "Saving..." : row.isActive ? "Deactivate" : "Activate"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>

      <div className="hidden overflow-x-auto rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Knowledge</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-4 text-zinc-500 dark:text-zinc-400">
                  No knowledge items available in your current scope.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const key = `${row.agentId}:${row.knowledgeId}`;
                return (
                  <tr key={key}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.title}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">
                        {row.hasContent ? "Text/File present" : "No content"}
                      </div>
                    </td>
                    <td className="px-4 py-3">{row.agentName}</td>
                    <td className="px-4 py-3">
                      {row.agentScope}
                      {row.agentScope === "TEAM" ? ` (${row.teamName ?? "No team"})` : ""}
                    </td>
                    <td className="px-4 py-3">{row.sourceType}</td>
                    <td className="px-4 py-3">
                      {row.isActive ? "Active" : "Inactive"} / {row.processingStatus}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void toggle(row)}
                        disabled={savingKey === key}
                        className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                      >
                        {savingKey === key ? "Saving..." : row.isActive ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
