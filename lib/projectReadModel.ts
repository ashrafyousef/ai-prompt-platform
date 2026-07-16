import type { ProjectStatus } from "@prisma/client";
import { parseBriefDocumentJson } from "@/lib/briefIntake";
import { parseStrategyDocumentJson } from "@/lib/strategyDocument";
import type { ProjectActorContext } from "@/lib/projectAccess";
import { canManageProjectForActor } from "@/lib/projectAccess";

/** Active same-workspace teams only on MEMBER-capable project reads. */
export const projectReadTeamSelect = {
  teamId: true,
  team: {
    select: {
      id: true,
      name: true,
      slug: true,
      workspaceId: true,
      isArchived: true,
    },
  },
} as const;

export const projectReadSummarySelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  clientId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, slug: true } },
  teamAssignments: { select: projectReadTeamSelect },
} as const;

export const projectReadBriefSelect = {
  id: true,
  projectId: true,
  title: true,
  status: true,
  responsesJson: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const projectReadStrategySelect = {
  id: true,
  projectId: true,
  sourceBriefId: true,
  status: true,
  responsesJson: true,
  readyAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const projectReadDetailSelect = {
  ...projectReadSummarySelect,
  brief: { select: projectReadBriefSelect },
  strategy: { select: projectReadStrategySelect },
} as const;

export type ProjectReadRow = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus | string;
  clientId: string | null;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string; slug: string } | null;
  teamAssignments: Array<{
    teamId: string;
    team: {
      id: string;
      name: string;
      slug: string;
      workspaceId: string | null;
      isArchived: boolean;
    } | null;
  }>;
};

export type ProjectReadDetailRow = ProjectReadRow & {
  brief: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    responsesJson: unknown;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  strategy: {
    id: string;
    projectId: string;
    sourceBriefId: string;
    status: string;
    responsesJson: unknown;
    readyAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
};

function activeAssignedTeams(
  workspaceId: string,
  assignments: ProjectReadRow["teamAssignments"]
) {
  return assignments
    .filter(
      (a) =>
        a.team &&
        !a.team.isArchived &&
        a.team.workspaceId === workspaceId
    )
    .map((a) => ({
      id: a.team!.id,
      name: a.team!.name,
      slug: a.team!.slug,
    }));
}

function serializeBriefRead(
  brief: ProjectReadDetailRow["brief"]
) {
  if (!brief) return null;
  return {
    id: brief.id,
    projectId: brief.projectId,
    title: brief.title,
    status: brief.status,
    responsesJson: parseBriefDocumentJson(brief.responsesJson),
    submittedAt: brief.submittedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
  };
}

function serializeStrategyRead(
  strategy: ProjectReadDetailRow["strategy"]
) {
  if (!strategy) return null;
  return {
    id: strategy.id,
    projectId: strategy.projectId,
    sourceBriefId: strategy.sourceBriefId,
    status: strategy.status,
    responsesJson: parseStrategyDocumentJson(strategy.responsesJson),
    readyAt: strategy.readyAt?.toISOString() ?? null,
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
  };
}

export function serializeProjectReadSummary(project: ProjectReadRow) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    clientId: project.clientId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
          slug: project.client.slug,
        }
      : null,
    teams: activeAssignedTeams(project.workspaceId, project.teamAssignments),
  };
}

export function serializeProjectReadDetail(project: ProjectReadDetailRow) {
  return {
    ...serializeProjectReadSummary(project),
    brief: serializeBriefRead(project.brief),
    strategy: serializeStrategyRead(project.strategy),
  };
}

export function serializeProjectReadViewer(actor: ProjectActorContext) {
  return {
    workspaceRole: actor.workspaceRole,
    platformRole: actor.platformRole,
    teamId: actor.teamId,
    canManageProjects: canManageProjectForActor(actor),
  };
}
