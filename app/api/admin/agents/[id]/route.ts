import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";
import {
  agentKnowledgeItemSchema,
  agentOutputConfigSchema,
  normalizeAgentInputSchema,
} from "@/lib/agentConfig";

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
  outputConfig: agentOutputConfigSchema.optional(),
  knowledgeItems: z.array(agentKnowledgeItemSchema).optional(),
  starterPrompts: z.array(z.string().min(1)).optional(),
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

    let body: z.infer<typeof patchSchema>;
    try {
      body = patchSchema.parse(await req.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        const first = err.errors[0];
        const field = first?.path?.join(".") || "input";
        return NextResponse.json(
          { error: `Validation error on "${field}": ${first?.message ?? "invalid value"}.` },
          { status: 400 }
        );
      }
      throw err;
    }

    const id = params.id;

    if (body.scope === "TEAM" && body.teamId === null) {
      return NextResponse.json(
        { error: "Team is required when scope is TEAM." },
        { status: 400 }
      );
    }

    if (body.outputConfig) {
      body.outputConfig = {
        ...body.outputConfig,
        requiredSections: (body.outputConfig.requiredSections ?? [])
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (body.outputConfig.format === "template" && !body.outputConfig.template?.trim()) {
        return NextResponse.json(
          { error: "Template format requires a template body." },
          { status: 400 }
        );
      }
    }

    if (body.knowledgeItems) {
      body.knowledgeItems = body.knowledgeItems.filter(
        (item) =>
          item.title.trim().length > 0 &&
          ((item.content ?? "").trim().length > 0 || item.fileRef?.fileName)
      );
    }

    const needsStructuredMerge =
      body.outputConfig !== undefined ||
      body.knowledgeItems !== undefined ||
      body.starterPrompts !== undefined;

    const data = Object.fromEntries(
      Object.entries(body).filter(
        ([key, value]) =>
          value !== undefined &&
          key !== "outputConfig" &&
          key !== "knowledgeItems" &&
          key !== "starterPrompts"
      )
    ) as Record<string, unknown>;

    if (needsStructuredMerge) {
      const current = await db.agentConfig.findUnique({
        where: { id },
        select: { inputSchema: true },
      });
      if (!current) {
        return NextResponse.json({ error: "Agent not found." }, { status: 404 });
      }

      const normalized = normalizeAgentInputSchema(current.inputSchema);
      const starterPrompts = body.starterPrompts
        ? body.starterPrompts.map((prompt) => prompt.trim()).filter(Boolean)
        : normalized.starterPrompts;
      const knowledgeItems = body.knowledgeItems ?? normalized.knowledgeItems;
      const outputConfig = body.outputConfig ?? normalized.outputConfig;

      data.inputSchema = {
        ...normalized,
        starterPrompts,
        knowledgeItems,
        outputConfig,
        icon: normalized.meta.identity.icon,
        category: normalized.meta.identity.category,
        knowledge: knowledgeItems.map((item) => ({
          type: item.sourceType,
          title: item.title,
          content: item.content ?? "",
        })),
      };

      if (body.outputConfig && !body.outputFormat) {
        data.outputFormat = body.outputConfig.format;
      }
      if (body.outputConfig) {
        data.outputSchema =
          body.outputConfig.format === "json" ? body.outputConfig.schema : null;
      }
    }

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
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const first = error.errors[0];
      const field = first?.path?.join(".") || "input";
      return NextResponse.json(
        { error: `Validation error on "${field}": ${first?.message ?? "invalid value"}.` },
        { status: 400 }
      );
    }
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
