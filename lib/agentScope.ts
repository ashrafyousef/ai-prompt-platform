import type { AgentConfig, AgentScope } from "@prisma/client";

export type AgentActorContext = {
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
};

export function isWorkspaceWideAgentScope(scope: AgentScope): boolean {
  return scope === "GLOBAL";
}

export function canViewAgentForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  if (agent.workspaceId !== actor.workspaceId) return false;
  if (actor.workspaceRole === "OWNER" || actor.platformRole === "ADMIN") return true;
  if (isWorkspaceWideAgentScope(agent.scope)) return true;
  return Boolean(actor.teamId && agent.teamId === actor.teamId);
}

export function canManageAgentForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  // Phase 2.1: management uses same first boundary as visibility.
  return canViewAgentForActor(actor, agent);
}

export function normalizeAgentScopeInput(params: {
  scope?: AgentScope;
  teamId?: string | null;
}): { scope: AgentScope; teamId: string | null } {
  const scope = params.scope ?? "GLOBAL";
  if (scope === "TEAM") {
    return { scope, teamId: params.teamId ?? null };
  }
  return { scope: "GLOBAL", teamId: null };
}

export function assertCanAssignScopeForActor(
  actor: AgentActorContext,
  scope: AgentScope,
  teamId: string | null
): { scope: AgentScope; teamId: string | null } {
  const normalized = normalizeAgentScopeInput({ scope, teamId });
  if (normalized.scope === "TEAM" && !normalized.teamId) {
    throw new Error("TEAM scoped agents require a team.");
  }
  if (actor.workspaceRole === "OWNER" || actor.platformRole === "ADMIN") {
    return normalized;
  }
  if (normalized.scope === "GLOBAL") {
    return normalized;
  }
  if (!actor.teamId || normalized.teamId !== actor.teamId) {
    throw new Error("Workspace admins can only manage TEAM agents in their own team.");
  }
  return normalized;
}
