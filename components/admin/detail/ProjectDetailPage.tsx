"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { canApproveBrief, canReopenBrief } from "@/lib/briefAccess";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { AgentSummaryCard } from "./AgentSummaryCard";
import { BriefIntakeForm } from "./BriefIntakeForm";
import { RawBriefPanel } from "./RawBriefPanel";
import { BriefAnalysisPanel } from "./BriefAnalysisPanel";
import { ApprovedBriefHandoffPanel } from "./ApprovedBriefHandoffPanel";
import type { BriefDocumentV2 } from "@/lib/briefIntake";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

type BriefSummary = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  responsesJson: BriefDocumentV2;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProjectDetail = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string }>;
  brief: BriefSummary | null;
};

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTeams(teams: ProjectDetail["teams"]): string {
  if (teams.length === 0) return "—";
  return teams.map((team) => team.name).join(", ");
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className="text-right text-xs font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
    </div>
  );
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [creatingBrief, setCreatingBrief] = useState(false);
  const [reopeningBrief, setReopeningBrief] = useState(false);
  const [approvingBrief, setApprovingBrief] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}`);
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        project?: ProjectDetail;
      };

      if (res.status === 404) {
        setError(data.error ?? "Project not found.");
        setLoadFailed(true);
        return;
      }
      if (res.status === 403) {
        setError(data.message ?? data.error ?? "You are not authorized to view this project.");
        setLoadFailed(true);
        return;
      }
      if (!res.ok || !data.project) {
        setError(adminApiError(data, "Failed to load project."));
        setLoadFailed(true);
        return;
      }

      setProject(data.project);
    } catch {
      setError("Failed to load project.");
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreateBrief() {
    if (!project || project.brief || project.status === "ARCHIVED") return;
    setCreatingBrief(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch("/api/admin/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = (await res.json()) as { error?: string; message?: string };

      if (res.status === 409) {
        setSuccessMessage("A brief already exists for this project.");
        await load();
        return;
      }
      if (!res.ok) {
        setError(adminApiError(data, "Failed to create brief."));
        return;
      }

      setSuccessMessage("Brief created.");
      await load();
    } catch {
      setError("Failed to create brief.");
    } finally {
      setCreatingBrief(false);
    }
  }

  async function onReopenBrief() {
    if (!project?.brief || project.status === "ARCHIVED") return;
    const confirmed = window.confirm(
      "Reopen this brief for editing? The brief will return to Draft status."
    );
    if (!confirmed) return;

    setReopeningBrief(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/briefs/${encodeURIComponent(project.brief.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DRAFT" }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to reopen brief."));
        return;
      }
      setSuccessMessage("Brief reopened for editing.");
      await load();
    } catch {
      setError("Failed to reopen brief.");
    } finally {
      setReopeningBrief(false);
    }
  }

  async function onApproveBrief() {
    if (!project?.brief || project.status === "ARCHIVED") return;
    const confirmed = window.confirm(
      "Approve this brief? Approved briefs are locked and ready for downstream work."
    );
    if (!confirmed) return;

    setApprovingBrief(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/admin/briefs/${encodeURIComponent(project.brief.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(adminApiError(data, "Failed to approve brief."));
        return;
      }
      setSuccessMessage("Brief approved.");
      await load();
    } catch {
      setError("Failed to approve brief.");
    } finally {
      setApprovingBrief(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading project...</div>;
  }

  if (loadFailed || !project) {
    return (
      <div className="space-y-6">
        <AdminBreadcrumbs
          crumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Projects", href: "/admin/projects" },
            { label: "Project" },
          ]}
        />
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error ?? "Project not found."}
        </div>
        <Link
          href="/admin/projects"
          className="inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to projects
        </Link>
      </div>
    );
  }

  const canCreateBrief = !project.brief && project.status !== "ARCHIVED";
  const briefStatus = (project.brief?.status ?? "DRAFT") as BriefStatus;
  const showReopenBrief =
    project.brief !== null &&
    project.status !== "ARCHIVED" &&
    canReopenBrief(briefStatus, project.status);
  const showApproveBrief =
    project.brief !== null &&
    project.status !== "ARCHIVED" &&
    canApproveBrief(briefStatus, project.status);
  const lifecycleBusy = reopeningBrief || approvingBrief;

  return (
    <div className="space-y-6">
      <AdminBreadcrumbs
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Projects", href: "/admin/projects" },
          { label: project.name },
        ]}
      />

      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{project.name}</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Project details and linked brief status.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      <AgentSummaryCard title="Project metadata">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <MetadataRow label="Name" value={project.name} />
          <MetadataRow label="Slug" value={project.slug} />
          <MetadataRow label="Status" value={project.status} />
          <MetadataRow label="Client" value={project.client?.name ?? "—"} />
          <MetadataRow label="Teams" value={formatTeams(project.teams)} />
          <MetadataRow label="Created" value={formatDate(project.createdAt)} />
          <MetadataRow label="Updated" value={formatDate(project.updatedAt)} />
        </div>
      </AgentSummaryCard>

      <AgentSummaryCard
        title="Brief"
        actions={
          canCreateBrief || showReopenBrief || showApproveBrief ? (
            <div className="flex flex-wrap gap-2">
              {canCreateBrief ? (
                <button
                  type="button"
                  onClick={() => void onCreateBrief()}
                  disabled={creatingBrief}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {creatingBrief ? "Creating..." : "Create brief"}
                </button>
              ) : null}
              {showReopenBrief ? (
                <button
                  type="button"
                  onClick={() => void onReopenBrief()}
                  disabled={lifecycleBusy}
                  className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {reopeningBrief ? "Reopening..." : "Reopen brief"}
                </button>
              ) : null}
              {showApproveBrief ? (
                <button
                  type="button"
                  onClick={() => void onApproveBrief()}
                  disabled={lifecycleBusy}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {approvingBrief ? "Approving..." : "Approve brief"}
                </button>
              ) : null}
            </div>
          ) : null
        }
      >
        {project.brief ? (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            <MetadataRow label="Title" value={project.brief.title} />
            <MetadataRow label="Status" value={project.brief.status} />
            <MetadataRow label="Created" value={formatDate(project.brief.createdAt)} />
            <MetadataRow label="Updated" value={formatDate(project.brief.updatedAt)} />
            <MetadataRow
              label="Submitted"
              value={project.brief.submittedAt ? formatDateTime(project.brief.submittedAt) : "—"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No brief linked to this project yet.
            </p>
            {project.status === "ARCHIVED" ? (
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                Briefs cannot be created for archived projects.
              </p>
            ) : null}
          </div>
        )}
      </AgentSummaryCard>

      <RawBriefPanel
        briefId={project.brief?.id ?? null}
        briefStatus={project.brief?.status ?? "DRAFT"}
        projectStatus={project.status}
        document={project.brief?.responsesJson ?? null}
        onSaved={(message) => {
          setSuccessMessage(message);
          setError(null);
          void load();
        }}
        onAnalyzed={(message) => {
          setSuccessMessage(message);
          setError(null);
          void load();
        }}
        onError={(message) => setError(message)}
      />

      <BriefAnalysisPanel
        briefId={project.brief?.id ?? null}
        briefStatus={project.brief?.status ?? "DRAFT"}
        projectStatus={project.status}
        document={project.brief?.responsesJson ?? null}
        onApplied={(message) => {
          setSuccessMessage(message);
          setError(null);
          void load();
        }}
        onError={(message) => setError(message)}
      />

      <BriefIntakeForm
        brief={project.brief}
        projectStatus={project.status}
        onSaved={(message) => {
          setSuccessMessage(message);
          setError(null);
          void load();
        }}
        onError={(message) => setError(message || null)}
      />

      {project.brief && briefStatus === "APPROVED" ? (
        <ApprovedBriefHandoffPanel document={project.brief.responsesJson} />
      ) : null}
    </div>
  );
}
