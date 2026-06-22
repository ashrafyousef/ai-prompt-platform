"use client";

import { useState } from "react";
import { canEditBriefResponses } from "@/lib/briefAccess";
import {
  BRIEF_INTAKE_FIELD_DEFINITIONS,
  type BriefAnalysis,
  type BriefDocumentV2,
} from "@/lib/briefIntake";
import { AgentSummaryCard } from "./AgentSummaryCard";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

function severityClasses(severity: "info" | "warning"): string {
  return severity === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
}

export function BriefAnalysisPanel({
  briefId,
  briefStatus,
  projectStatus,
  document,
  onApplied,
  onError,
}: {
  briefId: string | null;
  briefStatus: string;
  projectStatus: ProjectStatus;
  document: BriefDocumentV2 | null;
  onApplied: (message: string) => void;
  onError: (message: string | null) => void;
}) {
  const [applying, setApplying] = useState(false);
  const analysis: BriefAnalysis | undefined = document?.analysis;
  const proposedFields = analysis?.proposedFields;
  const editable =
    briefId !== null && canEditBriefResponses(briefStatus as BriefStatus, projectStatus);

  async function onApplyProposed() {
    if (!briefId || !editable || !proposedFields) return;
    const confirmed = window.confirm(
      "Apply the proposed master brief fields? This will update the structured master brief form."
    );
    if (!confirmed) return;

    setApplying(true);
    onError(null);
    try {
      const res = await fetch(`/api/admin/briefs/${encodeURIComponent(briefId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responsesJson: {
            fields: proposedFields,
          },
        }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        throw new Error(adminApiError(data, "Failed to apply proposed master brief."));
      }
      onApplied("Proposed master brief applied.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to apply proposed master brief.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <AgentSummaryCard
      title="Brief analysis"
      actions={
        editable && proposedFields ? (
          <button
            type="button"
            onClick={() => void onApplyProposed()}
            disabled={applying}
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {applying ? "Applying..." : "Apply to master brief"}
          </button>
        ) : null
      }
    >
      {!briefId ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a brief and run analysis to see issues and proposed master brief fields.
        </p>
      ) : !analysis ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No analysis yet. Save a raw client brief and click Analyze brief.
        </p>
      ) : (
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Issues
            </p>
            {analysis.issues.length === 0 ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                No major gaps detected. Review the proposed master brief below before applying.
              </p>
            ) : (
              <ul className="space-y-2">
                {analysis.issues.map((issue) => (
                  <li
                    key={`${issue.code}-${issue.message}`}
                    className={`rounded-lg border px-3 py-2 text-sm ${severityClasses(issue.severity)}`}
                  >
                    <span className="font-medium">{issue.code.replaceAll("_", " ")}</span>
                    <span className="mx-2 text-xs uppercase tracking-wide opacity-70">{issue.severity}</span>
                    <p className="mt-1">{issue.message}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {proposedFields ? (
            <div>
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Proposed master brief preview
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {BRIEF_INTAKE_FIELD_DEFINITIONS.map(({ key, label }) => (
                  <div
                    key={`preview-${key}`}
                    className={`rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900 ${
                      key === "objective" || key === "deliverables" || key === "openQuestions"
                        ? "sm:col-span-2"
                        : ""
                    }`}
                  >
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                      {proposedFields[key].trim() || "—"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </AgentSummaryCard>
  );
}
