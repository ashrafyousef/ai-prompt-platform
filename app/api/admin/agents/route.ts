import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AgentScope, AgentStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdminUserId } from "@/lib/adminAuth";
import {
  agentKnowledgeItemSchema,
  agentOutputConfigSchema,
  normalizeAgentInputSchema,
} from "@/lib/agentConfig";

/* ------------------------------------------------------------------ */
/*  POST — create new agent from wizard                                */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  importMethod: z.enum(["manual", "guided", "knowledge-first"]).optional(),
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
  outputConfig: agentOutputConfigSchema.optional(),
  knowledgeItems: z.array(agentKnowledgeItemSchema).optional(),
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

export async function POST(req: NextRequest) {
  try {
    await requireAdminUserId();

    let body: z.infer<typeof createSchema>;
    try {
      body = createSchema.parse(await req.json());
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

    if (body.scope === "TEAM" && !body.teamId) {
      return NextResponse.json(
        { error: "Team is required when scope is TEAM." },
        { status: 400 }
      );
    }

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

    const normalizedOutputConfig = body.outputConfig
      ? {
          ...body.outputConfig,
          requiredSections: (body.outputConfig.requiredSections ?? [])
            .map((s) => s.trim())
            .filter(Boolean),
        }
      : agentOutputConfigSchema.parse({
          format:
            body.outputMode === "json"
              ? "json"
              : body.outputMode === "template"
              ? "template"
              : "markdown",
          requiredSections:
            body.structuredSections?.map((section) => section.title.trim()).filter(Boolean) ?? [],
          template: body.templateText?.trim() || null,
          schema:
            body.outputMode === "json" && body.jsonSchema?.length
              ? {
                  type: "object",
                  properties: Object.fromEntries(
                    body.jsonSchema.map((field) => [
                      field.name,
                      { type: field.type, description: field.description },
                    ])
                  ),
                  required: body.jsonSchema
                    .filter((field) => field.required)
                    .map((field) => field.name),
                }
              : null,
        });

    const legacyKnowledgeItems =
      body.knowledgeSources?.map((source, index) => ({
        id: `legacy-${index}`,
        title: source.title.trim() || `Knowledge source ${index + 1}`,
        sourceType:
          source.type === "file"
            ? "txt"
            : source.type === "manual_text" ||
              source.type === "faq" ||
              source.type === "pdf" ||
              source.type === "docx" ||
              source.type === "txt" ||
              source.type === "glossary" ||
              source.type === "rules" ||
              source.type === "examples"
            ? source.type
            : "manual_text",
        content: source.content.trim() || null,
        fileRef: null,
        summary: "",
        tags: [],
        priority: 3,
        appliesTo: "all",
        isActive: true,
        ownerNote: "",
        lastReviewedAt: null,
      })) ?? [];

    const knowledgeItems = (body.knowledgeItems ?? legacyKnowledgeItems).filter(
      (item) =>
        item.title.trim().length > 0 &&
        ((item.content?.trim().length ?? 0) > 0 || item.fileRef?.fileName)
    );

    const starterPrompts = (body.starterPrompts ?? [])
      .map((prompt) => prompt.trim())
      .filter(Boolean);

    const normalizedInputSchema = normalizeAgentInputSchema({
      version: 2,
      starterPrompts,
      knowledgeItems,
      outputConfig: normalizedOutputConfig,
      meta: {
        identity: {
          icon: body.icon?.trim() || null,
          category: body.category?.trim() || null,
        },
        behavior: {
          behaviorRules: body.behaviorRules?.trim() || "",
          toneGuidance: body.toneGuidance?.trim() || "",
          avoidRules: body.avoidRules?.trim() || "",
          strictMode: body.strictMode ?? false,
          importMethod: body.importMethod ?? null,
        },
      },
      // Legacy compatibility keys still consumed by existing UI paths.
      icon: body.icon?.trim() || null,
      category: body.category?.trim() || null,
      knowledge: knowledgeItems.map((item) => ({
        type: item.sourceType,
        title: item.title,
        content: item.content ?? "",
      })),
    });

    const isPublished = body.status === "PUBLISHED";

    const created = await db.agentConfig.create({
      data: {
        slug,
        name: body.name.trim(),
        description: body.description ?? null,
        systemPrompt,
        inputSchema: normalizedInputSchema as Prisma.InputJsonValue,
        outputFormat: normalizedOutputConfig.format,
        outputSchema:
          normalizedOutputConfig.format === "json"
            ? (normalizedOutputConfig.schema as Prisma.InputJsonValue | null) ?? undefined
            : undefined,
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
    if (error instanceof z.ZodError) {
      const first = error.errors[0];
      const field = first?.path?.join(".") || "input";
      return NextResponse.json(
        { error: `Validation error on "${field}": ${first?.message ?? "invalid value"}.` },
        { status: 400 }
      );
    }
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
