"use client";

import Link from "next/link";
import type { AdminAgentListItem } from "@/lib/adminTypes";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";
import { AgentActionsMenu } from "@/components/admin/AgentActionsMenu";

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function AgentList({
  agents,
  onRefresh,
}: {
  agents: AdminAgentListItem[];
  onRefresh: () => void;
}) {
  if (agents.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">No agents match your filters</p>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Try clearing search or widen status/team filters.</p>
        <Link
          href="/admin/agents/new"
          className="mt-6 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Create Agent
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50/80 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {agents.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3">
                  <Link href={`/admin/agents/${a.id}`} className="font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                    {a.name}
                  </Link>
                  <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{a.description || "—"}</p>
                </td>
                <td className="px-4 py-3 align-middle">
                  <AgentStatusBadge status={a.status} />
                </td>
                <td className="px-4 py-3 align-middle">
                  <AgentScopeBadge scope={a.scope} />
                </td>
                <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{a.team?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">{formatDate(a.updatedAt)}</td>
                <td className="px-4 py-3 text-right align-middle">
                  <AgentActionsMenu agent={a} onChanged={onRefresh} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {agents.map((a) => (
          <div
            key={a.id}
            className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/admin/agents/${a.id}`} className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {a.name}
                </Link>
                <p className="mt-1 line-clamp-3 text-xs text-zinc-500 dark:text-zinc-400">{a.description || "—"}</p>
              </div>
              <AgentActionsMenu agent={a} onChanged={onRefresh} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <AgentStatusBadge status={a.status} />
              <AgentScopeBadge scope={a.scope} />
            </div>
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Team: <span className="text-zinc-700 dark:text-zinc-300">{a.team?.name ?? "—"}</span>
              {" · "}
              Updated {formatDate(a.updatedAt)}
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
