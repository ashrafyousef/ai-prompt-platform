import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";
import { buildEffectiveAgentConfig } from "@/lib/agentEffectiveConfig";

/* ------------------------------------------------------------------ */
/*  GET — full agent detail                                            */
/* ------------------------------------------------------------------ */

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireAdminUserId();
    const agent = await db.agentConfig.findUnique({
      where: { id: params.id },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        _count: { select: { messages: true } },
      },
    });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found." }, { status: 404 });
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
    await requireAdminUserId();
    const body = patchSchema.parse(await req.json());
    const id = params.id;

    const data = Object.fromEntries(
      Object.entries(body).filter(([, v]) => v !== undefined)
    ) as Record<string, unknown>;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    if (data.status === "PUBLISHED") data.isEnabled = true;
    if (data.status === "ARCHIVED") data.isEnabled = false;

    const updated = await db.agentConfig.update({
      where: { id },
      data: data as Prisma.AgentConfigUpdateInput,
      include: {
        team: { select: { id: true, name: true, slug: true } },
        _count: { select: { messages: true } },
      },
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
    await requireAdminUserId();
    await db.agentConfig.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
