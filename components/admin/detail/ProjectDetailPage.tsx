"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { canApproveBrief, canReopenBrief } from "@/lib/briefAccess";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { PageShell, Panel } from "@/components/ui";
import { uiTokens } from "@/lib/ui/tokens";
import {
  ProjectBriefPanel,
  ProjectChatsPanel,
  ProjectContextPanel,
  ProjectKnowledgePanel,
  ProjectNextActions,
  ProjectStrategyPanel,
  ProjectWorkspaceHeader,
  type BriefStatus,
  type ProjectChatSession,
  type ProjectDetail,
} from "@/components/projects";

function adminApiError(data: { error?: string; message?: string }, fallback: string): string {
  if (data.message) return data.message;
  return data.error ?? fallback;
}

export function ProjectDetailPage({ projectId }: { projectId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const projectPath = `/projects/${projectId}`;
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [creatingBrief, setCreatingBrief] = useState(false);
  const [reopeningBrief, setReopeningBrief] = useState(false);
  const [approvingBrief, setApprovingBrief] = useState(false);
  const [projectChats, setProjectChats] = useState<ProjectChatSession[]>([]);
  const [projectChatsLoading, setProjectChatsLoading] = useState(false);
  const [creatingProjectChat, setCreatingProjectChat] = useState(false);

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

  const loadProjectChats = useCallback(async () => {
    setProjectChatsLoading(true);
    try {
      const res = await fetch(`/api/admin/projects/${encodeURIComponent(projectId)}/chats`, {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        sessions?: ProjectChatSession[];
      };

      if (!res.ok || !Array.isArray(data.sessions)) {
        setProjectChats([]);
        return;
      }

      setProjectChats(data.sessions);
    } catch {
      setProjectChats([]);
    } finally {
      setProjectChatsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!project || pathname !== projectPath) return;

    void loadProjectChats();

    const refreshChats = () => {
      if (document.visibilityState === "visible") {
        void loadProjectChats();
      }
    };

    window.addEventListener("focus", refreshChats);
    document.addEventListener("visibilitychange", refreshChats);
    window.addEventListener("pageshow", refreshChats);

    return () => {
      window.removeEventListener("focus", refreshChats);
      document.removeEventListener("visibilitychange", refreshChats);
      window.removeEventListener("pageshow", refreshChats);
    };
  }, [project, pathname, projectPath, loadProjectChats]);

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

  async function onNewProjectChat() {
    if (!project) return;
    setCreatingProjectChat(true);
    setError(null);
    try {
      const res = await fetch("/api/chat/new", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        session?: { id: string };
      };

      if (!res.ok || !data.session?.id) {
        setError(adminApiError(data, "Failed to create chat."));
        return;
      }

      router.push(`/chat?sessionId=${encodeURIComponent(data.session.id)}`);
    } catch {
      setError("Failed to create chat.");
    } finally {
      setCreatingProjectChat(false);
    }
  }

  if (loading) {
    return <div className="py-10 text-sm text-zinc-500">Loading project...</div>;
  }

  if (loadFailed || !project) {
    return (
      <PageShell>
        <AdminBreadcrumbs
          crumbs={[
            { label: "Projects", href: "/projects" },
            { label: "Project" },
          ]}
        />
        <div className={uiTokens.alert.danger}>{error ?? "Project not found."}</div>
        <Link
          href="/projects"
          className="inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          ← Back to projects
        </Link>
      </PageShell>
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
    <PageShell>
      <AdminBreadcrumbs
        crumbs={[
          { label: "Projects", href: "/projects" },
          { label: project.name },
        ]}
      />

      <ProjectWorkspaceHeader
        project={project}
        creatingProjectChat={creatingProjectChat}
        onNewProjectChat={() => void onNewProjectChat()}
      />

      {error ? <div className={uiTokens.alert.danger}>{error}</div> : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <ProjectChatsPanel
            sessions={projectChats}
            loading={projectChatsLoading}
            creating={creatingProjectChat}
            onNewProjectChat={() => void onNewProjectChat()}
          />

          <ProjectBriefPanel
            project={project}
            briefStatus={briefStatus}
            canCreateBrief={canCreateBrief}
            showReopenBrief={showReopenBrief}
            showApproveBrief={showApproveBrief}
            creatingBrief={creatingBrief}
            reopeningBrief={reopeningBrief}
            approvingBrief={approvingBrief}
            lifecycleBusy={lifecycleBusy}
            onCreateBrief={() => void onCreateBrief()}
            onReopenBrief={() => void onReopenBrief()}
            onApproveBrief={() => void onApproveBrief()}
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
            onApplied={(message) => {
              setSuccessMessage(message);
              setError(null);
              void load();
            }}
            onError={(message) => setError(message)}
          />

          <ProjectStrategyPanel project={project} briefStatus={briefStatus} />
        </div>

        <div className="space-y-6">
          <ProjectContextPanel />
          <ProjectKnowledgePanel />
          <ProjectNextActions
            project={project}
            briefStatus={briefStatus}
            sessions={projectChats}
            onNewProjectChat={() => void onNewProjectChat()}
            onCreateBrief={() => void onCreateBrief()}
          />
          <Panel
            title="Files / References"
            description="Uploaded references and project files will appear here in a later phase."
            padding="md"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              File upload management is not available yet. Use project chats and brief intake for now.
            </p>
          </Panel>
        </div>
      </div>
    </PageShell>
  );
}
