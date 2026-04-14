"use client";

import useSWR from "swr";
import type { AdminOverviewStats } from "@/lib/adminTypes";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load overview");
  return data as AdminOverviewStats;
};

export function useAdminOverview() {
  const { data, error, isLoading, mutate } = useSWR("/api/admin/overview", fetcher);
  return {
    overview: data,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
    mutate,
  };
}
