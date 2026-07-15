import { describe, expect, it } from "vitest";
import {
  buildAdminBriefListWhere,
  canAnalyzeBrief,
  canApproveBrief,
  canEditBriefResponses,
  canReopenBrief,
  canViewBriefForActor,
  getBriefReadOnlyMessage,
} from "@/lib/briefAccess";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";
const projectId = "project-1";

function project(
  overrides: Partial<{
    assignedTeams: Array<{ id: string; workspaceId: string | null; isArchived: boolean }>;
    assignedTeamIds: string[];
    status: "DRAFT" | "ACTIVE" | "ARCHIVED";
  }> = {}
) {
  const teamIds = overrides.assignedTeamIds ?? [teamA];
  return {
    id: projectId,
    workspaceId,
    status: overrides.status ?? ("ACTIVE" as const),
    assignedTeams:
      overrides.assignedTeams ??
      teamIds.map((id) => ({ id, workspaceId, isArchived: false })),
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

  it("allows team-scoped ADMIN when project team metadata matches", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewBriefForActor(teamAdmin, project({ assignedTeamIds: [teamA] }))).toBe(true);
    expect(canViewBriefForActor(teamAdmin, project({ assignedTeamIds: [teamB] }))).toBe(false);
    expect(
      canViewBriefForActor(teamAdmin, {
        id: projectId,
        workspaceId,
        status: "ACTIVE",
        assignedTeams: [],
        assignedTeamIds: [teamA],
      })
    ).toBe(false);
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

describe("canReopenBrief", () => {
  it("allows reopen from SUBMITTED or IN_REVIEW on active projects", () => {
    expect(canReopenBrief("SUBMITTED", "ACTIVE")).toBe(true);
    expect(canReopenBrief("IN_REVIEW", "ACTIVE")).toBe(true);
  });

  it("denies reopen for DRAFT, APPROVED, ARCHIVED, or archived projects", () => {
    expect(canReopenBrief("DRAFT", "ACTIVE")).toBe(false);
    expect(canReopenBrief("APPROVED", "ACTIVE")).toBe(false);
    expect(canReopenBrief("ARCHIVED", "ACTIVE")).toBe(false);
    expect(canReopenBrief("SUBMITTED", "ARCHIVED")).toBe(false);
  });
});

describe("canApproveBrief", () => {
  it("allows approve from SUBMITTED or IN_REVIEW on active projects", () => {
    expect(canApproveBrief("SUBMITTED", "ACTIVE")).toBe(true);
    expect(canApproveBrief("IN_REVIEW", "ACTIVE")).toBe(true);
  });

  it("denies approve for DRAFT, APPROVED, ARCHIVED, or archived projects", () => {
    expect(canApproveBrief("DRAFT", "ACTIVE")).toBe(false);
    expect(canApproveBrief("APPROVED", "ACTIVE")).toBe(false);
    expect(canApproveBrief("ARCHIVED", "ACTIVE")).toBe(false);
    expect(canApproveBrief("SUBMITTED", "ARCHIVED")).toBe(false);
  });
});

describe("getBriefReadOnlyMessage", () => {
  it("returns intake-form lifecycle messages", () => {
    expect(getBriefReadOnlyMessage("SUBMITTED", "ACTIVE", { intakeForm: true })).toMatch(
      /ready for review/i
    );
    expect(getBriefReadOnlyMessage("IN_REVIEW", "ACTIVE", { intakeForm: true })).toMatch(
      /in review/i
    );
    expect(getBriefReadOnlyMessage("APPROVED", "ACTIVE", { intakeForm: true })).toMatch(
      /approved and locked/i
    );
  });

  it("returns panel lifecycle messages", () => {
    expect(getBriefReadOnlyMessage("SUBMITTED", "ACTIVE")).toMatch(/ready for review/i);
    expect(getBriefReadOnlyMessage("APPROVED", "ACTIVE")).toMatch(/approved and locked/i);
  });

  it("returns null for DRAFT", () => {
    expect(getBriefReadOnlyMessage("DRAFT", "ACTIVE")).toBeNull();
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
        teamAssignments: {
          some: {
            teamId: teamA,
            team: { isArchived: false, workspaceId },
          },
        },
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
