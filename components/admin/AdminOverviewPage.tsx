"use client";

import Link from "next/link";
import { Plus, Upload, List, Loader2 } from "lucide-react";
import { AdminSummaryCards } from "@/components/admin/AdminSummaryCards";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { useAdminOverview } from "@/hooks/useAdminOverview";

export function AdminOverviewPage() {
  const { overview, error, isLoading, mutate } = useAdminOverview();

  if (isLoading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-zinc-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Loading overview…</p>
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/50 dark:bg-red-950/30">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">{error || "Could not load overview."}</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Retry
        </button>
      </div>
    );
  }

  const { counts, byTeam, recent } = overview;

  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">Overview</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          High-level visibility across agents and teams. Detailed editing stays in the Agents workspace.
        </p>
      </div>

      <AdminSummaryCards
        total={counts.total}
        published={counts.published}
        draft={counts.draft}
        archived={counts.archived}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Agents by team</h3>
          <ul className="mt-4 space-y-3">
            {byTeam.length === 0 ? (
              <li className="text-sm text-zinc-500">No team data yet.</li>
            ) : (
              byTeam.map((row) => (
                <li key={row.teamId ?? "unassigned"} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-700 dark:text-zinc-300">{row.teamName}</span>
                  <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{row.count}</span>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Quick actions</h3>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/admin/agents/new"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <Plus className="h-4 w-4" />
              Create new agent
            </Link>
            <Link
              href="/admin/agents/import"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <Upload className="h-4 w-4" />
              Import agent
            </Link>
            <Link
              href="/admin/members"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <List className="h-4 w-4" />
              Manage members
            </Link>
            <Link
              href="/admin/agents"
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
            >
              <List className="h-4 w-4" />
              View all agents
            </Link>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent updates</h3>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No agents yet — create one to get started.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <Link href={`/admin/agents/${r.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                    {r.name}
                  </Link>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.teamName ?? "Unassigned"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <AgentStatusBadge status={r.status} />
                  <time className="text-xs text-zinc-500 dark:text-zinc-400" dateTime={r.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(r.updatedAt))}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
