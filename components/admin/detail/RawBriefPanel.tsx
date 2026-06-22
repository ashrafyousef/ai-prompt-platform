"use client";

import { useEffect, useState } from "react";
import { canAnalyzeBrief } from "@/lib/briefAccess";
import type { BriefDocumentV2 } from "@/lib/briefIntake";
import { AgentSummaryCard } from "./AgentSummaryCard";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

export function RawBriefPanel({
  briefId,
  briefStatus,
  projectStatus,
  document,
  onSaved,
  onAnalyzed,
  onError,
}: {
  briefId: string | null;
  briefStatus: string;
  projectStatus: ProjectStatus;
  document: BriefDocumentV2 | null;
  onSaved: (message: string) => void;
  onAnalyzed: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [rawText, setRawText] = useState(document?.source?.rawText ?? "");
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const editable =
    briefId !== null &&
    canAnalyzeBrief(briefStatus as BriefStatus, projectStatus);

  useEffect(() => {
    setRawText(document?.source?.rawText ?? "");
  }, [document]);

  async function onSaveRaw() {
    if (!briefId || !editable) return;
    setSaving(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/briefs/${encodeURIComponent(briefId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsesJson: {
            source: {
              rawText,
              savedAt: new Date().toISOString(),
            },
          },
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(adminApiError(data, "Failed to save raw brief."));
      }
      onSaved("Raw client brief saved.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save raw brief.");
    } finally {
      setSaving(false);
    }
  }

  async function onAnalyze() {
    if (!briefId || !editable) return;
    setAnalyzing(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/briefs/${encodeURIComponent(briefId)}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(adminApiError(data, "Failed to analyze brief."));
      }
      onAnalyzed("Brief analysis complete.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to analyze brief.");
    } finally {
      setAnalyzing(false);
    }
  }

  const busy = saving || analyzing;

  return (
    <AgentSummaryCard
      title="Client brief (raw)"
      actions={
        editable ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSaveRaw()}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {saving ? "Saving..." : "Save raw brief"}
            </button>
            <button
              type="button"
              onClick={() => void onAnalyze()}
              disabled={busy || !rawText.trim()}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {analyzing ? "Analyzing..." : "Analyze brief"}
            </button>
          </div>
        ) : null
      }
    >
      {!briefId ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a brief for this project before pasting a client brief.
        </p>
      ) : projectStatus === "ARCHIVED" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This project is archived. The raw client brief is read-only.
        </p>
      ) : !editable ? (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          This brief has been submitted and the raw client brief is read-only.
        </p>
      ) : (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Paste the messy or incomplete client brief here, then analyze it to propose a master brief.
        </p>
      )}

      {briefId ? (
        <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <span>Client brief text</span>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            readOnly={!editable}
            rows={10}
            placeholder="Paste the client brief, email, or notes here..."
            className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 read-only:bg-zinc-50 read-only:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:read-only:bg-zinc-950 dark:read-only:text-zinc-400"
          />
        </label>
      ) : null}
    </AgentSummaryCard>
  );
}
