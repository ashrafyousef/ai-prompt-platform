import type { ProjectStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AuthorizedUserContext } from "@/lib/auth";
import type { WorkspaceMemberManagerContext } from "@/lib/adminAuth";

export type ProjectActorContext = {
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  /**
   * Eligible team for matching. Must be WorkspaceMember.teamId after
   * active same-workspace validation (or null for genuine teamless membership).
   */
  teamId: string | null;
};

export type ProjectAssignedTeam = {
  id: string;
  workspaceId: string | null;
  isArchived: boolean;
};

/**
 * Authorization target for project visibility checks.
 * Team-scoped actors require validated {@link assignedTeams} metadata.
 * Raw {@link assignedTeamIds} never independently authorizes team-scoped access.
 */
export type ProjectAccessTarget = {
  workspaceId: string;
  status: ProjectStatus;
  /** Validated Team rows only. Absent/empty → deny for team-scoped actors. */
  assignedTeams: ProjectAssignedTeam[];
  /**
   * @deprecated Compatibility only. Never used for team-scoped authorization.
   */
  assignedTeamIds?: string[];
};

export type ProjectViewOptions = {
  /** Managers viewing via admin APIs may pass true. MEMBER read APIs leave false. */
  includeArchivedProjects?: boolean;
};

export type ProjectAssignmentAccessRow = {
  teamId: string;
  team: { id: string; workspaceId: string | null; isArchived: boolean } | null;
};

/** Prisma select for assignment Team metadata used by authorization callers. */
export const projectTeamAssignmentAccessSelect = {
  teamId: true,
  team: {
    select: {
      id: true,
      workspaceId: true,
      isArchived: true,
    },
  },
} as const;

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

/** Manager mutation gate — OWNER, workspace ADMIN, or platform ADMIN. */
export function canManageProjectForActor(actor: ProjectActorContext): boolean {
  if (actor.platformRole === "ADMIN") return true;
  return actor.workspaceRole === "OWNER" || actor.workspaceRole === "ADMIN";
}

/**
 * @deprecated Prefer project actor from requireProjectActorContext.
 * AuthorizedUserContext.teamId may fall back to User.teamId — unsafe for project auth.
 */
export function toProjectActorContext(auth: AuthorizedUserContext): ProjectActorContext {
  return {
    workspaceId: auth.workspaceId,
    workspaceRole: auth.workspaceRole,
    platformRole: auth.role,
    teamId: auth.teamId,
  };
}

/** Manager context uses WorkspaceMember.teamId only (no User.teamId). */
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

/**
 * Eligible assignment team IDs from validated Team metadata only.
 * Raw assignedTeamIds are ignored — fail closed when metadata is absent.
 */
export function eligibleAssignedTeamIds(project: ProjectAccessTarget): string[] {
  if (!Array.isArray(project.assignedTeams)) {
    return [];
  }

  return project.assignedTeams
    .filter(
      (team) =>
        Boolean(team.id) &&
        !team.isArchived &&
        team.workspaceId === project.workspaceId
    )
    .map((team) => team.id);
}

/** Active-project list filter for MEMBER-capable and manager read APIs. */
export function buildProjectReadListWhere(
  actor: ProjectActorContext,
  options: { clientId?: string | null } = {}
): Prisma.ProjectWhereInput {
  const where: Prisma.ProjectWhereInput = {
    workspaceId: actor.workspaceId,
    status: { not: "ARCHIVED" },
  };

  if (options.clientId) {
    where.clientId = options.clientId;
  }

  if (!isWorkspaceWideProjectViewer(actor)) {
    if (!actor.teamId) {
      where.id = { in: [] };
    } else {
      where.teamAssignments = {
        some: {
          teamId: actor.teamId,
          team: {
            isArchived: false,
            workspaceId: actor.workspaceId,
          },
        },
      };
    }
  }

  return where;
}

/** Direct project lookup constrained to readable set. */
export function buildProjectReadTargetWhere(
  actor: ProjectActorContext,
  projectId: string
): Prisma.ProjectWhereInput {
  // Compose with AND so teamless empty-id denies are not overwritten by projectId.
  return {
    AND: [buildProjectReadListWhere(actor), { id: projectId }],
  };
}

/**
 * Admin list filter — preserves includeArchived for manager admin UI.
 * Prefer {@link buildProjectReadListWhere} for MEMBER-capable reads.
 */
export function buildAdminProjectListWhere(
  actor: ProjectActorContext,
  options: { includeArchived?: boolean; clientId?: string | null }
): Prisma.ProjectWhereInput {
  if (!options.includeArchived) {
    return buildProjectReadListWhere(actor, { clientId: options.clientId });
  }

  const where: Prisma.ProjectWhereInput = {
    workspaceId: actor.workspaceId,
  };

  if (options.clientId) {
    where.clientId = options.clientId;
  }

  if (!isWorkspaceWideProjectViewer(actor)) {
    if (!actor.teamId) {
      where.id = { in: [] };
    } else {
      where.teamAssignments = {
        some: {
          teamId: actor.teamId,
          team: {
            isArchived: false,
            workspaceId: actor.workspaceId,
          },
        },
      };
    }
  }

  return where;
}

/**
 * Read-time project visibility.
 * Archived projects denied unless includeArchivedProjects (admin manager views).
 * Team-matched access requires validated active same-workspace assignment teams.
 * Raw assignment IDs never authorize team-scoped actors.
 */
export function canViewProjectForActor(
  actor: ProjectActorContext,
  project: ProjectAccessTarget,
  options: ProjectViewOptions = {}
): boolean {
  if (project.workspaceId !== actor.workspaceId) return false;

  if (project.status === "ARCHIVED" && !options.includeArchivedProjects) {
    return false;
  }

  if (isWorkspaceWideProjectViewer(actor)) return true;

  if (!actor.teamId) return false;
  return eligibleAssignedTeamIds(project).includes(actor.teamId);
}

/**
 * Map Prisma assignment rows into validated Team metadata.
 * Missing related Team or team.id !== assignment.teamId → omitted (invalid).
 */
export function projectAssignedTeamsFromRows(
  rows: ProjectAssignmentAccessRow[]
): ProjectAssignedTeam[] {
  return rows
    .filter(
      (row) =>
        row.team != null &&
        Boolean(row.team.id) &&
        row.team.id === row.teamId
    )
    .map((row) => ({
      id: row.team!.id,
      workspaceId: row.team!.workspaceId ?? null,
      isArchived: Boolean(row.team!.isArchived),
    }));
}

export function toProjectAccessTargetFromAssignments(
  project: { workspaceId: string; status: ProjectStatus },
  assignments: ProjectAssignmentAccessRow[]
): ProjectAccessTarget {
  const assignedTeams = projectAssignedTeamsFromRows(assignments);
  return {
    workspaceId: project.workspaceId,
    status: project.status,
    assignedTeams,
    assignedTeamIds: assignedTeams.map((t) => t.id),
  };
}
