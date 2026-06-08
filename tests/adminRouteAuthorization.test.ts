import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  TEAM_CONTEXT_REQUIRED_CODE,
  TeamContextRequiredError,
  AdminValidationError,
  TEAM_SCOPE_REQUIRES_TEAM_MESSAGE,
  formatAdminRouteError,
  type WorkspaceMemberManagerContext,
} from "@/lib/adminAuth";
import { buildAdminAgentListWhere, filterManageableAgentLinks, assertCanAssignScopeForActor } from "@/lib/agentScope";
import { assertCanMutateKnowledgeForActor } from "@/lib/knowledgeScope";

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";

function ctx(
  overrides: Partial<WorkspaceMemberManagerContext>
): WorkspaceMemberManagerContext {
  return {
    userId: "user-1",
    workspaceId,
    workspaceRole: "ADMIN",
    platformRole: "USER",
    teamId: teamA,
    ...overrides,
  };
}

const globalAgent = { workspaceId, scope: "GLOBAL" as const, teamId: null };
const teamAAgent = { workspaceId, scope: "TEAM" as const, teamId: teamA };
const teamBAgent = { workspaceId, scope: "TEAM" as const, teamId: teamB };

describe("buildAdminAgentListWhere", () => {
  it("rejects team admin attempts to list GLOBAL agents", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: teamA });
    expect(() => buildAdminAgentListWhere(teamAdmin, { scope: "GLOBAL" })).toThrow("Forbidden");
  });

  it("rejects team admin attempts to filter by another team", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: teamA });
    expect(() => buildAdminAgentListWhere(teamAdmin, { teamId: teamB })).toThrow("Forbidden");
  });

  it("rejects team admin attempts to filter unassigned agents", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: teamA });
    expect(() => buildAdminAgentListWhere(teamAdmin, { teamId: "none" })).toThrow("Forbidden");
  });

  it("keeps team admin constrained to own-team TEAM agents", () => {
    const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: teamA });
    const where = buildAdminAgentListWhere(teamAdmin, { scope: "TEAM", teamId: teamA });
    expect(where).toEqual({
      workspaceId,
      scope: "TEAM",
      teamId: teamA,
    });
  });

  it("allows owner to filter by GLOBAL scope", () => {
    const owner = ctx({ workspaceRole: "OWNER", platformRole: "USER", teamId: null });
    const where = buildAdminAgentListWhere(owner, { scope: "GLOBAL" });
    expect(where).toEqual({
      AND: [{ workspaceId }, { scope: "GLOBAL" }],
    });
  });

  it("allows platform admin to filter by teamId", () => {
    const platformAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN", teamId: teamA });
    const where = buildAdminAgentListWhere(platformAdmin, { teamId: teamB });
    expect(where).toEqual({
      AND: [{ workspaceId }, { teamId: teamB }],
    });
  });

  it("requires team context for teamless workspace admin", () => {
    const teamlessAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: null });
    expect(() => buildAdminAgentListWhere(teamlessAdmin, {})).toThrow(TeamContextRequiredError);
    try {
      buildAdminAgentListWhere(teamlessAdmin, {});
    } catch (error) {
      expect(error).toBeInstanceOf(TeamContextRequiredError);
      expect((error as TeamContextRequiredError).code).toBe(TEAM_CONTEXT_REQUIRED_CODE);
    }
  });
});

describe("assertCanMutateKnowledgeForActor", () => {
  const teamAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "USER", teamId: teamA });

  it("allows mutation when all linked agents are own-team manageable", () => {
    expect(() => assertCanMutateKnowledgeForActor(teamAdmin, [teamAAgent])).not.toThrow();
  });

  it("rejects mutation when knowledge is linked to another team agent", () => {
    expect(() => assertCanMutateKnowledgeForActor(teamAdmin, [teamAAgent, teamBAgent])).toThrow(
      "Forbidden"
    );
  });

  it("rejects mutation when knowledge is linked to a global agent", () => {
    expect(() => assertCanMutateKnowledgeForActor(teamAdmin, [teamAAgent, globalAgent])).toThrow(
      "Forbidden"
    );
  });

  it("allows owner to mutate shared knowledge across teams", () => {
    const owner = ctx({ workspaceRole: "OWNER", platformRole: "USER", teamId: null });
    expect(() =>
      assertCanMutateKnowledgeForActor(owner, [teamAAgent, teamBAgent, globalAgent])
    ).not.toThrow();
  });

  it("allows platform admin to mutate shared knowledge across teams", () => {
    const platformAdmin = ctx({ workspaceRole: "ADMIN", platformRole: "ADMIN", teamId: teamA });
    expect(() =>
      assertCanMutateKnowledgeForActor(platformAdmin, [teamAAgent, teamBAgent, globalAgent])
    ).not.toThrow();
  });
});

describe("filterManageableAgentLinks", () => {
  it("returns only own-team links for team admin", () => {
    const teamAdmin = {
      workspaceId,
      workspaceRole: "ADMIN" as const,
      platformRole: "USER" as const,
      teamId: teamA,
    };
    const links = [
      { agent: { ...teamAAgent, id: "a1", name: "A1" } },
      { agent: { ...teamBAgent, id: "b1", name: "B1" } },
      { agent: { ...globalAgent, id: "g1", name: "G1" } },
    ];
    const filtered = filterManageableAgentLinks(teamAdmin, links);
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.agent.id).toBe("a1");
  });
});

describe("formatAdminRouteError", () => {
  it("maps ZodError to 400", () => {
    const error = z.object({ name: z.string() }).safeParse({}).error;
    expect(error).toBeTruthy();
    const result = formatAdminRouteError(error, "Fallback");
    expect(result.status).toBe(400);
    expect(result.body.error).toBe("Invalid input.");
  });

  it("maps cross-team assignment errors to 403", () => {
    const result = formatAdminRouteError(
      new Error("Workspace admins can only manage TEAM agents in their own team."),
      "Fallback"
    );
    expect(result.status).toBe(403);
    expect(result.body.error).toBe("Forbidden");
  });

  it("preserves TEAM_CONTEXT_REQUIRED format", () => {
    const result = formatAdminRouteError(new TeamContextRequiredError(), "Fallback");
    expect(result.status).toBe(403);
    expect(result.body.error).toBe(TEAM_CONTEXT_REQUIRED_CODE);
  });

  it("maps invalid TEAM scope without teamId to 400", () => {
    const owner = ctx({ workspaceRole: "OWNER", platformRole: "USER", teamId: null });
    expect(() => assertCanAssignScopeForActor(owner, "TEAM", null)).toThrow(AdminValidationError);

    const typed = formatAdminRouteError(
      new AdminValidationError(TEAM_SCOPE_REQUIRES_TEAM_MESSAGE),
      "Fallback"
    );
    expect(typed.status).toBe(400);
    expect(typed.body.error).toBe(TEAM_SCOPE_REQUIRES_TEAM_MESSAGE);

    const plain = formatAdminRouteError(
      new Error(TEAM_SCOPE_REQUIRES_TEAM_MESSAGE),
      "Fallback"
    );
    expect(plain.status).toBe(400);
    expect(plain.body.error).toBe(TEAM_SCOPE_REQUIRES_TEAM_MESSAGE);
  });
});
