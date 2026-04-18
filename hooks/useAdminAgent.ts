"use client";

import useSWR from "swr";
import { useCallback } from "react";
import type { AdminAgentDetail } from "@/lib/adminTypes";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to load agent");
  return data as { agent: AdminAgentDetail };
};

export function useAdminAgent(id: string) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? `/api/admin/agents/${id}` : null,
    fetcher,
    { revalidateOnFocus: true }
  );

  const patchAgent = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/agents/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      await mutate();
      return json.agent;
    },
    [id, mutate]
  );

  const duplicateAgent = useCallback(async () => {
    const res = await fetch(`/api/admin/agents/${id}/duplicate`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Duplicate failed");
    return json.agent as { id: string; name: string; slug: string };
  }, [id]);

  const deleteAgent = useCallback(async () => {
    const res = await fetch(`/api/admin/agents/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Delete failed");
  }, [id]);

  const runTest = useCallback(
    async (prompt: string) => {
      const res = await fetch(`/api/admin/agents/${id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Test failed");
      return json.result as {
        response: string;
        durationMs: number;
        model: string;
        outputFormat: string;
        schemaValid: boolean | null;
        configSummary?: {
          knowledgeCount: number;
          knowledgeTotal: number;
          outputFormat: string;
          responseDepth: string;
          citationsPolicy: string;
          requiredSections: string[];
          hasTemplate: boolean;
        };
      };
    },
    [id]
  );

  return {
    agent: data?.agent ?? null,
    error: error instanceof Error ? error.message : error ? String(error) : null,
    isLoading,
    mutate,
    patchAgent,
    duplicateAgent,
    deleteAgent,
    runTest,
  };
}
