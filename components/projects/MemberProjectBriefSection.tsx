"use client";

import Link from "next/link";
import { Badge, Panel, StatusChip } from "@/components/ui";
import {
  BRIEF_INTAKE_FIELD_DEFINITIONS,
  type BriefDocumentV2,
} from "@/lib/briefIntake";
import type { BriefSummary } from "./types";
import { formatProjectDateTime } from "./types";

function briefStatusLabel(status: string): string {
  return status.replace(/_/g, " ");
}

function formatFieldValue(value: string): string {
  return value.trim().length > 0 ? value : "Not provided";
}

function severityClasses(severity: "info" | "warning"): string {
  return severity === "warning"
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200"
    : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300";
}

export function MemberProjectBriefSection({ brief }: { brief: BriefSummary | null }) {
  if (!brief) {
    return (
      <Panel title="Brief" description="Project brief and intake content." padding="md">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No brief has been added to this project yet.
        </p>
      </Panel>
    );
  }

  const document: BriefDocumentV2 = brief.responsesJson;

  return (
    <Panel title="Brief" description="Read-only project brief content." padding="md">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-medium text-zinc-900 dark:text-zinc-100">{brief.title}</h3>
          <StatusChip status="draft" label={briefStatusLabel(brief.status)} />
        </div>
        <dl className="grid gap-2 text-xs text-zinc-500 dark:text-zinc-400 sm:grid-cols-3">
          <div>
            <dt className="font-medium uppercase tracking-wide">Created</dt>
            <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
              {formatProjectDateTime(brief.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide">Updated</dt>
            <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
              {formatProjectDateTime(brief.updatedAt)}
            </dd>
          </div>
          <div>
            <dt className="font-medium uppercase tracking-wide">Submitted</dt>
            <dd className="mt-0.5 text-zinc-700 dark:text-zinc-300">
              {brief.submittedAt ? formatProjectDateTime(brief.submittedAt) : "—"}
            </dd>
          </div>
        </dl>

        {document.source?.rawText ? (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Client brief (raw)
            </p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {document.source.rawText}
            </p>
          </div>
        ) : null}

        {document.analysis?.issues && document.analysis.issues.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Brief analysis
            </p>
            <ul className="space-y-2">
              {document.analysis.issues.map((issue, index) => (
                <li
                  key={`${issue.code}-${index}`}
                  className={`rounded-md border px-3 py-2 text-sm ${severityClasses(issue.severity)}`}
                >
                  {issue.message}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Master brief
          </p>
          {BRIEF_INTAKE_FIELD_DEFINITIONS.map((field) => (
            <div key={field.key} className="border-b border-zinc-100 pb-3 last:border-0 dark:border-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{field.label}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
                {formatFieldValue(document.fields[field.key])}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}
