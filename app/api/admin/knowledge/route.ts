import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { canViewKnowledgeForActor } from "@/lib/knowledgeScope";

export async function GET() {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const rows = await db.agentConfig.findMany({
      where: {
        workspaceId: auth.workspaceId,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        scope: true,
        teamId: true,
        team: { select: { name: true } },
        inputSchema: true,
        knowledgeLinks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            legacyItemId: true,
            knowledge: {
              select: {
                id: true,
                title: true,
                sourceType: true,
                isActive: true,
                processingStatus: true,
                content: true,
              },
            },
          },
        },
      },
    });

    const actor = {
      workspaceId: auth.workspaceId,
      workspaceRole: auth.workspaceRole,
      platformRole: auth.platformRole,
      teamId: auth.teamId,
    };

    const knowledge = rows
      .filter((agent) => canViewKnowledgeForActor(actor, agent))
      .flatMap((agent) => {
        if (agent.knowledgeLinks.length > 0) {
          return agent.knowledgeLinks.map((link) => ({
            agentId: agent.id,
            agentName: agent.name,
            agentScope: agent.scope,
            teamId: agent.teamId ?? null,
            teamName: agent.team?.name ?? null,
            knowledgeId: link.knowledge.id,
            legacyKnowledgeId: link.legacyItemId ?? null,
            title: link.knowledge.title,
            sourceType: link.knowledge.sourceType,
            isActive: link.knowledge.isActive,
            processingStatus: link.knowledge.processingStatus ?? "ready",
            hasContent: Boolean(link.knowledge.content && link.knowledge.content.trim().length > 0),
          }));
        }

        // Compatibility fallback for agents not yet relationally hydrated.
        const schema = normalizeAgentInputSchema(agent.inputSchema);
        return schema.knowledgeItems.map((item) => ({
          agentId: agent.id,
          agentName: agent.name,
          agentScope: agent.scope,
          teamId: agent.teamId ?? null,
          teamName: agent.team?.name ?? null,
          knowledgeId: item.id,
          legacyKnowledgeId: item.id,
          title: item.title,
          sourceType: item.sourceType,
          isActive: item.isActive,
          processingStatus: item.processingStatus ?? "ready",
          hasContent: Boolean(item.content && item.content.trim().length > 0),
        }));
      });

    return NextResponse.json({ knowledge });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load knowledge.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
