"use client";

import Link from "next/link";
import { Plus, Upload } from "lucide-react";
import { AgentListFilters } from "@/components/admin/AgentListFilters";
import type { AdminAgentFilters } from "@/hooks/useAdminAgents";

type TeamOption = { id: string; name: string };

export function AgentListToolbar({
  filters,
  onChange,
  teams,
}: {
  filters: AdminAgentFilters;
  onChange: (next: AdminAgentFilters) => void;
  teams: TeamOption[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Agents</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Manage AI agents, visibility, and lifecycle without exposing internal prompts in this list.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/agents/new"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <Plus className="h-4 w-4" />
            Create Agent
          </Link>
          <Link
            href="/admin/agents/import"
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" />
            Import Agent
          </Link>
        </div>
      </div>
      <AgentListFilters filters={filters} onChange={onChange} teams={teams} />
    </div>
  );
}
