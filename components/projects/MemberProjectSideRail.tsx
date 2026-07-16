"use client";

import Link from "next/link";
import { Badge, Panel } from "@/components/ui";
import { ProjectKnowledgePanel } from "./ProjectKnowledgePanel";
import { useProjectAccess } from "./ProjectAccessProvider";

export function MemberProjectAccessPanel({
  teams,
}: {
  teams: Array<{ id: string; name: string }>;
}) {
  const viewer = useProjectAccess();
  const teamLabel =
    teams.length > 0 ? teams.map((team) => team.name).join(", ") : viewer.teamId ?? "—";


  return (
    <Panel title="Your access" description="How you can use this project workspace." padding="md">
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Access level
          </dt>
          <dd className="mt-1 text-zinc-800 dark:text-zinc-200">Read-only</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Workspace role
          </dt>
          <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{viewer.workspaceRole ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Assigned team
          </dt>
          <dd className="mt-1 text-zinc-800 dark:text-zinc-200">{teamLabel}</dd>
        </div>
      </dl>
    </Panel>
  );
}

export function MemberProjectContextPanel() {
  return (
    <Panel
      title="Project Context"
      description="What is available in this read-only workspace."
      padding="md"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        You can review project metadata, brief content, and strategy direction. Project chats and
        automated project memory are not available in this phase.
      </p>
      <div className="mt-4 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Available now
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Project metadata", "Briefs", "Strategy direction"].map((item) => (
              <Badge key={item} variant="success" size="md">
                {item}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Planned later
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {["Project chats", "Confirmed project memory", "Uploaded references"].map((item) => (
              <Badge key={item} variant="neutral" size="md">
                {item}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export function MemberProjectFilesPanel() {
  return (
    <Panel title="Files / References" description="Uploaded project references." padding="md">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        File uploads and reference attachments are planned for a later phase.
      </p>
    </Panel>
  );
}

export function MemberProjectSideRail({
  teams,
}: {
  teams: Array<{ id: string; name: string }>;
}) {
  return (
    <div className="space-y-4">
      <MemberProjectAccessPanel teams={teams} />
      <MemberProjectContextPanel />
      <ProjectKnowledgePanel />
      <MemberProjectFilesPanel />
    </div>
  );
}

export function MemberProjectBreadcrumbs({ projectName }: { projectName: string }) {
  return (
    <nav className="text-sm text-zinc-500 dark:text-zinc-400" aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/projects" className="hover:text-zinc-700 dark:hover:text-zinc-200">
            Projects
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="font-medium text-zinc-800 dark:text-zinc-200">{projectName}</li>
      </ol>
    </nav>
  );
}
