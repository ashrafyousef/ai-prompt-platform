import type { ProjectStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AuthorizedUserContext } from "@/lib/auth";
import type { WorkspaceMemberManagerContext } from "@/lib/adminAuth";

export type ProjectActorContext = {
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
};

export type ProjectAccessTarget = {
  workspaceId: string;
  status: ProjectStatus;
  assignedTeamIds: string[];
};

/**
 * Workspace-wide project visibility:
 * - OWNER
 * - platform ADMIN
 * - workspace ADMIN with no team assignment
 */
export function isWorkspaceWideProjectViewer(actor: ProjectActorContext): boolean {
  if (actor.workspaceRole === "OWNER") return true;
  if (actor.platformRole === "ADMIN") return true;
  if (actor.workspaceRole === "ADMIN" && !actor.teamId) return true;
  return false;
}

export function toProjectActorContext(auth: AuthorizedUserContext): ProjectActorContext {
  return {
    workspaceId: auth.workspaceId,
    workspaceRole: auth.workspaceRole,
    platformRole: auth.role,
    teamId: auth.teamId,
  };
}

export function toProjectActorContextFromManager(
  auth: WorkspaceMemberManagerContext
): ProjectActorContext {
  return {
    workspaceId: auth.workspaceId,
    workspaceRole: auth.workspaceRole,
    platformRole: auth.platformRole,
    teamId: auth.teamId,
  };
}

/** Admin project list filter aligned with {@link canViewProjectForActor}. */
export function buildAdminProjectListWhere(
  actor: ProjectActorContext,
  options: { includeArchived?: boolean; clientId?: string | null }
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    workspaceId: actor.workspaceId,
  };

  if (!options.includeArchived) {
    where.status = { not: "ARCHIVED" };
  }

  if (options.clientId) {
    where.clientId = options.clientId;
  }

  if (!isWorkspaceWideProjectViewer(actor)) {
    if (!actor.teamId) {
      where.id = { in: [] };
    } else {
      where.teamAssignments = { some: { teamId: actor.teamId } };
    }
  }

  return where;
}

/**
 * Read-time project visibility for Beta 1.2 task domain.
 * Project status (including ARCHIVED) does not restrict view access.
 */
export function canViewProjectForActor(
  actor: ProjectActorContext,
  project: ProjectAccessTarget
): boolean {
  if (project.workspaceId !== actor.workspaceId) return false;
  if (isWorkspaceWideProjectViewer(actor)) return true;

  if (!actor.teamId) return false;
  return project.assignedTeamIds.includes(actor.teamId);
}
