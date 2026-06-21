"use client";

import { useEffect, useState } from "react";
import {
  BRIEF_INTAKE_FIELD_DEFINITIONS,
  type BriefIntakeFieldKey,
  type BriefIntakeResponsesV1,
  emptyBriefIntakeResponses,
} from "@/lib/briefIntake";
import { canEditBriefResponses } from "@/lib/briefAccess";
import { AgentSummaryCard } from "./AgentSummaryCard";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

type BriefIntakeBrief = {
  id: string;
  status: string;
  responsesJson: BriefIntakeResponsesV1;
};

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

export function BriefIntakeForm({
  brief,
  projectStatus,
  onSaved,
  onError,
}: {
  brief: BriefIntakeBrief | null;
  projectStatus: ProjectStatus;
  onSaved: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [fields, setFields] = useState<BriefIntakeResponsesV1["fields"]>(
    () => brief?.responsesJson.fields ?? emptyBriefIntakeResponses().fields
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const briefStatus = (brief?.status ?? "DRAFT") as BriefStatus;
  const editable =
    brief !== null && canEditBriefResponses(briefStatus, projectStatus);

  useEffect(() => {
    setFields(brief?.responsesJson.fields ?? emptyBriefIntakeResponses().fields);
  }, [brief]);

  function updateField(key: BriefIntakeFieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function patchBrief(payload: {
    responsesJson?: BriefIntakeResponsesV1;
    status?: "SUBMITTED";
  }) {
    if (!brief) return;
    const res = await fetch(`/api/admin/briefs/${encodeURIComponent(brief.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as { error?: string; message?: string };
    if (!res.ok) {
      throw new Error(adminApiError(data, "Failed to update brief."));
    }
  }

  async function onSaveDraft() {
    if (!brief || !editable) return;
    setSaving(true);
    onError("");
    try {
      const responsesJson: BriefIntakeResponsesV1 = {
        version: 1,
        fields,
      };
      await patchBrief({ responsesJson });
      onSaved("Brief draft saved.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save brief draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitBrief() {
    if (!brief || !editable) return;
    const confirmed = window.confirm(
      "Submit this brief? You will not be able to edit the intake form after submission."
    );
    if (!confirmed) return;

    setSubmitting(true);
    onError("");
    try {
      const responsesJson: BriefIntakeResponsesV1 = {
        version: 1,
        fields,
      };
      await patchBrief({ responsesJson, status: "SUBMITTED" });
      onSaved("Brief submitted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to submit brief.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = saving || submitting;

  return (
    <AgentSummaryCard
      title="Brief intake"
      actions={
        editable ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onSaveDraft()}
              disabled={busy}
              className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => void onSubmitBrief()}
              disabled={busy}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
            >
              {submitting ? "Submitting..." : "Submit brief"}
            </button>
          </div>
        ) : null
      }
    >
      {!brief ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create a brief for this project before filling out the intake form.
        </p>
      ) : projectStatus === "ARCHIVED" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          This project is archived. The brief intake form is read-only.
        </p>
      ) : !editable ? (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          This brief has been submitted and can no longer be edited.
        </p>
      ) : null}

      {brief ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {BRIEF_INTAKE_FIELD_DEFINITIONS.map(({ key, label }) => (
            <label
              key={key}
              className={`grid gap-1 text-xs text-zinc-500 dark:text-zinc-400 ${
                key === "objective" || key === "deliverables" || key === "openQuestions"
                  ? "sm:col-span-2"
                  : ""
              }`}
            >
              <span>{label}</span>
              <textarea
                value={fields[key]}
                onChange={(e) => updateField(key, e.target.value)}
                readOnly={!editable}
                rows={key === "objective" || key === "openQuestions" ? 4 : 3}
                className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 read-only:bg-zinc-50 read-only:text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:read-only:bg-zinc-950 dark:read-only:text-zinc-400"
              />
            </label>
          ))}
        </div>
      ) : null}
    </AgentSummaryCard>
  );
}
