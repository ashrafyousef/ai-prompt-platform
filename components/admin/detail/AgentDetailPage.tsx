"use client";

import { useAdminAgent } from "@/hooks/useAdminAgent";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AgentDetailHeader } from "./AgentDetailHeader";
import { AgentBehaviorSummary } from "./AgentBehaviorSummary";
import { AgentKnowledgeSummary } from "./AgentKnowledgeSummary";
import { AgentOutputSummary } from "./AgentOutputSummary";
import { AgentStarterPromptsSummary } from "./AgentStarterPromptsSummary";
import { AgentMetadataPanel } from "./AgentMetadataPanel";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-4 w-96 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
          <div className="h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        </div>
      </div>
    </div>
  );
}

export function AgentDetailPage({ agentId }: { agentId: string }) {
  const { agent, isLoading, error, patchAgent, duplicateAgent } = useAdminAgent(agentId);

  if (isLoading) return <Skeleton />;

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Agent not found."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Agents", href: "/admin/agents" },
          { label: agent.name },
        ]}
      />

      <AgentDetailHeader agent={agent} onPatch={patchAgent} onDuplicate={duplicateAgent} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <AgentBehaviorSummary agent={agent} />
          <AgentKnowledgeSummary agent={agent} />
          <AgentOutputSummary agent={agent} />
          <AgentStarterPromptsSummary agent={agent} />
        </div>
        <div className="space-y-6">
          <AgentMetadataPanel agent={agent} />
        </div>
      </div>
    </div>
  );
}
