"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentStarterPromptsSummary({ agent }: { agent: AdminAgentDetail }) {
  const schema = agent.inputSchema as Record<string, unknown> | null;
  const prompts = (schema?.starterPrompts ?? []) as string[];

  return (
    <AgentSummaryCard title="Starter Prompts">
      {prompts.length === 0 ? (
        <p className="text-zinc-400">No starter prompts configured.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {prompts.map((p, i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-700 dark:bg-zinc-900"
            >
              {p}
            </div>
          ))}
        </div>
      )}
    </AgentSummaryCard>
  );
}
