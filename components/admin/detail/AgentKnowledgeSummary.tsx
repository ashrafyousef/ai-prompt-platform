"use client";

import Link from "next/link";
import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentKnowledgeSummary({ agent }: { agent: AdminAgentDetail }) {
  const knowledge = agent.effectiveConfig?.knowledgeItems ?? [];
  const scopeDescription =
    agent.scope === "TEAM"
      ? `Knowledge context is accessible through this agent only to members of ${agent.team?.name ?? "the assigned team"}.`
      : "Knowledge context is accessible through this agent across workspace teams.";
  const activeCount = knowledge.filter((item) => item.isActive).length;

  return (
    <AgentSummaryCard title="Knowledge">
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Effective knowledge snapshot used when this agent is interpreted at runtime.
      </p>
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">{scopeDescription}</p>
      {knowledge.length === 0 ? (
        <div className="space-y-2">
          <p className="text-zinc-400">No knowledge sources attached.</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Add or activate knowledge from Knowledge Admin, then return here to verify effective runtime context.
          </p>
          <Link
            href="/admin/knowledge"
            className="inline-flex rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Go to Knowledge Admin
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {activeCount} of {knowledge.length} knowledge source{knowledge.length === 1 ? "" : "s"} currently active.
          </p>
          <ul className="space-y-3">
            {knowledge.map((k, i) => (
              <li key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-zinc-800 dark:text-zinc-200">{k.title}</p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      k.isActive
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {k.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {k.sourceType} · {((k.content ?? "").length / 1000).toFixed(1)}k chars
                </p>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/admin/knowledge"
              className="inline-flex rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Manage Knowledge
            </Link>
            <Link
              href={`/admin/agents/${agent.id}/edit`}
              className="inline-flex rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Review Agent Access
            </Link>
          </div>
        </div>
      )}
    </AgentSummaryCard>
  );
}
