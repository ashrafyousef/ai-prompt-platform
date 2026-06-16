import { describe, expect, it } from "vitest";
import {
  canViewProjectForActor,
  isWorkspaceWideProjectViewer,
} from "@/lib/projectAccess";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";

function project(overrides: Partial<{ assignedTeamIds: string[]; status: "DRAFT" | "ACTIVE" | "ARCHIVED" }> = {}) {
  return {
    workspaceId,
    status: overrides.status ?? ("ACTIVE" as const),
    assignedTeamIds: overrides.assignedTeamIds ?? [teamA],
  };
}

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

describe("canViewProjectForActor", () => {
  it("allows workspace OWNER to view any project in the workspace", () => {
    const owner = {
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canViewProjectForActor(owner, project({ assignedTeamIds: [teamB] }))).toBe(true);
    expect(canViewProjectForActor(owner, project({ assignedTeamIds: [] }))).toBe(true);
  });

  it("allows platform ADMIN to view any project in the workspace", () => {
    const platformAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "ADMIN" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(platformAdmin, project({ assignedTeamIds: [teamB] }))).toBe(true);
    expect(canViewProjectForActor(platformAdmin, project({ assignedTeamIds: [] }))).toBe(true);
  });

  it("allows workspace ADMIN with no teamId to view any project in the workspace", () => {
    const teamlessWorkspaceAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canViewProjectForActor(teamlessWorkspaceAdmin, project({ assignedTeamIds: [teamB] }))).toBe(true);
    expect(canViewProjectForActor(teamlessWorkspaceAdmin, project({ assignedTeamIds: [] }))).toBe(true);
  });

  it("allows workspace ADMIN with matching teamId to view assigned project", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(teamAdmin, project({ assignedTeamIds: [teamA, teamB] }))).toBe(true);
  });

  it("denies workspace ADMIN with non-matching teamId", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(teamAdmin, project({ assignedTeamIds: [teamB] }))).toBe(false);
    expect(canViewProjectForActor(teamAdmin, project({ assignedTeamIds: [] }))).toBe(false);
  });

  it("allows MEMBER with matching teamId to view assigned project", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(member, project({ assignedTeamIds: [teamA] }))).toBe(true);
  });

  it("denies MEMBER with non-matching teamId", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewProjectForActor(member, project({ assignedTeamIds: [teamB] }))).toBe(false);
  });

  it("denies MEMBER with no teamId for assigned projects", () => {
    const teamlessMember = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canViewProjectForActor(teamlessMember, project({ assignedTeamIds: [teamA] }))).toBe(false);
    expect(canViewProjectForActor(teamlessMember, project({ assignedTeamIds: [] }))).toBe(false);
  });

  it("denies cross-workspace access", () => {
    const owner = {
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(
      canViewProjectForActor(owner, {
        workspaceId: "ws-other",
        status: "ACTIVE",
        assignedTeamIds: [],
      })
    ).toBe(false);
  });

  it("allows archived projects for authorized viewers without status-based denial", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(
      canViewProjectForActor(
        member,
        project({ assignedTeamIds: [teamA], status: "ARCHIVED" })
      )
    ).toBe(true);

    const teamlessWorkspaceAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(
      canViewProjectForActor(
        teamlessWorkspaceAdmin,
        project({ assignedTeamIds: [], status: "ARCHIVED" })
      )
    ).toBe(true);
  });
});
