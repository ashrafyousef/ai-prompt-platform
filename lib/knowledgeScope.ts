import type { AgentConfig } from "@prisma/client";
import type { AgentActorContext } from "@/lib/agentScope";
import { canManageAgentForActor, canViewAgentForActor } from "@/lib/agentScope";

/**
 * Phase 2.2 scope truth:
 * knowledge visibility/management inherits the owning agent scope.
 * - Agent scope GLOBAL => workspace-wide knowledge
 * - Agent scope TEAM => team-scoped knowledge
 */
export function canViewKnowledgeForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  return canViewAgentForActor(actor, agent);
}

export function canManageKnowledgeForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  return canManageAgentForActor(actor, agent);
}
