export type AssignedProjectTeam = {
  id: string;
  name: string;
  slug: string;
};

export type WorkspaceTeamOption = {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
};

export type InvalidAssignedTeam = AssignedProjectTeam & {
  reason: "archived" | "invalid";
};

export type ClassifiedProjectTeams = {
  valid: AssignedProjectTeam[];
  invalid: InvalidAssignedTeam[];
};

export type ProjectAssignmentViewer = {
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
};

export type ProjectAssignmentEditorPolicy = {
  mode: "workspace-wide" | "own-team-only";
  ownTeamId: string | null;
};

/** Mirrors isTeamScopedWorkspaceAdmin without importing server-only adminAuth. */
function isTeamScopedWorkspaceAdminViewer(viewer: ProjectAssignmentViewer): boolean {
  return viewer.workspaceRole === "ADMIN" && viewer.platformRole !== "ADMIN";
}

/** Classify existing assignments against the workspace team catalog. */
export function classifyProjectTeamAssignments(
  assigned: AssignedProjectTeam[],
  workspaceTeams: WorkspaceTeamOption[]
): ClassifiedProjectTeams {
  const byId = new Map(workspaceTeams.map((team) => [team.id, team]));
  const valid: AssignedProjectTeam[] = [];
  const invalid: InvalidAssignedTeam[] = [];

  for (const assignment of assigned) {
    const catalog = byId.get(assignment.id);
    if (!catalog) {
      invalid.push({ ...assignment, reason: "invalid" });
      continue;
    }
    if (catalog.isArchived) {
      invalid.push({
        id: assignment.id,
        name: catalog.name || assignment.name,
        slug: catalog.slug || assignment.slug,
        reason: "archived",
      });
      continue;
    }
    valid.push({
      id: assignment.id,
      name: catalog.name || assignment.name,
      slug: catalog.slug || assignment.slug,
    });
  }

  return { valid, invalid };
}

export function getProjectAssignmentEditorPolicy(
  viewer: ProjectAssignmentViewer
): ProjectAssignmentEditorPolicy {
  if (isTeamScopedWorkspaceAdminViewer(viewer) && viewer.teamId) {
    return { mode: "own-team-only", ownTeamId: viewer.teamId };
  }
  return { mode: "workspace-wide", ownTeamId: null };
}

/** Initial editable team IDs — valid selectable only; scoped ADMIN keeps own team. */
export function initialEditableTeamIds(
  classified: ClassifiedProjectTeams,
  policy: ProjectAssignmentEditorPolicy
): string[] {
  if (policy.mode === "own-team-only" && policy.ownTeamId) {
    return [policy.ownTeamId];
  }
  return classified.valid.map((team) => team.id);
}

/** Toggle selection respecting scoped ADMIN lock on own team. */
export function toggleEditableTeamId(
  currentIds: string[],
  teamId: string,
  policy: ProjectAssignmentEditorPolicy
): string[] {
  if (policy.mode === "own-team-only" && policy.ownTeamId === teamId) {
    return currentIds.includes(teamId) ? currentIds : [...currentIds, teamId];
  }
  if (policy.mode === "own-team-only" && policy.ownTeamId && teamId !== policy.ownTeamId) {
    return currentIds;
  }
  return currentIds.includes(teamId)
    ? currentIds.filter((id) => id !== teamId)
    : [...currentIds, teamId];
}

export function selectableTeamsForEditor(
  activeTeams: WorkspaceTeamOption[],
  policy: ProjectAssignmentEditorPolicy
): WorkspaceTeamOption[] {
  const active = activeTeams.filter((team) => !team.isArchived);
  if (policy.mode === "own-team-only" && policy.ownTeamId) {
    return active.filter((team) => team.id === policy.ownTeamId);
  }
  return active;
}

export function invalidAssignmentWarning(invalid: InvalidAssignedTeam[]): string | null {
  if (invalid.length === 0) return null;
  return "This project contains archived or invalid team assignments. They will be removed when you save.";
}

export function formatInvalidAssignmentLabel(team: InvalidAssignedTeam): string {
  const name = team.name?.trim() || team.slug?.trim() || team.id;
  return team.reason === "archived" ? `${name} (archived)` : `${name} (invalid)`;
}
