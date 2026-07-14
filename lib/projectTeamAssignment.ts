import {
  isTeamScopedWorkspaceAdmin,
  type WorkspaceMemberManagerContext,
} from "@/lib/adminAuth";
import { db } from "@/lib/db";

export const OWN_TEAM_ONLY_ASSIGNMENT_MESSAGE =
  "Workspace admins can only assign projects to their own team.";

export const INVALID_PROJECT_TEAMS_MESSAGE =
  "One or more teams were not found in this workspace or are archived.";

/**
 * Mirrors POST /api/admin/projects team assignment policy:
 * - OWNER / platform ADMIN / teamless workspace ADMIN: any subset (including empty)
 * - Team-scoped workspace ADMIN: empty → [ownTeam]; foreign teams → denied
 */
export function resolveProjectTeamIdsForManager(
  auth: WorkspaceMemberManagerContext,
  requestedTeamIds: string[] | undefined
): { ok: true; teamIds: string[] } | { ok: false; status: 403; error: string } {
  let teamIds = Array.from(new Set(requestedTeamIds ?? []));

  if (isTeamScopedWorkspaceAdmin(auth) && auth.teamId) {
    if (teamIds.length === 0) {
      teamIds = [auth.teamId];
    } else if (teamIds.some((teamId) => teamId !== auth.teamId)) {
      return { ok: false, status: 403, error: OWN_TEAM_ONLY_ASSIGNMENT_MESSAGE };
    }
  }

  return { ok: true, teamIds };
}

export type AssignmentTeamCatalogEntry = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
};

/**
 * Active-only team catalog for project assignment UI.
 * Unlike GET /api/admin/teams, does not require team context for workspace ADMIN
 * without teamId. Scoped ADMIN with a team only sees that team; everyone else who
 * can manage projects sees all active workspace teams (`isArchived: false`).
 * Archived or missing existing assignments are classified as invalid by the editor
 * because they are absent from this catalog.
 */
export async function loadAssignmentTeamCatalog(
  auth: WorkspaceMemberManagerContext
): Promise<AssignmentTeamCatalogEntry[]> {
  const scopedToOwnTeam = isTeamScopedWorkspaceAdmin(auth) && Boolean(auth.teamId);
  return db.team.findMany({
    where: {
      workspaceId: auth.workspaceId,
      isArchived: false,
      ...(scopedToOwnTeam ? { id: auth.teamId! } : {}),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isArchived: true,
    },
  });
}
