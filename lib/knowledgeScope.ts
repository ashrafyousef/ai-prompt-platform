import type { AgentConfig } from "@prisma/client";
import type { AgentActorContext } from "@/lib/agentScope";
import {
  assertAdminAgentTeamContext,
  canManageAgentForActor,
  canViewAgentInAdminForActor,
} from "@/lib/agentScope";
import type { WorkspaceMemberManagerContext } from "@/lib/adminAuth";

/**
 * Admin knowledge visibility inherits the owning agent's admin visibility rules.
 */
export function canViewKnowledgeForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  return canViewAgentInAdminForActor(actor, agent);
}

/** Admin knowledge mutation inherits the owning agent's manage rules. */
export function canManageKnowledgeForActor(
  actor: AgentActorContext,
  agent: Pick<AgentConfig, "workspaceId" | "scope" | "teamId">
): boolean {
  return canManageAgentForActor(actor, agent);
}

/** Reject shared knowledge mutations when any linked agent is outside manage scope. */
export function assertCanMutateKnowledgeForActor(
  actor: WorkspaceMemberManagerContext,
  linkedAgents: Array<Pick<AgentConfig, "workspaceId" | "scope" | "teamId">>
): void {
  assertAdminAgentTeamContext(actor);
  if (linkedAgents.length === 0) {
    throw new Error("Knowledge item not found.");
  }
  for (const agent of linkedAgents) {
    if (!canManageAgentForActor(actor, agent)) {
      throw new Error("Forbidden");
    }
  }
}
