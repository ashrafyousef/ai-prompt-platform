"use client";

import Link from "next/link";
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
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        Detail summaries on this page reflect the <span className="font-medium">effective normalized configuration</span> used for runtime interpretation.
        {" "}Scope and team settings on this agent determine who can use its attached knowledge context in chat.
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
        <span>
          Need to maintain knowledge content or activation status for this agent?
        </span>
        <Link
          href="/admin/knowledge"
          className="inline-flex rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Open Knowledge Admin
        </Link>
      </div>

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
