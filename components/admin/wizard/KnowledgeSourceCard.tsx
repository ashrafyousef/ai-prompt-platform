"use client";

import { useState } from "react";
import {
  FileText,
  Trash2,
  AlertCircle,
  Loader2,
  ExternalLink,
  File as FileIcon,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { KnowledgeSource } from "@/hooks/useAgentWizard";
import type { AgentKnowledgeSourceType } from "@/lib/agentConfig";
import { knowledgeSourceTypeValues } from "@/lib/agentConfig";
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_HELPERS } from "@/lib/agentConstants";

export function KnowledgeSourceCard({
  source,
  onChange,
  onRemove,
}: {
  source: KnowledgeSource;
  onChange: (patch: Partial<KnowledgeSource>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tagsText = source.tags.join(", ");
  const isFileBased = Boolean(source.fileRef?.fileName);
  const influenceLabel =
    source.priority >= 5
      ? "Highest influence"
      : source.priority >= 4
      ? "High influence"
      : source.priority >= 3
      ? "Standard influence"
      : "Low influence";
  const reviewedDate = source.lastReviewedAt ? source.lastReviewedAt.slice(0, 10) : "";

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {source.status === "uploading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : source.status === "error" ? (
            <AlertCircle className="h-4 w-4 text-red-500" />
          ) : isFileBased ? (
            <FileIcon className="h-4 w-4" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {source.title || source.fileRef?.fileName || "Untitled"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {SOURCE_TYPE_LABELS[source.sourceType]}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                source.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
              }`}
            >
              {source.isActive ? "Active" : "Inactive"}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              P{source.priority} · {influenceLabel}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {isFileBased ? "File-based" : "Text-based"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {source.status === "uploading"
              ? "Uploading source..."
              : source.status === "error"
              ? "Upload failed. Update or replace this source."
              : source.fileRef?.url
              ? "Upload complete."
              : "Ready."}
            {source.content ? ` · ${(source.content.length / 1000).toFixed(1)}k chars` : ""}
            {source.fileRef?.sizeBytes && !source.content
              ? ` · ${(source.fileRef.sizeBytes / 1024).toFixed(1)} KB`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
            aria-label="Remove source"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {!expanded ? null : (
        <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Title
              </label>
              <input
                type="text"
                value={source.title}
                onChange={(event) => onChange({ title: event.target.value })}
                placeholder="Knowledge source title"
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Source type
              </label>
              <select
                value={source.sourceType}
                onChange={(event) =>
                  onChange({ sourceType: event.target.value as AgentKnowledgeSourceType })
                }
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                {knowledgeSourceTypeValues.map((v) => (
                  <option key={v} value={v}>
                    {SOURCE_TYPE_LABELS[v]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-400">{SOURCE_TYPE_HELPERS[source.sourceType]}</p>
            </div>
          </div>

          {source.fileRef ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {source.fileRef.fileName}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {source.fileRef.mimeType ?? "unknown type"}
                    {source.fileRef.sizeBytes
                      ? ` · ${(source.fileRef.sizeBytes / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
                {source.fileRef.url ? (
                  <a
                    href={source.fileRef.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="View uploaded file"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              {!source.content ? (
                <p className="mt-1.5 text-[11px] text-zinc-400">
                  Text extraction for binary formats is not yet active. The file is stored for future processing.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Metadata
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Summary</label>
                <textarea
                  rows={2}
                  value={source.summary}
                  onChange={(event) => onChange({ summary: event.target.value })}
                  placeholder="What this source is used for"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Tags</label>
                <input
                  type="text"
                  value={tagsText}
                  onChange={(event) =>
                    onChange({
                      tags: event.target.value
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="policy, onboarding, legal"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Owner note</label>
                <input
                  type="text"
                  value={source.ownerNote}
                  onChange={(event) => onChange({ ownerNote: event.target.value })}
                  placeholder="Internal context for admins"
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-zinc-500 dark:text-zinc-400">Last reviewed</label>
                <input
                  type="date"
                  value={reviewedDate}
                  onChange={(event) =>
                    onChange({
                      lastReviewedAt: event.target.value ? `${event.target.value}T00:00:00.000Z` : null,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Priority
              </label>
              <select
                value={source.priority}
                onChange={(event) => onChange({ priority: Number(event.target.value) })}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              >
                <option value={1}>1 - Low influence</option>
                <option value={2}>2 - Light influence</option>
                <option value={3}>3 - Standard influence</option>
                <option value={4}>4 - High influence</option>
                <option value={5}>5 - Highest influence</option>
              </select>
            </div>
            <div className="flex items-end gap-6">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={source.isActive}
                  onChange={(event) => onChange({ isActive: event.target.checked })}
                  className="h-4 w-4 rounded accent-violet-600"
                />
                Active
              </label>
              <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={source.appliesTo === "all"}
                  onChange={(event) =>
                    onChange({ appliesTo: event.target.checked ? "all" : "future-scope" })
                  }
                  className="h-4 w-4 rounded accent-violet-600"
                />
                Applies to all
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Content
            </label>
            <textarea
              rows={4}
              value={source.content ?? ""}
              onChange={(event) => onChange({ content: event.target.value })}
              placeholder="Paste source content"
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm leading-relaxed dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
