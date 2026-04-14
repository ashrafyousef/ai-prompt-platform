"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

export function AgentBehaviorSummary({ agent }: { agent: AdminAgentDetail }) {
  return (
    <AgentSummaryCard title="Behavior & Instructions">
      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">System Prompt</p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {agent.systemPrompt || "—"}
          </pre>
        </div>
        <div className="flex flex-wrap gap-6">
          <div>
            <p className="text-xs text-zinc-400">Temperature</p>
            <p className="font-medium">{agent.temperature}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Max tokens</p>
            <p className="font-medium">{agent.maxTokens}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-400">Enabled</p>
            <p className="font-medium">{agent.isEnabled ? "Yes" : "No"}</p>
          </div>
        </div>
      </div>
    </AgentSummaryCard>
  );
}
