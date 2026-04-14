"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentOutputSummary({ agent }: { agent: AdminAgentDetail }) {
  const schema = agent.outputSchema as Record<string, unknown> | null;

  return (
    <AgentSummaryCard title="Output Rules">
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-400">Format</p>
          <p className="font-medium capitalize">{agent.outputFormat}</p>
        </div>

        {agent.outputFormat === "json" && schema ? (
          <div>
            <p className="mb-1 text-xs text-zinc-400">Schema</p>
            <pre className="max-h-48 overflow-auto rounded-xl bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </AgentSummaryCard>
  );
}
