"use client";

import useSWR from "swr";
import type { AdminAgentListItem } from "@/lib/adminTypes";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load agents");
  return data as { agents: AdminAgentListItem[] };
};

export type AdminAgentFilters = {
  q: string;
  status: string;
  scope: string;
  teamId: string;
  sort: string;
};

function buildQuery(f: AdminAgentFilters): string {
  const qs = new URLSearchParams();
  if (f.q.trim()) qs.set("q", f.q.trim());
  if (f.status && f.status !== "ALL") qs.set("status", f.status);
  if (f.scope && f.scope !== "ALL") qs.set("scope", f.scope);
  if (f.teamId && f.teamId !== "ALL") qs.set("teamId", f.teamId);
  if (f.sort) qs.set("sort", f.sort);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export function useAdminAgents(filters: AdminAgentFilters) {
  const query = buildQuery(filters);
  const { data, error, isLoading, mutate } = useSWR(`/api/admin/agents${query}`, fetcher, {
    revalidateOnFocus: true,
  });

  return {
    agents: data?.agents ?? [],
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
    mutate,
  };
}
