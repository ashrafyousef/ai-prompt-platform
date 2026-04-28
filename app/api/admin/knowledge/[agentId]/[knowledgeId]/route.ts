import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { canManageKnowledgeForActor } from "@/lib/knowledgeScope";

const schema = z.object({
  isActive: z.boolean(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentId: string; knowledgeId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = schema.parse(await req.json());
    const agent = await db.agentConfig.findUnique({
      where: { id: params.agentId },
      select: {
        id: true,
        workspaceId: true,
        scope: true,
        teamId: true,
        inputSchema: true,
      },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }

    const actor = {
      workspaceId: auth.workspaceId,
      workspaceRole: auth.workspaceRole,
      platformRole: auth.platformRole,
      teamId: auth.teamId,
    };
    if (!canManageKnowledgeForActor(actor, agent)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const link = await db.agentKnowledge.findFirst({
      where: {
        agentId: agent.id,
        knowledgeId: params.knowledgeId,
      },
      select: {
        knowledgeId: true,
        legacyItemId: true,
      },
    });

    let legacyMatchId: string | null = null;
    if (link) {
      await db.knowledgeItem.update({
        where: { id: link.knowledgeId },
        data: { isActive: body.isActive },
      });
      legacyMatchId = link.legacyItemId ?? null;
    }

    const normalized = normalizeAgentInputSchema(agent.inputSchema);
    let foundLegacy = false;
    const nextKnowledge = normalized.knowledgeItems.map((item) => {
      const matchesLegacy = legacyMatchId ? item.id === legacyMatchId : item.id === params.knowledgeId;
      if (!matchesLegacy) return item;
      foundLegacy = true;
      return { ...item, isActive: body.isActive };
    });

    if (!link && !foundLegacy) {
      return NextResponse.json({ error: "Knowledge item not found." }, { status: 404 });
    }

    if (foundLegacy) {
      const nextInputSchema = {
        ...normalized,
        knowledgeItems: nextKnowledge,
        knowledge: nextKnowledge.map((item) => ({
          type: item.sourceType,
          title: item.title,
          content: item.content ?? "",
        })),
      };

      await db.agentConfig.update({
        where: { id: agent.id },
        data: {
          inputSchema: nextInputSchema as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid knowledge update input."
        : error instanceof Error
          ? error.message
          : "Failed to update knowledge.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
