import { describe, expect, it } from "vitest";
import {
  TEAM_CONTEXT_REQUIRED_CODE,
  TEAM_CONTEXT_REQUIRED_MESSAGE,
  TeamContextRequiredError,
  activeInvitationRevokeFilter,
  assertTeamContextForScopedAdmin,
  canCrossAssignMemberTeams,
  isPlatformAdmin,
  isTeamScopedWorkspaceAdmin,
  isWorkspaceOwner,
  isWorkspaceWideManager,
  validateTeamScopedMemberUpdate,
  type WorkspaceMemberManagerContext,
} from "@/lib/adminAuth";

function ctx(
  overrides: Partial<WorkspaceMemberManagerContext>
): WorkspaceMemberManagerContext {
  return {
    userId: "user-1",
    workspaceId: "ws-1",
    workspaceRole: "MEMBER",
    platformRole: "USER",
    teamId: null,
    ...overrides,
  };
}

describe("adminAuth team context policy", () => {
  it("identifies workspace-wide managers", () => {
    expect(isWorkspaceWideManager(ctx({ workspaceRole: "OWNER" }))).toBe(true);
    expect(isWorkspaceWideManager(ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN" }))).toBe(true);
    expect(isWorkspaceWideManager(ctx({ workspaceRole: "ADMIN", platformRole: "USER" }))).toBe(false);
  });

  it("identifies team-scoped workspace admins", () => {
    expect(isTeamScopedWorkspaceAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "USER" }))).toBe(true);
    expect(isTeamScopedWorkspaceAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN" }))).toBe(false);
    expect(isTeamScopedWorkspaceAdmin(ctx({ workspaceRole: "OWNER" }))).toBe(false);
  });

  it("throws TEAM_CONTEXT_REQUIRED for teamless workspace admin", () => {
    expect(() =>
      assertTeamContextForScopedAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: null }))
    ).toThrow(TeamContextRequiredError);

    try {
      assertTeamContextForScopedAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: null }));
    } catch (error) {
      expect(error).toBeInstanceOf(TeamContextRequiredError);
      expect((error as TeamContextRequiredError).code).toBe(TEAM_CONTEXT_REQUIRED_CODE);
      expect((error as TeamContextRequiredError).message).toBe(TEAM_CONTEXT_REQUIRED_MESSAGE);
    }
  });

  it("allows team-scoped workspace admin with teamId", () => {
    expect(() =>
      assertTeamContextForScopedAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: "team-1" }))
    ).not.toThrow();
  });

  it("does not require team context for owner or platform admin", () => {
    expect(() => assertTeamContextForScopedAdmin(ctx({ workspaceRole: "OWNER", teamId: null }))).not.toThrow();
    expect(() =>
      assertTeamContextForScopedAdmin(ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN", teamId: null }))
    ).not.toThrow();
  });

  it("distinguishes owner from platform admin helpers", () => {
    expect(isWorkspaceOwner(ctx({ workspaceRole: "OWNER" }))).toBe(true);
    expect(isPlatformAdmin(ctx({ platformRole: "ADMIN" }))).toBe(true);
  });
});

describe("adminAuth member and invitation policy", () => {
  it("limits invitation revoke to own team for team-scoped workspace admin", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: "team-a" });
    expect(activeInvitationRevokeFilter(teamAdmin, "user@example.com")).toEqual({
      workspaceId: "ws-1",
      email: "user@example.com",
      acceptedAt: null,
      revokedAt: null,
      teamId: "team-a",
    });
  });

  it("keeps workspace-wide invitation revoke for owner and platform admin", () => {
    const owner = ctx({ workspaceRole: "OWNER" });
    const platformAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN" });
    expect(activeInvitationRevokeFilter(owner, "user@example.com")).toEqual({
      workspaceId: "ws-1",
      email: "user@example.com",
      acceptedAt: null,
      revokedAt: null,
    });
    expect(activeInvitationRevokeFilter(platformAdmin, "user@example.com")).not.toHaveProperty("teamId");
  });

  it("allows platform admin to update members across teams", () => {
    const platformAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN" });
    expect(
      validateTeamScopedMemberUpdate(
        platformAdmin,
        { teamId: "team-b", role: "ADMIN" },
        { teamId: "team-c" }
      )
    ).toBeNull();
    expect(canCrossAssignMemberTeams(platformAdmin)).toBe(true);
  });

  it("blocks team-scoped workspace admin from unassigning or cross-assigning members", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: "team-a" });
    expect(
      validateTeamScopedMemberUpdate(
        teamAdmin,
        { teamId: "team-a", role: "MEMBER" },
        { teamId: null }
      )
    ).toBe("You cannot remove members from your team.");
    expect(
      validateTeamScopedMemberUpdate(
        teamAdmin,
        { teamId: "team-a", role: "MEMBER" },
        { teamId: "team-b" }
      )
    ).toBe("You can only assign members to your own team.");
    expect(canCrossAssignMemberTeams(teamAdmin)).toBe(false);
  });

  it("allows owner and platform admin to unassign or cross-assign members", () => {
    const owner = ctx({ workspaceRole: "OWNER" });
    const platformAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN" });
    expect(
      validateTeamScopedMemberUpdate(owner, { teamId: "team-a", role: "MEMBER" }, { teamId: null })
    ).toBeNull();
    expect(
      validateTeamScopedMemberUpdate(platformAdmin, { teamId: "team-a", role: "MEMBER" }, { teamId: "team-b" })
    ).toBeNull();
  });
});
