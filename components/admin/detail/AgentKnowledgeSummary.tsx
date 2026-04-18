"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentKnowledgeSummary({ agent }: { agent: AdminAgentDetail }) {
  const knowledge = normalizeAgentInputSchema(agent.inputSchema).knowledgeItems;

  return (
    <AgentSummaryCard title="Knowledge">
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
