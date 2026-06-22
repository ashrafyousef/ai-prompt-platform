import { describe, expect, it } from "vitest";
import {
  buildAdminBriefListWhere,
  canAnalyzeBrief,
  canEditBriefResponses,
  canViewBriefForActor,
} from "@/lib/briefAccess";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";
const projectId = "project-1";

function project(overrides: Partial<{ assignedTeamIds: string[]; status: "DRAFT" | "ACTIVE" | "ARCHIVED" }> = {}) {
  return {
    id: projectId,
    workspaceId,
    status: overrides.status ?? ("ACTIVE" as const),
    assignedTeamIds: overrides.assignedTeamIds ?? [teamA],
  };
}

describe("canViewBriefForActor", () => {
  it("allows OWNER to view brief on any workspace project", () => {
    const owner = {
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canViewBriefForActor(owner, project({ assignedTeamIds: [teamB] }))).toBe(true);
  });

  it("allows team-scoped ADMIN when project team matches", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewBriefForActor(teamAdmin, project({ assignedTeamIds: [teamA] }))).toBe(true);
    expect(canViewBriefForActor(teamAdmin, project({ assignedTeamIds: [teamB] }))).toBe(false);
  });
});

describe("canEditBriefResponses", () => {
  it("allows edit only for DRAFT brief on non-archived project", () => {
    expect(canEditBriefResponses("DRAFT", "ACTIVE")).toBe(true);
    expect(canEditBriefResponses("DRAFT", "DRAFT")).toBe(true);
    expect(canEditBriefResponses("SUBMITTED", "ACTIVE")).toBe(false);
    expect(canEditBriefResponses("DRAFT", "ARCHIVED")).toBe(false);
    expect(canEditBriefResponses("ARCHIVED", "ACTIVE")).toBe(false);
  });
});

describe("canAnalyzeBrief", () => {
  it("matches edit rules for draft analysis", () => {
    expect(canAnalyzeBrief("DRAFT", "ACTIVE")).toBe(true);
    expect(canAnalyzeBrief("SUBMITTED", "ACTIVE")).toBe(false);
  });
});

describe("buildAdminBriefListWhere", () => {
  it("excludes archived briefs by default", () => {
    const where = buildAdminBriefListWhere(
      {
        workspaceId,
        workspaceRole: "OWNER",
        platformRole: "USER",
        teamId: null,
      },
      {}
    );
    expect(where).toEqual({
      project: { workspaceId },
      status: { not: "ARCHIVED" },
    });
  });

  it("includes archived briefs when requested", () => {
    const where = buildAdminBriefListWhere(
      {
        workspaceId,
        workspaceRole: "OWNER",
        platformRole: "USER",
        teamId: null,
      },
      { includeArchived: true }
    );
    expect(where).toEqual({
      project: { workspaceId },
    });
  });

  it("scopes team-scoped ADMIN to assigned projects", () => {
    const where = buildAdminBriefListWhere(
      {
        workspaceId,
        workspaceRole: "ADMIN",
        platformRole: "USER",
        teamId: teamA,
      },
      {}
    );
    expect(where).toEqual({
      project: {
        workspaceId,
        teamAssignments: { some: { teamId: teamA } },
      },
      status: { not: "ARCHIVED" },
    });
  });

  it("filters by projectId within visibility constraints", () => {
    const where = buildAdminBriefListWhere(
      {
        workspaceId,
        workspaceRole: "OWNER",
        platformRole: "USER",
        teamId: null,
      },
      { projectId: "project-42" }
    );
    expect(where).toEqual({
      project: { workspaceId, id: "project-42" },
      status: { not: "ARCHIVED" },
    });
  });
});
