"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentOutputSummary({ agent }: { agent: AdminAgentDetail }) {
  const effectiveOutput = agent.effectiveConfig?.outputConfig;
  const format = effectiveOutput?.format ?? agent.outputFormat;
  const schema = (effectiveOutput?.schema as Record<string, unknown> | null) ?? (agent.outputSchema as Record<string, unknown> | null);

  return (
    <AgentSummaryCard title="Output Rules">
      <p className="mb-2 text-xs text-zinc-500 dark:text-zinc-400">
        Effective output configuration after normalization.
      </p>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-zinc-400">Format</p>
          <p className="font-medium capitalize">{format}</p>
        </div>

        {format === "json" && schema ? (
          <div>
            <p className="mb-1 text-xs text-zinc-400">Schema</p>
            <pre className="max-h-48 overflow-auto rounded-xl bg-zinc-900 p-3 text-[11px] leading-relaxed text-zinc-300">
              {JSON.stringify(schema, null, 2)}
            </pre>
          </div>
        ) : null}
        {effectiveOutput?.requiredSections && effectiveOutput.requiredSections.length > 0 ? (
          <div>
            <p className="mb-1 text-xs text-zinc-400">Required sections</p>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {effectiveOutput.requiredSections.join(", ")}
            </p>
          </div>
        ) : null}
      </div>
    </AgentSummaryCard>
  );
}
