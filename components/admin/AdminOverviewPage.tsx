"use client";

import Link from "next/link";
import { Plus, Upload, List, Loader2, ArrowRight } from "lucide-react";
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

  const { counts, byTeam, recent, recommendations, attention } = overview;

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Scope mix</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Workspace-wide <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.workspaceWide}</span>
            {" · "}
            Team-scoped <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.teamScoped}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Knowledge activity</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Active <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.knowledgeActive}</span>
            {" · "}
            Inactive <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.knowledgeInactive}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Total knowledge items: {counts.knowledgeTotal}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Members</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Active <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.activeMembers}</span>
            {" / "}
            <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.members}</span>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Teams</p>
          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
            Total <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.teams}</span>
            {" · "}
            Archived <span className="font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{counts.archivedTeams}</span>
          </p>
        </div>
      </div>

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
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recommended next steps</h3>
          <ul className="mt-4 space-y-2">
            {recommendations.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-start gap-2 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
                >
                  <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
          <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Quick actions</h4>
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

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Draft agents needing review</h3>
            <Link href="/admin/agents?status=DRAFT" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              View all drafts
            </Link>
          </div>
          {attention.draftAgents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No draft backlog right now.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {attention.draftAgents.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/agents/${item.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      {item.name}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.teamName ?? "Workspace-wide"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400" dateTime={item.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.updatedAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Teams needing scoped coverage</h3>
            <Link href="/admin/teams" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Open teams
            </Link>
          </div>
          {attention.teamsWithoutAgents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">All teams currently have at least one agent.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {attention.teamsWithoutAgents.map((team) => (
                <li key={team.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{team.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {team.isArchived ? "Archived team" : "No assigned agents"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Knowledge needing review</h3>
            <Link href="/admin/knowledge" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Open knowledge
            </Link>
          </div>
          {attention.inactiveKnowledgeByAgent.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No inactive knowledge hotspots detected.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {attention.inactiveKnowledgeByAgent.map((row) => (
                <li key={row.agentId} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/agents/${row.agentId}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      {row.agentName}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.teamName ?? "Workspace-wide"}</p>
                  </div>
                  <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                    {row.inactiveCount} inactive item{row.inactiveCount === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Archived agents to revisit</h3>
            <Link href="/admin/agents?status=ARCHIVED" className="text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              View archived
            </Link>
          </div>
          {attention.archivedAgents.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No archived agents at the moment.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {attention.archivedAgents.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/agents/${item.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      {item.name}
                    </Link>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {item.teamName ?? "Workspace-wide"}
                    </p>
                  </div>
                  <time className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400" dateTime={item.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(item.updatedAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
