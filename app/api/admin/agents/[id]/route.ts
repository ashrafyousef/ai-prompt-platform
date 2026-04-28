import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { buildEffectiveAgentConfig } from "@/lib/agentEffectiveConfig";
import { assertCanAssignScopeForActor, canManageAgentForActor } from "@/lib/agentScope";
import { replaceAgentKnowledgeFromInputSchema } from "@/lib/knowledgeRepository";

/* ------------------------------------------------------------------ */
/*  GET — full agent detail                                            */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const agent = await db.agentConfig.findUnique({
      where: { id: params.id },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        _count: { select: { messages: true } },
        knowledgeLinks: {
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
          select: {
            legacyItemId: true,
            knowledge: {
              select: {
                id: true,
                title: true,
                sourceType: true,
                content: true,
                fileRef: true,
                summary: true,
                tags: true,
                priority: true,
                appliesTo: true,
                isActive: true,
                ownerNote: true,
                lastReviewedAt: true,
                processingStatus: true,
              },
            },
          },
        },
      },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    if (!canManageAgentForActor(auth, agent)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({
      agent: {
        ...agent,
        createdAt: agent.createdAt.toISOString(),
        updatedAt: agent.updatedAt.toISOString(),
        effectiveConfig: buildEffectiveAgentConfig(agent),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load agent.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH — update agent fields                                        */
/* ------------------------------------------------------------------ */

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  systemPrompt: z.string().min(1).optional(),
  inputSchema: z.record(z.unknown()).nullable().optional(),
  outputFormat: z.enum(["markdown", "json", "template"]).optional(),
  outputSchema: z.record(z.unknown()).nullable().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(8192).optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  scope: z.enum(["TEAM", "GLOBAL"]).optional(),
  teamId: z.string().nullable().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = patchSchema.parse(await req.json());
    const id = params.id;

    const existing = await db.agentConfig.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        scope: true,
        teamId: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    if (!canManageAgentForActor(auth, existing)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    if (data.status === "PUBLISHED") data.isEnabled = true;
    if (data.status === "ARCHIVED") data.isEnabled = false;

    const requestedScope = (data.scope as "TEAM" | "GLOBAL" | undefined) ?? existing.scope;
    const requestedTeamId =
      (data.teamId as string | null | undefined) !== undefined
        ? (data.teamId as string | null)
        : existing.teamId;
    const scoped = assertCanAssignScopeForActor(auth, requestedScope, requestedTeamId);
    data.scope = scoped.scope;
    data.teamId = scoped.teamId;

    if (scoped.teamId) {
      const team = await db.team.findUnique({
        where: { id: scoped.teamId },
        select: { id: true, workspaceId: true, isArchived: true },
      });
      if (!team || team.workspaceId !== auth.workspaceId || team.isArchived) {
        return NextResponse.json({ error: "Team not found." }, { status: 400 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.agentConfig.update({
        where: { id },
        data: data as Prisma.AgentConfigUpdateInput,
        include: {
          team: { select: { id: true, name: true, slug: true } },
          _count: { select: { messages: true } },
          knowledgeLinks: {
            orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
            select: {
              legacyItemId: true,
              knowledge: {
                select: {
                  id: true,
                  title: true,
                  sourceType: true,
                  content: true,
                  fileRef: true,
                  summary: true,
                  tags: true,
                  priority: true,
                  appliesTo: true,
                  isActive: true,
                  ownerNote: true,
                  lastReviewedAt: true,
                  processingStatus: true,
                },
              },
            },
          },
        },
      });

      if (data.inputSchema !== undefined) {
        await replaceAgentKnowledgeFromInputSchema(tx, {
          agentId: next.id,
          workspaceId: next.workspaceId,
          teamId: next.teamId ?? null,
          inputSchema: next.inputSchema as Prisma.JsonValue | null,
        });
      }

      return next;
    });

    return NextResponse.json({
      agent: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        effectiveConfig: buildEffectiveAgentConfig(updated),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed.";
    const status =
      message === "Unauthorized" ? 401
      : message === "Forbidden" ? 403
      : message.includes("Record") ? 404
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE — remove agent                                              */
/* ------------------------------------------------------------------ */

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const existing = await db.agentConfig.findUnique({
      where: { id: params.id },
      select: { id: true, workspaceId: true, scope: true, teamId: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    }
    if (!canManageAgentForActor(auth, existing)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await db.agentConfig.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
