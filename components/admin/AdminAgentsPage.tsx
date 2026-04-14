"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Plus, FileDown } from "lucide-react";
import { AgentListToolbar } from "@/components/admin/AgentListToolbar";
import { AgentList } from "@/components/admin/AgentList";
import { useAdminAgents, type AdminAgentFilters } from "@/hooks/useAdminAgents";

const defaultFilters: AdminAgentFilters = {
  q: "",
  status: "ALL",
  scope: "ALL",
  teamId: "ALL",
  sort: "updatedAt_desc",
};

const teamFetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load teams");
  return data as { teams: { id: string; name: string; slug: string }[] };
};

export function AdminAgentsPage() {
  const [filters, setFilters] = useState<AdminAgentFilters>(defaultFilters);
  const [debouncedQ, setDebouncedQ] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(filters.q.trim()), 300);
    return () => clearTimeout(t);
  }, [filters.q]);

  const queryFilters = useMemo(
    () => ({
      ...filters,
      q: debouncedQ,
    }),
    [filters, debouncedQ]
  );

  const { agents, error, isLoading, mutate } = useAdminAgents(queryFilters);
  const { data: teamsData } = useSWR("/api/admin/teams", teamFetcher);
  const teams = teamsData?.teams ?? [];

  const hasActiveFilters =
    debouncedQ.length > 0 ||
    filters.status !== "ALL" ||
    filters.scope !== "ALL" ||
    filters.teamId !== "ALL";

  return (
    <div className="space-y-8">
      <AgentListToolbar filters={filters} onChange={setFilters} teams={teams} />

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-900/50 dark:bg-red-950/30">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
          <button
            type="button"
            onClick={() => void mutate()}
            className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Retry
          </button>
        </div>
      ) : null}

      {isLoading && !error ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-zinc-200/70 dark:bg-zinc-800/70" />
          ))}
        </div>
      ) : null}

      {!isLoading && !error && agents.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center dark:border-zinc-700 dark:bg-zinc-900/40">
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {hasActiveFilters ? "No agents match your filters" : "No agents yet"}
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            {hasActiveFilters
              ? "Clear filters or adjust search to see more results."
              : "Create your first agent to get started."}
          </p>
          {!hasActiveFilters ? (
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/admin/agents/new"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                <Plus className="h-4 w-4" />
                Create agent
              </Link>
              <Link
                href="/admin/agents/import"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <FileDown className="h-4 w-4" />
                Import
              </Link>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFilters(defaultFilters)}
              className="mt-4 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : null}

      {!isLoading && !error && agents.length > 0 ? (
        <AgentList agents={agents} onRefresh={() => void mutate()} />
      ) : null}
    </div>
  );
}
