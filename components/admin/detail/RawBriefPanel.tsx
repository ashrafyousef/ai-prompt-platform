"use client";

import { useEffect, useState, type ClipboardEvent } from "react";
import { canAnalyzeBrief, getBriefReadOnlyMessage } from "@/lib/briefAccess";
import { BRIEF_RAW_TEXT_MAX_LENGTH, type BriefDocumentV2 } from "@/lib/briefIntake";
import { AgentSummaryCard } from "./AgentSummaryCard";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

const READ_ONLY_TEXTAREA_CLASS =
  "read-only:cursor-default read-only:border-zinc-200 read-only:bg-zinc-100 read-only:text-zinc-600 dark:read-only:border-zinc-700 dark:read-only:bg-zinc-900/80 dark:read-only:text-zinc-400";

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

  const status = briefStatus as BriefStatus;
  const editable =
    briefId !== null && canAnalyzeBrief(status, projectStatus);
  const readOnlyMessage =
    briefId !== null ? getBriefReadOnlyMessage(status, projectStatus) : null;

  useEffect(() => {
    setRawText(document?.source?.rawText ?? "");
  }, [document]);

  function onPasteRaw(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!editable) return;
    const pasted = event.clipboardData.getData("text/plain");
    if (!pasted) return;

    event.preventDefault();
    const element = event.currentTarget;
    const start = element.selectionStart ?? 0;
    const end = element.selectionEnd ?? 0;
    const merged = `${rawText.slice(0, start)}${pasted}${rawText.slice(end)}`;
    setRawText(merged.slice(0, BRIEF_RAW_TEXT_MAX_LENGTH));
  }

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
  const charCount = rawText.length;

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
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          This project is archived. The raw client brief is read-only.
        </p>
      ) : readOnlyMessage ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {readOnlyMessage}
        </div>
      ) : (
        <div className="mb-4 space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          <p>
            Paste the original client brief, email, or notes here. Use Command+A then Command+V to
            replace existing text.
          </p>
          <p>
            If your browser context menu appears while selecting text, press Escape and use
            Command+A / Command+V.
          </p>
          <p>
            Analyze creates a proposal only. It will not overwrite the master brief until you click
            Apply.
          </p>
        </div>
      )}

      {briefId ? (
        <label className="grid gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center justify-between gap-2">
            <span>Client brief text</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {charCount.toLocaleString()} / {BRIEF_RAW_TEXT_MAX_LENGTH.toLocaleString()} characters
            </span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value.slice(0, BRIEF_RAW_TEXT_MAX_LENGTH))}
            onPaste={onPasteRaw}
            readOnly={!editable}
            tabIndex={editable ? 0 : -1}
            aria-readonly={!editable}
            rows={10}
            placeholder="Paste the client brief, email, or notes here..."
            className={`w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${READ_ONLY_TEXTAREA_CLASS}`}
          />
        </label>
      ) : null}
    </AgentSummaryCard>
  );
}
