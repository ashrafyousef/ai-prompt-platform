"use client";

import { useMemo, useState } from "react";
import {
  FlaskConical,
  Trash2,
  BookOpen,
  FileText,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useAdminAgent } from "@/hooks/useAdminAgent";
import { useToast } from "@/components/ui/Toast";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import type { AgentBuilderInputSchema } from "@/lib/agentConfig";
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

type ConfigHint = { level: "warn" | "info"; text: string };

function computeConfigHints(config: AgentBuilderInputSchema, systemPrompt: string): ConfigHint[] {
  const hints: ConfigHint[] = [];
  const oc = config.outputConfig;
  const activeKnowledge = config.knowledgeItems.filter((i) => i.isActive);

  if (!systemPrompt.trim()) {
    hints.push({ level: "warn", text: "System prompt is empty — agent has no base instructions." });
  }
  if (config.knowledgeItems.length === 0) {
    hints.push({ level: "info", text: "No knowledge sources attached. Responses rely on base instructions only." });
  } else if (activeKnowledge.length === 0) {
    hints.push({ level: "warn", text: "All knowledge sources are inactive — none will be used." });
  }
  if (oc.format === "template" && !oc.template?.trim()) {
    hints.push({ level: "warn", text: "Template format selected but template body is empty." });
  }
  if (oc.citationsPolicy === "required" && activeKnowledge.length === 0) {
    hints.push({ level: "warn", text: "Citations are required but no knowledge is available to cite." });
  }
  if (oc.format === "json") {
    hints.push({ level: "info", text: "JSON output — schema validation will be checked automatically." });
  }
  if (oc.requiredSections.length > 0) {
    hints.push({ level: "info", text: `Response should include: ${oc.requiredSections.join(", ")}.` });
  }
  return hints;
}

function ConfigContextCard({ config, systemPrompt }: { config: AgentBuilderInputSchema; systemPrompt: string }) {
  const oc = config.outputConfig;
  const activeCount = config.knowledgeItems.filter((i) => i.isActive).length;
  const totalCount = config.knowledgeItems.length;
  const hints = computeConfigHints(config, systemPrompt);
  const warnings = hints.filter((h) => h.level === "warn");
  const infos = hints.filter((h) => h.level === "info");

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 py-3.5">
        <div className="flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Knowledge:</span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">
            {activeCount} active{totalCount > activeCount ? ` / ${totalCount} total` : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">Output:</span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200">{oc.format}</span>
          <span className="text-[10px] text-zinc-400">·</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{oc.responseDepth}</span>
          {oc.citationsPolicy !== "none" ? (
            <>
              <span className="text-[10px] text-zinc-400">·</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">citations {oc.citationsPolicy}</span>
            </>
          ) : null}
        </div>
      </div>

      {hints.length > 0 ? (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
          <div className="space-y-1.5">
            {warnings.map((h, i) => (
              <div key={`w-${i}`} className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                <span className="text-xs text-amber-700 dark:text-amber-400">{h.text}</span>
              </div>
            ))}
            {infos.map((h, i) => (
              <div key={`i-${i}`} className="flex items-start gap-1.5">
                <Info className="mt-0.5 h-3 w-3 shrink-0 text-blue-400" />
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{h.text}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AgentTestSandbox({ agentId }: { agentId: string }) {
  const { agent, isLoading, error, runTest } = useAdminAgent(agentId);
  const { toast } = useToast();
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  const normalizedConfig = useMemo(
    () => (agent ? normalizeAgentInputSchema(agent.inputSchema) : null),
    [agent]
  );

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

  const starterPrompts = normalizedConfig?.starterPrompts ?? [];

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
              <span className="text-[11px] text-zinc-400">{normalizedConfig?.outputConfig.format ?? agent.outputFormat} output</span>
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

      {/* Config context */}
      {normalizedConfig ? (
        <ConfigContextCard config={normalizedConfig} systemPrompt={agent.systemPrompt} />
      ) : null}

      {/* Input */}
      <div className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <AgentTestInput onSubmit={handleTest} loading={loading} starterPrompts={starterPrompts} />
      </div>

      {/* Results */}
      <AgentTestOutput results={results} />
    </div>
  );
}
