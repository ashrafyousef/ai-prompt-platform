"use client";

import { useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { useAdminAgent } from "@/hooks/useAdminAgent";
import { useToast } from "@/components/ui/Toast";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AgentTestInput } from "./AgentTestInput";
import { AgentTestOutput, type TestResult } from "./AgentTestOutput";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";

function Skeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-6 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-40 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
      <div className="h-64 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
    </div>
  );
}

export function AgentTestSandbox({ agentId }: { agentId: string }) {
  const { agent, isLoading, error, runTest } = useAdminAgent(agentId);
  const { toast } = useToast();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleTest(prompt: string) {
    if (!agent) return;
    setLoading(true);
    try {
      const result = await runTest(prompt);
      setResults((prev) => [
        { prompt, ...result },
        ...prev,
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Test failed";
      setResults((prev) => [
        {
          prompt,
          response: "",
          durationMs: 0,
          model: "—",
          outputFormat: agent.outputFormat,
          schemaValid: null,
          error: msg,
        },
        ...prev,
      ]);
      toast(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  if (isLoading) return <Skeleton />;
  if (error || !agent) {
    return (
      <div className="flex flex-col items-center py-20">
        <p className="text-sm text-red-600 dark:text-red-400">{error || "Agent not found."}</p>
      </div>
    );
  }

  const starterPrompts = (
    (agent.inputSchema as Record<string, unknown>)?.starterPrompts ?? []
  ) as string[];

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Agents", href: "/admin/agents" },
          { label: agent.name, href: `/admin/agents/${agent.id}` },
          { label: "Test" },
        ]}
      />

      {/* Agent info bar */}
      <div className="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white px-5 py-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            <FlaskConical className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Testing: {agent.name}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <AgentStatusBadge status={agent.status} />
              <span className="text-[11px] text-zinc-400">{agent.outputFormat} output</span>
            </div>
          </div>
        </div>

        {results.length > 0 ? (
          <button
            type="button"
            onClick={() => setResults([])}
            className="inline-flex items-center gap-1.5 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-400"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        ) : null}
      </div>

      {/* Input */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <AgentTestInput onSubmit={handleTest} loading={loading} starterPrompts={starterPrompts} />
      </div>

      {/* Results */}
      <AgentTestOutput results={results} />
    </div>
  );
}
