"use client";

import { FileText, Trash2, AlertCircle, Loader2 } from "lucide-react";
import type { KnowledgeSource } from "@/hooks/useAgentWizard";

export function KnowledgeSourceCard({
  source,
  onRemove,
}: {
  source: KnowledgeSource;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
        {source.status === "uploading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : source.status === "error" ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : (
          <FileText className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {source.title || source.fileName || "Untitled"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          {source.type === "file" ? "File upload" : "Inline text"}
          {source.content ? ` · ${(source.content.length / 1000).toFixed(1)}k chars` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
        aria-label="Remove source"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
