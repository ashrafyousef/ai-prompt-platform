"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentKnowledgeSummary({ agent }: { agent: AdminAgentDetail }) {
  const knowledge = agent.effectiveConfig?.knowledgeItems ?? [];

  return (
    <AgentSummaryCard title="Knowledge">
      <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
        Effective knowledge snapshot used when this agent is interpreted at runtime.
      </p>
      {knowledge.length === 0 ? (
        <p className="text-zinc-400">No knowledge sources attached.</p>
      ) : (
        <ul className="space-y-3">
          {knowledge.map((k, i) => (
            <li key={i} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="font-medium text-zinc-800 dark:text-zinc-200">{k.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {k.sourceType} · {((k.content ?? "").length / 1000).toFixed(1)}k chars
              </p>
            </li>
          ))}
        </ul>
      )}
    </AgentSummaryCard>
  );
}
