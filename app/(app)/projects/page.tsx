"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, PageHeader, PageShell, StatusChip } from "@/components/ui";
import { useProjectAccess } from "@/components/projects/ProjectAccessProvider";
import { uiTokens } from "@/lib/ui/tokens";
import type { StatusChipStatus } from "@/components/ui";

type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";

type ProjectRow = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string }>;
};

function apiError(data: { error?: string; message?: string }, fallback: string): string {
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

function formatTeams(teams: ProjectRow["teams"]): string {
  if (teams.length === 0) return "—";
  return teams.map((t) => t.name).join(", ");
}

function statusChip(status: ProjectStatus): { status: StatusChipStatus; label: string } {
  switch (status) {
    case "ACTIVE":
      return { status: "active", label: "Active" };
    case "ARCHIVED":
      return { status: "archived", label: "Archived" };
    default:
      return { status: "draft", label: "Draft" };
  }
}

const desktopProjectLinkClass =
  "rounded-md px-1 py-0.5 font-medium text-zinc-900 underline-offset-2 transition-colors hover:bg-zinc-100 hover:text-zinc-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus-visible:ring-offset-zinc-950";

const mobileProjectLinkClass =
  "block rounded-2xl p-4 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:hover:bg-zinc-900 dark:focus-visible:ring-offset-zinc-950";

function ProjectsWorkspacePage() {
  const { canManageProjects } = useProjectAccess();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      setLoadFailed(false);
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        const data = (await res.json()) as {
          error?: string;
          message?: string;
          projects?: ProjectRow[];
        };

        if (res.status === 403) {
          setError(data.message ?? data.error ?? "You are not authorized to view projects.");
          setLoadFailed(true);
          return;
        }
        if (!res.ok || !data.projects) {
          setError(apiError(data, "Failed to load projects."));
          setLoadFailed(true);
          return;
        }

        setProjects(data.projects);
      } catch {
        setError("Failed to load projects.");
        setLoadFailed(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const emptyMessage = canManageProjects
    ? "No projects yet. Create one from Admin → Projects."
    : "No projects are currently assigned to your team.";

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading projects...</div>;
  }

  if (loadFailed) {
    return (
      <PageShell>
        <PageHeader
          title="Projects"
          description={
            canManageProjects
              ? "Open a project workspace to continue chats, briefs, and strategy direction."
              : "View projects assigned to your team."
          }
        />
        <div className={uiTokens.alert.danger}>{error}</div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Projects"
        description={
          canManageProjects
            ? "Open a project workspace to continue chats, briefs, and strategy direction."
            : "View projects assigned to your team."
        }
        actions={
          canManageProjects ? (
            <Link
              href="/admin/projects"
              className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Manage in Admin
            </Link>
          ) : undefined
        }
      />

      {error ? <div className={uiTokens.alert.danger}>{error}</div> : null}

      <div className="space-y-3 md:hidden">
        {projects.length === 0 ? (
          <Card padding="md" className="text-sm text-zinc-500 dark:text-zinc-400">
            {emptyMessage}
          </Card>
        ) : (
          projects.map((project) => {
            const chip = statusChip(project.status);
            return (
              <Card key={`mobile-${project.id}`} padding="none">
                <Link
                  href={`/projects/${encodeURIComponent(project.id)}`}
                  className={mobileProjectLinkClass}
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {project.name}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusChip status={chip.status} label={chip.label} />
                    {project.client ? (
                      <Badge variant="neutral" size="md">
                        {project.client.name}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                    Teams: {formatTeams(project.teams)} · Updated {formatDate(project.updatedAt)}
                  </p>
                </Link>
              </Card>
            );
          })
        )}
      </div>

      <Card padding="none" className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr className="text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Teams</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 text-sm dark:divide-zinc-900">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const chip = statusChip(project.status);
                return (
                  <tr key={project.id}>
                    <td className="px-4 py-3">
                      <Link
                        href={`/projects/${encodeURIComponent(project.id)}`}
                        className={desktopProjectLinkClass}
                      >
                        {project.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={chip.status} label={chip.label} />
                    </td>
                    <td className="px-4 py-3">{project.client?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatTeams(project.teams)}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {formatDate(project.updatedAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </PageShell>
  );
}

export default function ProjectsPage() {
  return (
    <main className="mx-auto max-w-6xl p-6">
      <ProjectsWorkspacePage />
    </main>
  );
}
