"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell, Panel } from "@/components/ui";
import { uiTokens } from "@/lib/ui/tokens";
import { MemberProjectBriefSection } from "./MemberProjectBriefSection";
import {
  MemberProjectBreadcrumbs,
  MemberProjectSideRail,
} from "./MemberProjectSideRail";
import { MemberProjectStrategySection } from "./MemberProjectStrategySection";
import { ProjectWorkspaceHeader } from "./ProjectWorkspaceHeader";
import type { ProjectDetail } from "./types";

function apiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

export function MemberProjectDetailPage({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadFailed(false);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
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
        setError(data.error ?? "Access denied.");
        setLoadFailed(true);
        return;
      }
      if (!res.ok || !data.project) {
        setError(apiError(data, "Failed to load project."));
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

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading project...</div>;
  }

  if (loadFailed || !project) {
    return (
      <PageShell>
        <div className={uiTokens.alert.danger}>{error ?? "Project not found."}</div>
        <Link
          href="/projects"
          className="mt-4 inline-flex text-sm font-medium text-zinc-700 underline underline-offset-2 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          Back to projects
        </Link>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="space-y-6">
        <MemberProjectBreadcrumbs projectName={project.name} />
        <ProjectWorkspaceHeader project={project} readOnly />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <MemberProjectBriefSection brief={project.brief} />
            <MemberProjectStrategySection strategy={project.strategy} />
          </div>
          <MemberProjectSideRail teams={project.teams} />
        </div>
      </div>
    </PageShell>
  );
}
