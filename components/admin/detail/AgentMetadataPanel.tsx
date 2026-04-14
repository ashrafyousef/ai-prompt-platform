"use client";

import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentSummaryCard } from "./AgentSummaryCard";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

export function AgentMetadataPanel({ agent }: { agent: AdminAgentDetail }) {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <AgentSummaryCard title="Metadata">
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        <Row label="ID" value={agent.id} />
        <Row label="Slug" value={agent.slug} />
        <Row label="Created" value={fmt(agent.createdAt)} />
        <Row label="Updated" value={fmt(agent.updatedAt)} />
        <Row label="Messages" value={String(agent._count.messages)} />
      </div>
    </AgentSummaryCard>
  );
}
