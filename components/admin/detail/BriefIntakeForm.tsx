"use client";

import { useEffect, useState } from "react";
import {
  BRIEF_INTAKE_FIELD_DEFINITIONS,
  type BriefDocumentV2,
  type BriefIntakeFieldKey,
  emptyBriefIntakeFields,
} from "@/lib/briefIntake";
import { canEditBriefResponses } from "@/lib/briefAccess";
import { AgentSummaryCard } from "./AgentSummaryCard";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

const READ_ONLY_BRIEF_MESSAGE =
  "This brief is submitted/read-only. Reopen or create a new draft to edit.";

const READ_ONLY_TEXTAREA_CLASS =
  "read-only:cursor-default read-only:border-zinc-200 read-only:bg-zinc-100 read-only:text-zinc-600 dark:read-only:border-zinc-700 dark:read-only:bg-zinc-900/80 dark:read-only:text-zinc-400";

type BriefIntakeBrief = {
  id: string;
  status: string;
  responsesJson: BriefDocumentV2;
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
  onError: (message: string | null) => void;
}) {
  const [fields, setFields] = useState(
    () => brief?.responsesJson.fields ?? emptyBriefIntakeFields()
  );
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const briefStatus = (brief?.status ?? "DRAFT") as BriefStatus;
  const editable =
    brief !== null && canEditBriefResponses(briefStatus, projectStatus);
  const isReadOnlyBrief = brief !== null && briefStatus !== "DRAFT" && projectStatus !== "ARCHIVED";

  useEffect(() => {
    setFields(brief?.responsesJson.fields ?? emptyBriefIntakeFields());
  }, [brief]);

  function updateField(key: BriefIntakeFieldKey, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function patchBrief(payload: {
    responsesJson?: { fields: typeof fields };
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
    onError(null);
    try {
      await patchBrief({ responsesJson: { fields } });
      onSaved("Master brief draft saved.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to save master brief draft.");
    } finally {
      setSaving(false);
    }
  }

  async function onSubmitBrief() {
    if (!brief || !editable) return;
    const confirmed = window.confirm(
      "Submit this master brief? You will not be able to edit it after submission."
    );
    if (!confirmed) return;

    setSubmitting(true);
    onError(null);
    try {
      await patchBrief({ responsesJson: { fields }, status: "SUBMITTED" });
      onSaved("Master brief submitted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Failed to submit master brief.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = saving || submitting;

  return (
    <AgentSummaryCard
      title="Master brief"
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
          Create a brief for this project before editing the master brief.
        </p>
      ) : projectStatus === "ARCHIVED" ? (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          This project is archived. The master brief is read-only.
        </p>
      ) : isReadOnlyBrief ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
          {READ_ONLY_BRIEF_MESSAGE}
        </div>
      ) : (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          Review and refine the structured master brief before submission.
        </p>
      )}

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
                tabIndex={editable ? 0 : -1}
                aria-readonly={!editable}
                rows={key === "objective" || key === "openQuestions" ? 4 : 3}
                className={`w-full resize-y select-text rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${READ_ONLY_TEXTAREA_CLASS}`}
              />
            </label>
          ))}
        </div>
      ) : null}
    </AgentSummaryCard>
  );
}
