import { describe, expect, it } from "vitest";
import {
  canViewProjectForActor,
  canManageProjectForActor,
  isWorkspaceWideProjectViewer,
  buildAdminProjectListWhere,
  buildProjectReadListWhere,
  buildProjectReadTargetWhere,
  eligibleAssignedTeamIds,
  toProjectAccessTargetFromAssignments,
  type ProjectAssignedTeam,
} from "@/lib/projectAccess";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";

function activeTeam(id: string, overrides: Partial<ProjectAssignedTeam> = {}): ProjectAssignedTeam {
  return {
    id,
    workspaceId: overrides.workspaceId === undefined ? workspaceId : overrides.workspaceId,
    isArchived: overrides.isArchived ?? false,
  };
}

function project(
  overrides: Partial<{
    assignedTeams: ProjectAssignedTeam[];
    assignedTeamIds: string[];
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
    workspaceId: string;
  }> = {}
) {
  const assignedTeams =
    overrides.assignedTeams ??
    (overrides.assignedTeamIds ?? [teamA]).map((id) => activeTeam(id));

  return {
    workspaceId: overrides.workspaceId ?? workspaceId,
    status: overrides.status ?? ("ACTIVE" as const),
    assignedTeams,
    ...(overrides.assignedTeamIds ? { assignedTeamIds: overrides.assignedTeamIds } : {}),
  };
}

const teamFilter = (teamId: string) => ({
  some: {
    teamId,
    team: {
      isArchived: false,
      workspaceId,
    },
  },
});

describe("isWorkspaceWideProjectViewer", () => {
  it("is true for workspace OWNER, platform ADMIN, and teamless workspace ADMIN", () => {
    expect(
      isWorkspaceWideProjectViewer({
        workspaceId,
        workspaceRole: "OWNER",
        platformRole: "USER",
        teamId: null,
      })
    ).toBe(true);
    expect(
      isWorkspaceWideProjectViewer({
        workspaceId,
        workspaceRole: "MEMBER",
        platformRole: "ADMIN",
        teamId: teamA,
      })
    ).toBe(true);
    expect(
      isWorkspaceWideProjectViewer({
        workspaceId,
        workspaceRole: "ADMIN",
        platformRole: "USER",
        teamId: null,
      })
    ).toBe(true);
  });

  it("is false for team-scoped workspace ADMIN and MEMBER", () => {
    expect(
      isWorkspaceWideProjectViewer({
        workspaceId,
        workspaceRole: "ADMIN",
        platformRole: "USER",
        teamId: teamA,
      })
    ).toBe(false);
    expect(
      isWorkspaceWideProjectViewer({
        workspaceId,
        workspaceRole: "MEMBER",
        platformRole: "USER",
        teamId: teamA,
      })
    ).toBe(false);
  });
});

describe("canManageProjectForActor", () => {
  it("allows managers and denies MEMBER even with matching team", () => {
    expect(
      canManageProjectForActor({
        workspaceId,
        workspaceRole: "OWNER",
        platformRole: "USER",
        teamId: null,
      })
    ).toBe(true);
    expect(
      canManageProjectForActor({
        workspaceId,
        workspaceRole: "MEMBER",
        platformRole: "USER",
        teamId: teamA,
      })
    ).toBe(false);
  });
});

describe("canViewProjectForActor", () => {
  it("allows workspace OWNER without requiring Team metadata", () => {
    const owner = {
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canViewProjectForActor(owner, project({ assignedTeams: [] }))).toBe(true);
    expect(
      canViewProjectForActor(owner, {
        workspaceId,
        status: "ACTIVE",
        assignedTeams: [],
        assignedTeamIds: [teamB],
      })
    ).toBe(true);
  });

  it("allows platform ADMIN and teamless workspace ADMIN workspace-wide", () => {
    expect(
      canViewProjectForActor(
        {
          workspaceId,
          workspaceRole: "ADMIN",
          platformRole: "ADMIN",
          teamId: teamA,
        },
        project({ assignedTeams: [activeTeam(teamB)] })
      )
    ).toBe(true);
    expect(
      canViewProjectForActor(
        {
          workspaceId,
          workspaceRole: "ADMIN",
          platformRole: "USER",
          teamId: null,
        },
        project({ assignedTeams: [] })
      )
    ).toBe(true);
  });

  it("denies team-scoped actors when only raw assignedTeamIds are present", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(member, {
        workspaceId,
        status: "ACTIVE",
        assignedTeams: [],
        assignedTeamIds: [teamA],
      })
    ).toBe(false);
    expect(
      eligibleAssignedTeamIds({
        workspaceId,
        status: "ACTIVE",
        assignedTeams: [],
        assignedTeamIds: [teamA],
      })
    ).toEqual([]);
  });

  it("allows matching-team MEMBER with validated Team metadata", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(member, project({ assignedTeams: [activeTeam(teamA)] }))).toBe(
      true
    );
  });

  it("allows team-scoped ADMIN with matching validated Team", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        teamAdmin,
        project({ assignedTeams: [activeTeam(teamA), activeTeam(teamB)] })
      )
    ).toBe(true);
  });

  it("denies non-matching, teamless MEMBER, and unassigned projects", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(member, project({ assignedTeams: [activeTeam(teamB)] }))).toBe(
      false
    );
    expect(canViewProjectForActor(member, project({ assignedTeams: [] }))).toBe(false);
    expect(
      canViewProjectForActor(
        {
          workspaceId,
          workspaceRole: "MEMBER",
          platformRole: "USER",
          teamId: null,
        },
        project({ assignedTeams: [activeTeam(teamA)] })
      )
    ).toBe(false);
  });

  it("denies cross-workspace access even for workspace-wide viewers", () => {
    expect(
      canViewProjectForActor(
        {
          workspaceId,
          workspaceRole: "OWNER",
          platformRole: "USER",
          teamId: null,
        },
        {
          workspaceId: "ws-other",
          status: "ACTIVE",
          assignedTeams: [],
        }
      )
    ).toBe(false);
  });

  it("denies archived projects by default and allows with includeArchivedProjects", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        member,
        project({ assignedTeams: [activeTeam(teamA)], status: "ARCHIVED" })
      )
    ).toBe(false);
    expect(
      canViewProjectForActor(
        member,
        project({ assignedTeams: [activeTeam(teamA)], status: "ARCHIVED" }),
        { includeArchivedProjects: true }
      )
    ).toBe(true);
  });

  it("denies missing, archived, and cross-workspace assigned Teams", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };

    expect(
      canViewProjectForActor(
        member,
        toProjectAccessTargetFromAssignments(
          { workspaceId, status: "ACTIVE" },
          [{ teamId: teamA, team: null }]
        )
      )
    ).toBe(false);

    expect(
      canViewProjectForActor(
        member,
        project({ assignedTeams: [activeTeam(teamA, { isArchived: true })] })
      )
    ).toBe(false);

    expect(
      canViewProjectForActor(
        member,
        project({ assignedTeams: [activeTeam(teamA, { workspaceId: "ws-other" })] })
      )
    ).toBe(false);
  });

  it("succeeds for multi-team projects when one valid match exists", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        member,
        project({
          assignedTeams: [
            activeTeam(teamA),
            activeTeam(teamB, { isArchived: true }),
          ],
        })
      )
    ).toBe(true);
  });

  it("fails for multi-team projects without a valid match", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        member,
        project({
          assignedTeams: [
            activeTeam(teamA, { isArchived: true }),
            activeTeam(teamB),
          ],
        })
      )
    ).toBe(false);
  });

  it("includeArchivedProjects does not bypass Team metadata validation", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        member,
        {
          workspaceId,
          status: "ARCHIVED",
          assignedTeams: [],
          assignedTeamIds: [teamA],
        },
        { includeArchivedProjects: true }
      )
    ).toBe(false);
  });
});

describe("toProjectAccessTargetFromAssignments", () => {
  it("omits missing Team and mismatched team ids", () => {
    const target = toProjectAccessTargetFromAssignments(
      { workspaceId, status: "ACTIVE" },
      [
        { teamId: teamA, team: null },
        {
          teamId: teamA,
          team: { id: "other-id", workspaceId, isArchived: false },
        },
        {
          teamId: teamB,
          team: { id: teamB, workspaceId, isArchived: false },
        },
      ]
    );
    expect(target.assignedTeams).toEqual([activeTeam(teamB)]);
  });
});

describe("buildProjectReadListWhere / buildProjectReadTargetWhere", () => {
  it("scopes team-scoped viewers with active same-workspace Team relation constraints", () => {
    expect(
      buildProjectReadListWhere({
        workspaceId,
        workspaceRole: "MEMBER",
        platformRole: "USER",
        teamId: teamA,
      })
    ).toEqual({
      workspaceId,
      status: { not: "ARCHIVED" },
      teamAssignments: teamFilter(teamA),
    });
  });

  it("returns empty id set for teamless MEMBER", () => {
    expect(
      buildProjectReadListWhere({
        workspaceId,
        workspaceRole: "MEMBER",
        platformRole: "USER",
        teamId: null,
      })
    ).toEqual({
      workspaceId,
      status: { not: "ARCHIVED" },
      id: { in: [] },
    });
  });

  it("preserves empty-id deny for teamless MEMBER on direct lookup", () => {
    expect(
      buildProjectReadTargetWhere(
        {
          workspaceId,
          workspaceRole: "MEMBER",
          platformRole: "USER",
          teamId: null,
        },
        "project-1"
      )
    ).toEqual({
      AND: [
        {
          workspaceId,
          status: { not: "ARCHIVED" },
          id: { in: [] },
        },
        { id: "project-1" },
      ],
    });
  });
});

describe("buildAdminProjectListWhere", () => {
  it("scopes team-scoped ADMIN with Team relation constraints", () => {
    expect(
      buildAdminProjectListWhere(
        {
          workspaceId,
          workspaceRole: "ADMIN",
          platformRole: "USER",
          teamId: teamA,
        },
        {}
      )
    ).toEqual({
      workspaceId,
      status: { not: "ARCHIVED" },
      teamAssignments: teamFilter(teamA),
    });
  });

  it("includes archived projects when requested but keeps team relation constraints", () => {
    expect(
      buildAdminProjectListWhere(
        {
          workspaceId,
          workspaceRole: "OWNER",
          platformRole: "USER",
          teamId: null,
        },
        { includeArchived: true }
      )
    ).toEqual({ workspaceId });

    expect(
      buildAdminProjectListWhere(
        {
          workspaceId,
          workspaceRole: "ADMIN",
          platformRole: "USER",
          teamId: teamA,
        },
        { includeArchived: true }
      )
    ).toEqual({
      workspaceId,
      teamAssignments: teamFilter(teamA),
    });
  });
});
