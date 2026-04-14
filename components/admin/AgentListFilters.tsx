"use client";

import type { AdminAgentFilters } from "@/hooks/useAdminAgents";

type TeamOption = { id: string; name: string };

export function AgentListFilters({
  filters,
  onChange,
  teams,
}: {
  filters: AdminAgentFilters;
  onChange: (next: AdminAgentFilters) => void;
  teams: TeamOption[];
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="admin-agent-search" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Search
        </label>
        <input
          id="admin-agent-search"
          type="search"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          placeholder="Name, slug, description…"
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
      <div className="w-full sm:w-36">
        <label htmlFor="filter-status" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Status
        </label>
        <select
          id="filter-status"
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">All</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
      </div>
      <div className="w-full sm:w-36">
        <label htmlFor="filter-scope" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Scope
        </label>
        <select
          id="filter-scope"
          value={filters.scope}
          onChange={(e) => onChange({ ...filters, scope: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">All</option>
          <option value="TEAM">Team</option>
          <option value="GLOBAL">Global</option>
        </select>
      </div>
      <div className="w-full sm:w-44">
        <label htmlFor="filter-team" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Team
        </label>
        <select
          id="filter-team"
          value={filters.teamId}
          onChange={(e) => onChange({ ...filters, teamId: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="ALL">All teams</option>
          <option value="none">Unassigned</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <div className="w-full sm:w-44">
        <label htmlFor="filter-sort" className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Sort
        </label>
        <select
          id="filter-sort"
          value={filters.sort}
          onChange={(e) => onChange({ ...filters, sort: e.target.value })}
          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <option value="updatedAt_desc">Updated (newest)</option>
          <option value="createdAt_desc">Created (newest)</option>
          <option value="name_asc">Name (A–Z)</option>
        </select>
      </div>
    </div>
  );
}
