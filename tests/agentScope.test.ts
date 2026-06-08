import { describe, expect, it } from "vitest";
import {
  TEAM_CONTEXT_REQUIRED_CODE,
  TeamContextRequiredError,
} from "@/lib/adminAuth";
import {
  assertCanAssignScopeForActor,
  assertCanManageAgentForActor,
  canManageAgentForActor,
  canViewAgentForActor,
  canViewAgentInAdminForActor,
} from "@/lib/agentScope";
import {
  canManageKnowledgeForActor,
  canViewKnowledgeForActor,
} from "@/lib/knowledgeScope";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";

const globalAgent = {
  workspaceId,
  scope: "GLOBAL" as const,
  teamId: null,
};

const teamAAgent = {
  workspaceId,
  scope: "TEAM" as const,
  teamId: teamA,
};

const teamBAgent = {
  workspaceId,
  scope: "TEAM" as const,
  teamId: teamB,
};

describe("canViewAgentForActor (chat visibility)", () => {
  it("allows members to view GLOBAL agents and own-team TEAM agents", () => {
    const member = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewAgentForActor(member, globalAgent)).toBe(true);
    expect(canViewAgentForActor(member, teamAAgent)).toBe(true);
    expect(canViewAgentForActor(member, teamBAgent)).toBe(false);
  });

  it("allows workspace admins to view all agents in chat", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canViewAgentForActor(teamAdmin, globalAgent)).toBe(true);
    expect(canViewAgentForActor(teamAdmin, teamBAgent)).toBe(true);
  });
});

describe("canManageAgentForActor (admin manage)", () => {
  it("allows platform ADMIN to manage global, own-team, and other-team agents", () => {
    const actor = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "ADMIN" as const,
      teamId: teamA,
    };
    expect(canManageAgentForActor(actor, globalAgent)).toBe(true);
    expect(canManageAgentForActor(actor, teamAAgent)).toBe(true);
    expect(canManageAgentForActor(actor, teamBAgent)).toBe(true);
  });

  it("allows workspace OWNER to manage global, own-team, and other-team agents", () => {
    const actor = {
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canManageAgentForActor(actor, globalAgent)).toBe(true);
    expect(canManageAgentForActor(actor, teamAAgent)).toBe(true);
    expect(canManageAgentForActor(actor, teamBAgent)).toBe(true);
  });

  it("allows team-scoped workspace ADMIN to manage own-team TEAM agent only", () => {
    const actor = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canManageAgentForActor(actor, teamAAgent)).toBe(true);
    expect(canManageAgentForActor(actor, globalAgent)).toBe(false);
    expect(canManageAgentForActor(actor, teamBAgent)).toBe(false);
  });

  it("denies teamless workspace ADMIN manage access without team context", () => {
    const actor = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(canManageAgentForActor(actor, teamAAgent)).toBe(false);
    expect(canManageAgentForActor(actor, globalAgent)).toBe(false);
  });

  it("denies workspace MEMBER admin manage access", () => {
    const actor = {
      workspaceId,
      workspaceRole: "MEMBER" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(canManageAgentForActor(actor, teamAAgent)).toBe(false);
    expect(canManageAgentForActor(actor, globalAgent)).toBe(false);
  });
});

describe("assertCanManageAgentForActor", () => {
  it("throws TEAM_CONTEXT_REQUIRED for teamless workspace ADMIN", () => {
    const actor = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(() => assertCanManageAgentForActor(actor, teamAAgent)).toThrow(TeamContextRequiredError);
    try {
      assertCanManageAgentForActor(actor, teamAAgent);
    } catch (error) {
      expect(error).toBeInstanceOf(TeamContextRequiredError);
      expect((error as TeamContextRequiredError).code).toBe(TEAM_CONTEXT_REQUIRED_CODE);
    }
  });

  it("throws Forbidden for cross-team or global agents", () => {
    const actor = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(() => assertCanManageAgentForActor(actor, globalAgent)).toThrow("Forbidden");
    expect(() => assertCanManageAgentForActor(actor, teamBAgent)).toThrow("Forbidden");
  });
});

describe("assertCanAssignScopeForActor", () => {
  it("allows OWNER to create GLOBAL or TEAM agents", () => {
    const owner = {
      userId: "owner-1",
      workspaceId,
      workspaceRole: "OWNER" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(assertCanAssignScopeForActor(owner, "GLOBAL", null)).toEqual({
      scope: "GLOBAL",
      teamId: null,
    });
    expect(assertCanAssignScopeForActor(owner, "TEAM", teamB)).toEqual({
      scope: "TEAM",
      teamId: teamB,
    });
  });

  it("allows team admin to create only own-team TEAM agents", () => {
    const teamAdmin = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(assertCanAssignScopeForActor(teamAdmin, "TEAM", teamA)).toEqual({
      scope: "TEAM",
      teamId: teamA,
    });
  });

  it("blocks team admin from creating GLOBAL agents", () => {
    const teamAdmin = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(() => assertCanAssignScopeForActor(teamAdmin, "GLOBAL", null)).toThrow("Forbidden");
  });

  it("blocks team admin from assigning another team", () => {
    const teamAdmin = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    expect(() => assertCanAssignScopeForActor(teamAdmin, "TEAM", teamB)).toThrow(
      "Workspace admins can only manage TEAM agents in their own team."
    );
  });

  it("requires team context for teamless workspace ADMIN", () => {
    const teamlessAdmin = {
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: null,
    };
    expect(() => assertCanAssignScopeForActor(teamlessAdmin, "TEAM", teamA)).toThrow(
      TeamContextRequiredError
    );
  });
});

describe("knowledgeScope inherits agent admin rules", () => {
  const teamAdmin = {
    workspaceId,
    workspaceRole: "ADMIN" as const,
    platformRole: "USER" as const,
    teamId: teamA,
  };

  it("allows knowledge view/manage for own-team TEAM agent", () => {
    expect(canViewKnowledgeForActor(teamAdmin, teamAAgent)).toBe(true);
    expect(canManageKnowledgeForActor(teamAdmin, teamAAgent)).toBe(true);
    expect(canViewAgentInAdminForActor(teamAdmin, teamAAgent)).toBe(true);
  });

  it("denies knowledge view/manage for GLOBAL and other-team agents", () => {
    expect(canViewKnowledgeForActor(teamAdmin, globalAgent)).toBe(false);
    expect(canManageKnowledgeForActor(teamAdmin, globalAgent)).toBe(false);
    expect(canViewKnowledgeForActor(teamAdmin, teamBAgent)).toBe(false);
    expect(canManageKnowledgeForActor(teamAdmin, teamBAgent)).toBe(false);
  });
});
