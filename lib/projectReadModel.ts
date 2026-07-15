import type { ProjectStatus } from "@prisma/client";
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

export function serializeProjectReadDetail(project: ProjectReadRow) {
  return serializeProjectReadSummary(project);
}

export function serializeProjectReadViewer(actor: ProjectActorContext) {
  return {
    workspaceRole: actor.workspaceRole,
    platformRole: actor.platformRole,
    teamId: actor.teamId,
    canManageProjects: canManageProjectForActor(actor),
  };
}
