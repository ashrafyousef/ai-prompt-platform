import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { canManageAgentForActor } from "@/lib/agentScope";
import { replaceAgentKnowledgeFromInputSchema } from "@/lib/knowledgeRepository";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const orig = await db.agentConfig.findUnique({ where: { id: params.id } });
    if (!orig) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    if (!canManageAgentForActor(auth, orig)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const base = `${orig.slug}-copy`;
    let slug = base;
    let n = 2;
    while (await db.agentConfig.findUnique({ where: { slug } })) {
      slug = `${base}-${n}`;
      n += 1;
    }

    const created = await db.$transaction(async (tx) => {
      const next = await tx.agentConfig.create({
        data: {
          workspaceId: orig.workspaceId,
          slug,
          name: `${orig.name} (copy)`,
          description: orig.description,
          systemPrompt: orig.systemPrompt,
          inputSchema: orig.inputSchema ?? undefined,
          outputFormat: orig.outputFormat,
          outputSchema: orig.outputSchema ?? undefined,
          temperature: orig.temperature,
          maxTokens: orig.maxTokens,
          isEnabled: false,
          status: "DRAFT",
          scope: orig.scope,
          teamId: orig.teamId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          updatedAt: true,
          workspaceId: true,
          teamId: true,
          inputSchema: true,
        },
      });

      await replaceAgentKnowledgeFromInputSchema(tx, {
        agentId: next.id,
        workspaceId: next.workspaceId,
        teamId: next.teamId ?? null,
        inputSchema: next.inputSchema as Prisma.JsonValue | null,
      });

      return next;
    });

    return NextResponse.json({
      agent: { ...created, updatedAt: created.updatedAt.toISOString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Duplicate failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
