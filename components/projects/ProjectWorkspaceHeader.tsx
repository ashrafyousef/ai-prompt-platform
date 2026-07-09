import Link from "next/link";
import { Badge, Button, InlineActions, StatusChip } from "@/components/ui";
import type { ProjectDetail } from "./types";
import { formatProjectTeams } from "./types";

function projectStatusChip(status: ProjectDetail["status"]) {
  switch (status) {
    case "ACTIVE":
      return <StatusChip status="active" />;
    case "ARCHIVED":
      return <StatusChip status="archived" />;
    default:
      return <StatusChip status="draft" label="Draft" />;
  }
}

export type ProjectWorkspaceHeaderProps = {
  project: ProjectDetail;
  creatingProjectChat: boolean;
  onNewProjectChat: () => void;
};

export function ProjectWorkspaceHeader({
  project,
  creatingProjectChat,
  onNewProjectChat,
}: ProjectWorkspaceHeaderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {project.name}
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Project workspace for chats, briefs, and strategy direction.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {projectStatusChip(project.status)}
            {project.client ? (
              <Badge variant="neutral" size="md">
                Client: {project.client.name}
              </Badge>
            ) : (
              <Badge variant="neutral" size="md">
                No client
              </Badge>
            )}
            <Badge variant="neutral" size="md">
              Teams: {formatProjectTeams(project.teams)}
            </Badge>
          </div>
        </div>
        <InlineActions className="shrink-0 lg:justify-end">
          <Button type="button" onClick={onNewProjectChat} disabled={creatingProjectChat}>
            {creatingProjectChat ? "Creating..." : "New project chat"}
          </Button>
          <Link
            href="/admin/projects"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/80 focus-visible:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:ring-offset-zinc-950"
          >
            Back to projects
          </Link>
        </InlineActions>
      </div>
    </div>
  );
}
