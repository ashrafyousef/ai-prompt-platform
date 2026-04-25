import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AgentScope, AgentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";

/* ------------------------------------------------------------------ */
/*  POST — create new agent from wizard                                */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  icon: z.string().optional(),
  teamId: z.string().nullable().optional(),
  scope: z.enum(["TEAM", "GLOBAL"]).optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  systemInstructions: z.string().min(1),
  behaviorRules: z.string().optional(),
  toneGuidance: z.string().optional(),
  avoidRules: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(100).max(8192).optional(),
  strictMode: z.boolean().optional(),
  outputMode: z.string().optional(),
  structuredSections: z.array(z.object({ title: z.string(), required: z.boolean() })).optional(),
  jsonSchema: z
    .array(z.object({ name: z.string(), type: z.string(), required: z.boolean(), description: z.string() }))
    .optional(),
  templateText: z.string().optional(),
  markdownRules: z.string().optional(),
  knowledgeSources: z
    .array(z.object({ type: z.string(), title: z.string(), content: z.string() }))
    .optional(),
  starterPrompts: z.array(z.string()).optional(),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function toKnowledgeItems(
  knowledgeSources:
    | Array<{ type: string; title: string; content: string }>
    | undefined
) {
  const items: Array<{
    id: string;
    title: string;
    sourceType: "manual_text" | "txt";
    content: string;
    fileRef: null;
    summary: string;
    tags: string[];
    priority: number;
    appliesTo: "all";
    isActive: true;
    ownerNote: string;
    lastReviewedAt: null;
    processingStatus: "ready";
  }> = [];
  (knowledgeSources ?? []).forEach((source, index) => {
      const content = source.content?.trim() ?? "";
      if (!content) return;
      items.push({
        id: `k-${index + 1}`,
        title: source.title?.trim() || `Knowledge block ${index + 1}`,
        sourceType: source.type === "file" ? "txt" : "manual_text",
        content,
        fileRef: null,
        summary: "",
        tags: [],
        priority: 3,
        appliesTo: "all",
        isActive: true,
        ownerNote: "",
        lastReviewedAt: null,
        processingStatus: "ready",
      });
    });
  return items;
}

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();
    const body = createSchema.parse(await req.json());

    let slug = slugify(body.name);
    let n = 2;
    while (await db.agentConfig.findUnique({ where: { slug } })) {
      slug = `${slugify(body.name)}-${n}`;
      n += 1;
    }

    const toneBlock = body.toneGuidance?.trim()
      ? `\n\n### Tone & Style\n${body.toneGuidance.trim()}`
      : "";
    const avoidBlock = body.avoidRules?.trim()
      ? `\n\n### What to Avoid\n${body.avoidRules.trim()}`
      : "";
    const rulesBlock = body.behaviorRules?.trim()
      ? `\n\n### Behavior Rules\n${body.behaviorRules.trim()}`
      : "";

    const systemPrompt = `${body.systemInstructions.trim()}${rulesBlock}${toneBlock}${avoidBlock}`;

    const outputFormat =
      body.outputMode === "json"
        ? "json"
        : body.outputMode === "template"
        ? "template"
        : "markdown";

    const outputSchema =
      body.outputMode === "json" && body.jsonSchema?.length
        ? {
            type: "object",
            properties: Object.fromEntries(
              body.jsonSchema.map((f) => [f.name, { type: f.type, description: f.description }])
            ),
            required: body.jsonSchema.filter((f) => f.required).map((f) => f.name),
          }
        : null;
    const knowledgeItems = toKnowledgeItems(body.knowledgeSources);
    const starterPrompts = (body.starterPrompts ?? []).map((p) => p.trim()).filter(Boolean);
    const outputConfig = {
      format: outputFormat,
      requiredSections:
        body.outputMode === "structured-markdown"
          ? (body.structuredSections ?? [])
              .map((section) => section.title.trim())
              .filter(Boolean)
          : [],
      responseDepth: "standard",
      citationsPolicy: "none",
      fallbackBehavior:
        "Provide a best-effort response in markdown when strict formatting cannot be satisfied.",
      template:
        body.outputMode === "template" && body.templateText?.trim()
          ? body.templateText.trim()
          : null,
      schema: outputSchema,
    };
    const canonicalInputSchema = {
      version: 2,
      starterPrompts,
      knowledgeItems,
      // Compatibility for older read paths still inspecting `inputSchema.knowledge`.
      knowledge: knowledgeItems.map((item) => ({
        type: item.sourceType,
        title: item.title,
        content: item.content,
      })),
      outputConfig,
      meta: {
        identity: {
          icon: body.icon?.trim() ? body.icon.trim() : null,
          category: body.category?.trim() ? body.category.trim() : null,
        },
        behavior: {
          behaviorRules: body.behaviorRules?.trim() ?? "",
          toneGuidance: body.toneGuidance?.trim() ?? "",
          avoidRules: body.avoidRules?.trim() ?? "",
          strictMode: body.strictMode ?? false,
          importMethod: null,
        },
      },
    };

    const isPublished = body.status === "PUBLISHED";

    const created = await db.agentConfig.create({
      data: {
        slug,
        name: body.name.trim(),
        description: body.description ?? null,
        systemPrompt,
        inputSchema: canonicalInputSchema,
        outputFormat: outputFormat as "markdown" | "json" | "template",
        outputSchema: outputSchema ?? undefined,
        temperature: body.temperature ?? 0.4,
        maxTokens: body.maxTokens ?? 800,
        isEnabled: isPublished,
        status: (body.status ?? "DRAFT") as AgentStatus,
        scope: (body.scope ?? "GLOBAL") as AgentScope,
        teamId: body.teamId ?? null,
      },
      select: { id: true, name: true, slug: true, status: true },
    });

    return NextResponse.json({ agent: created }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed.";
    const status =
      message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

/* ------------------------------------------------------------------ */
/*  GET — list agents (existing)                                       */
/* ------------------------------------------------------------------ */

export async function GET(req: NextRequest) {
  try {
    await requireAdminUserId();
    const { searchParams } = req.nextUrl;
    const q = searchParams.get("q")?.trim() ?? "";
    const status = searchParams.get("status");
    const scope = searchParams.get("scope");
    const teamId = searchParams.get("teamId");
    const sort = searchParams.get("sort") ?? "updatedAt_desc";

    const where: Prisma.AgentConfigWhereInput = {};
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
      ];
    }
    if (status && status !== "ALL") {
      where.status = status as AgentStatus;
    }
    if (scope && scope !== "ALL") {
      where.scope = scope as AgentScope;
    }
    if (teamId && teamId !== "ALL") {
      where.teamId = teamId === "none" ? null : teamId;
    }

    let orderBy: Prisma.AgentConfigOrderByWithRelationInput = { updatedAt: "desc" };
    if (sort === "createdAt_desc") orderBy = { createdAt: "desc" };
    if (sort === "name_asc") orderBy = { name: "asc" };

    const rows = await db.agentConfig.findMany({
      where,
      orderBy,
      select: {
        id: true,
        name: true,
        description: true,
        slug: true,
        status: true,
        scope: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
        team: { select: { id: true, name: true, slug: true } },
      },
    });

    const agents = rows.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load agents.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
