import type { AgentConfig, AgentScope, AgentStatus, Prisma } from "@prisma/client";
import {
  assertTeamContextForScopedAdmin,
  AdminValidationError,
  TEAM_SCOPE_REQUIRES_TEAM_MESSAGE,
  type WorkspaceMemberManagerContext,
} from "@/lib/adminAuth";

export type AgentActorContext = {
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
};

type AgentScopeTarget = Pick<AgentConfig, "workspaceId" | "scope" | "teamId">;

function isWorkspaceWideManager(actor: AgentActorContext): boolean {
  return actor.workspaceRole === "OWNER" || actor.platformRole === "ADMIN";
}

function isTeamScopedWorkspaceAdmin(actor: AgentActorContext): boolean {
  return actor.workspaceRole === "ADMIN" && actor.platformRole !== "ADMIN";
}

export function toAgentActorContext(context: WorkspaceMemberManagerContext): AgentActorContext {
  return {
    workspaceId: context.workspaceId,
    workspaceRole: context.workspaceRole,
    platformRole: context.platformRole,
    teamId: context.teamId,
  };
}

export function isWorkspaceWideAgentScope(scope: AgentScope): boolean {
  return scope === "GLOBAL";
}

/** End-user chat visibility — unchanged from pre-hardening behavior. */
export function canViewAgentForActor(
  actor: AgentActorContext,
  agent: AgentScopeTarget
): boolean {
  if (agent.workspaceId !== actor.workspaceId) return false;
  if (
    actor.workspaceRole === "OWNER" ||
    actor.workspaceRole === "ADMIN" ||
    actor.platformRole === "ADMIN"
  ) {
    return true;
  }
  if (isWorkspaceWideAgentScope(agent.scope)) return true;
  return Boolean(actor.teamId && agent.teamId === actor.teamId);
}

/** Admin list/detail visibility for agents and inherited knowledge views. */
export function canViewAgentInAdminForActor(
  actor: AgentActorContext,
  agent: AgentScopeTarget
): boolean {
  return canManageAgentForActor(actor, agent);
}

export function canManageAgentForActor(
  actor: AgentActorContext,
  agent: AgentScopeTarget
): boolean {
  if (agent.workspaceId !== actor.workspaceId) return false;
  if (isWorkspaceWideManager(actor)) return true;
  if (isTeamScopedWorkspaceAdmin(actor)) {
    if (!actor.teamId) return false;
    return agent.scope === "TEAM" && agent.teamId === actor.teamId;
  }
  return false;
}

export function assertAdminAgentTeamContext(actor: WorkspaceMemberManagerContext): void {
  if (isTeamScopedWorkspaceAdmin(actor)) {
    assertTeamContextForScopedAdmin(actor);
  }
}

export function assertCanManageAgentForActor(
  actor: WorkspaceMemberManagerContext,
  agent: AgentScopeTarget
): void {
  assertAdminAgentTeamContext(actor);
  if (!canManageAgentForActor(actor, agent)) {
    throw new Error("Forbidden");
  }
}

export function adminAgentScopeWhere(
  actor: WorkspaceMemberManagerContext
): Prisma.AgentConfigWhereInput {
  assertAdminAgentTeamContext(actor);
  const where: Prisma.AgentConfigWhereInput = {
    workspaceId: actor.workspaceId,
  };
  if (isTeamScopedWorkspaceAdmin(actor)) {
    where.scope = "TEAM";
    where.teamId = actor.teamId!;
  }
  return where;
}

export type AdminAgentListFilters = {
  q?: string;
  status?: string | null;
  scope?: string | null;
  teamId?: string | null;
};

function assertAllowedAdminAgentListFilters(
  actor: WorkspaceMemberManagerContext,
  filters: AdminAgentListFilters
): void {
  if (!isTeamScopedWorkspaceAdmin(actor)) return;
  if (filters.scope && filters.scope !== "ALL" && filters.scope !== "TEAM") {
    throw new Error("Forbidden");
  }
  if (filters.scope === "GLOBAL") {
    throw new Error("Forbidden");
  }
  if (filters.teamId && filters.teamId !== "ALL") {
    if (filters.teamId === "none" || filters.teamId !== actor.teamId) {
      throw new Error("Forbidden");
    }
  }
}

/** Compose authorization constraints with optional list filters (AND). */
export function buildAdminAgentListWhere(
  actor: WorkspaceMemberManagerContext,
  filters: AdminAgentListFilters
): Prisma.AgentConfigWhereInput {
  assertAdminAgentTeamContext(actor);
  assertAllowedAdminAgentListFilters(actor, filters);
  const authWhere = adminAgentScopeWhere(actor);

  const andParts: Prisma.AgentConfigWhereInput[] = [authWhere];

  if (filters.status && filters.status !== "ALL") {
    andParts.push({ status: filters.status as AgentStatus });
  }

  if (!isTeamScopedWorkspaceAdmin(actor)) {
    if (filters.scope && filters.scope !== "ALL") {
      andParts.push({ scope: filters.scope as AgentScope });
    }
    if (filters.teamId && filters.teamId !== "ALL") {
      andParts.push({ teamId: filters.teamId === "none" ? null : filters.teamId });
    }
  }

  if (filters.q && filters.q.length > 0) {
    andParts.push({
      OR: [
        { name: { contains: filters.q, mode: "insensitive" } },
        { description: { contains: filters.q, mode: "insensitive" } },
        { slug: { contains: filters.q, mode: "insensitive" } },
      ],
    });
  }

  return andParts.length === 1 ? andParts[0]! : { AND: andParts };
}

export function filterManageableAgentLinks<T extends { agent: AgentScopeTarget }>(
  actor: AgentActorContext,
  links: T[]
): T[] {
  return links.filter((link) => canManageAgentForActor(actor, link.agent));
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
  actor: WorkspaceMemberManagerContext,
  scope: AgentScope,
  teamId: string | null
): { scope: AgentScope; teamId: string | null } {
  const normalized = normalizeAgentScopeInput({ scope, teamId });
  if (normalized.scope === "TEAM" && !normalized.teamId) {
    throw new AdminValidationError(TEAM_SCOPE_REQUIRES_TEAM_MESSAGE);
  }

  if (isWorkspaceWideManager(actor)) {
    return normalized;
  }

  if (isTeamScopedWorkspaceAdmin(actor)) {
    assertAdminAgentTeamContext(actor);
    if (normalized.scope === "GLOBAL") {
      throw new Error("Forbidden");
    }
    if (normalized.teamId !== actor.teamId) {
      throw new Error("Workspace admins can only manage TEAM agents in their own team.");
    }
    return { scope: "TEAM", teamId: actor.teamId! };
  }

  throw new Error("Forbidden");
}
