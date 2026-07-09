import Link from "next/link";
import { Button, Panel } from "@/components/ui";
import type { BriefStatus, ProjectChatSession, ProjectDetail } from "./types";

type NextAction = {
  id: string;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
};

function buildNextActions(params: {
  project: ProjectDetail;
  briefStatus: BriefStatus;
  sessions: ProjectChatSession[];
  onNewProjectChat: () => void;
  onCreateBrief: () => void;
}): NextAction[] {
  const { project, briefStatus, sessions, onNewProjectChat, onCreateBrief } = params;
  const actions: NextAction[] = [];

  actions.push({
    id: "start-chat",
    label: "Start a project chat",
    description: "Open a new conversation linked to this project.",
    onClick: onNewProjectChat,
  });

  if (sessions.length > 0) {
    actions.push({
      id: "review-chats",
      label: "Review existing project chats",
      description: `${sessions.length} linked chat${sessions.length === 1 ? "" : "s"} available.`,
      href: "#project-chats",
    });
  }

  if (!project.brief && project.status !== "ARCHIVED") {
    actions.push({
      id: "create-brief",
      label: "Create project brief",
      description: "Capture objectives and requirements before strategy work.",
      onClick: onCreateBrief,
    });
  }

  if (project.brief && (briefStatus === "SUBMITTED" || briefStatus === "IN_REVIEW")) {
    actions.push({
      id: "review-brief",
      label: "Review submitted brief",
      description: "Check intake responses and analysis before approval.",
      href: "#brief",
    });
  }

  if (project.brief && briefStatus === "APPROVED" && project.strategy?.status === "DRAFT") {
    actions.push({
      id: "continue-strategy",
      label: "Continue strategy direction",
      description: "Refine positioning and messaging before creative handoff.",
      href: "#strategy",
    });
  }

  if (project.strategy?.status === "READY_FOR_CREATIVE") {
    actions.push({
      id: "creative-handoff",
      label: "Prepare creative handoff",
      description: "Strategy is ready — review direction before creative production.",
      href: "#strategy",
    });
  }

  if (project.brief && briefStatus === "DRAFT" && project.status !== "ARCHIVED") {
    actions.push({
      id: "add-context",
      label: "Add project context",
      description: "Complete the brief intake to build project context.",
      href: "#brief",
    });
  }

  return actions;
}

export type ProjectNextActionsProps = {
  project: ProjectDetail;
  briefStatus: BriefStatus;
  sessions: ProjectChatSession[];
  onNewProjectChat: () => void;
  onCreateBrief: () => void;
};

export function ProjectNextActions({
  project,
  briefStatus,
  sessions,
  onNewProjectChat,
  onCreateBrief,
}: ProjectNextActionsProps) {
  const actions = buildNextActions({
    project,
    briefStatus,
    sessions,
    onNewProjectChat,
    onCreateBrief,
  });

  return (
    <Panel
      title="Suggested Next Actions"
      description="Practical next steps based on this project's current state. These are suggestions, not tasks."
      padding="md"
    >
      <ul className="space-y-3">
        {actions.map((action) => (
          <li
            key={action.id}
            className="rounded-lg border border-zinc-200/80 bg-zinc-50/50 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{action.label}</p>
                {action.description ? (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{action.description}</p>
                ) : null}
              </div>
              {action.href ? (
                <Link
                  href={action.href}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  Go
                </Link>
              ) : action.onClick ? (
                <Button type="button" variant="outline" size="sm" onClick={action.onClick}>
                  Go
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
