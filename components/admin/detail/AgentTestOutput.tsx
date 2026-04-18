"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle, Clock, FlaskConical, AlertTriangle } from "lucide-react";

export type TestConfigSummary = {
  knowledgeCount: number;
  knowledgeTotal: number;
  outputFormat: string;
  responseDepth: string;
  citationsPolicy: string;
  requiredSections: string[];
  hasTemplate: boolean;
};

export type TestResult = {
  prompt: string;
  response: string;
  durationMs: number;
  model: string;
  outputFormat: string;
  schemaValid: boolean | null;
  error?: string;
  configSummary?: TestConfigSummary;
};

function ResultCard({ result, index }: { result: TestResult; index: number }) {
  const [expanded, setExpanded] = useState(true);
  const hasError = !!result.error;

  return (
    <div className={`rounded-2xl border shadow-sm transition ${
      hasError
        ? "border-red-200 bg-white dark:border-red-900/50 dark:bg-zinc-950"
        : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
    }`}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-3.5 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
            hasError
              ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}>
            {hasError ? "!" : index + 1}
          </span>
          <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
            {result.prompt.length > 80 ? result.prompt.slice(0, 77) + "…" : result.prompt}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          {!hasError ? (
            <span className="flex items-center gap-1 text-xs text-zinc-400">
              <Clock className="h-3 w-3" />
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {result.schemaValid === true ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : result.schemaValid === false ? (
            <XCircle className="h-4 w-4 text-red-500" />
          ) : null}
          {hasError ? <AlertTriangle className="h-4 w-4 text-red-500" /> : null}
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-zinc-100 dark:border-zinc-800">
          <div className="border-b border-zinc-50 px-5 py-3 dark:border-zinc-800/50">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Prompt</p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{result.prompt}</p>
          </div>

          <div className="px-5 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Response</p>
            {hasError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
                <p className="text-sm text-red-700 dark:text-red-300">{result.error}</p>
              </div>
            ) : (
              <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-zinc-50 p-4 text-xs leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {result.response}
              </pre>
            )}
          </div>

          {!hasError ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-zinc-100 px-5 py-3 dark:border-zinc-800">
              <span className="text-[11px] text-zinc-400">Format: <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.outputFormat}</span></span>
              <span className="text-[11px] text-zinc-400">Duration: <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.durationMs}ms</span></span>
              {result.schemaValid !== null ? (
                <span className="text-[11px] text-zinc-400">
                  Schema: <span className={`font-medium ${result.schemaValid ? "text-emerald-600" : "text-red-600"}`}>
                    {result.schemaValid ? "Valid" : "Invalid"}
                  </span>
                </span>
              ) : null}
              {result.configSummary ? (
                <>
                  <span className="text-[11px] text-zinc-400">Depth: <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.configSummary.responseDepth}</span></span>
                  <span className="text-[11px] text-zinc-400">Citations: <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.configSummary.citationsPolicy}</span></span>
                  <span className="text-[11px] text-zinc-400">Knowledge: <span className="font-medium text-zinc-600 dark:text-zinc-300">{result.configSummary.knowledgeCount} active</span></span>
                </>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AgentTestOutput({ results }: { results: TestResult[] }) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-200 py-16 dark:border-zinc-800">
        <FlaskConical className="h-8 w-8 text-zinc-300 dark:text-zinc-600" />
        <p className="mt-3 text-sm font-medium text-zinc-500 dark:text-zinc-400">No test results yet</p>
        <p className="mt-1 max-w-xs text-center text-xs text-zinc-400">
          Enter a prompt above or click a starter to see how the agent responds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
        Results ({results.length})
      </p>
      {results.map((r, i) => (
        <ResultCard key={i} result={r} index={i} />
      ))}
    </div>
  );
}
