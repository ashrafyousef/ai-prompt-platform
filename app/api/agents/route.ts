import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { DEFAULT_AGENT_SLUG } from "@/lib/chatDefaultAgent";
import { getSystemChatConfig } from "@/lib/systemConfig";

function buildStarterLabel(prompt: string, index: number): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  const sentence = compact.split(/[.!?]/)[0]?.trim() ?? "";
  if (!sentence) return `Starter ${index + 1}`;
  return sentence.length > 56 ? `${sentence.slice(0, 53)}...` : sentence;
}

function mapStarterPrompts(rawPrompts: string[], category: string | null) {
  return rawPrompts
    .map((prompt, index) => prompt.trim())
    .filter(Boolean)
    .map((prompt, index) => ({
      id: `starter-${index + 1}`,
      label: buildStarterLabel(prompt, index),
      prompt,
      category,
      order: index + 1,
      isActive: true,
    }));
}

function extractAgentModelPolicy(rawInputSchema: unknown): {
  preferredModelId: string | null;
  allowedModelIds: string[];
  requiresStructuredOutput: boolean | null;
} {
  const base =
    rawInputSchema && typeof rawInputSchema === "object"
      ? (rawInputSchema as Record<string, unknown>)
      : {};
  const meta = base.meta && typeof base.meta === "object"
    ? (base.meta as Record<string, unknown>)
    : {};
  const behavior = meta.behavior && typeof meta.behavior === "object"
    ? (meta.behavior as Record<string, unknown>)
    : {};

  const preferredRaw =
    typeof behavior.preferredModelId === "string"
      ? behavior.preferredModelId
      : typeof base.preferredModelId === "string"
      ? base.preferredModelId
      : null;

  const allowedRaw =
    Array.isArray(behavior.allowedModelIds)
      ? behavior.allowedModelIds
      : Array.isArray(base.allowedModelIds)
      ? base.allowedModelIds
      : [];

  const requiresStructuredRaw =
    typeof behavior.requiresStructuredOutput === "boolean"
      ? behavior.requiresStructuredOutput
      : typeof base.requiresStructuredOutput === "boolean"
      ? base.requiresStructuredOutput
      : null;

  return {
    preferredModelId: preferredRaw?.trim() || null,
    allowedModelIds: allowedRaw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
    requiresStructuredOutput: requiresStructuredRaw,
  };
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userTeamId = session.user.teamId ?? null;

    const where: Prisma.AgentConfigWhereInput = {
      status: "PUBLISHED",
      isEnabled: true,
      OR: [
        { scope: "GLOBAL" },
        ...(userTeamId ? [{ scope: "TEAM" as const, teamId: userTeamId }] : []),
      ],
    };

    const rows = await db.agentConfig.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        systemPrompt: true,
        inputSchema: true,
        scope: true,
      },
    });

    const configuredDefaultId = getSystemChatConfig().defaultAgentId;

    const agents = rows
      .map((a) => {
        const schema = normalizeAgentInputSchema(a.inputSchema);
        const modelPolicy = extractAgentModelPolicy(a.inputSchema);
        const slugLower = a.slug.toLowerCase();
        const isWorkspaceDefault = configuredDefaultId
          ? a.id === configuredDefaultId
          : slugLower === DEFAULT_AGENT_SLUG;
        return {
          id: a.id,
          name: a.name,
          slug: a.slug,
          description: a.description,
          icon: schema.meta.identity.icon,
          category: schema.meta.identity.category,
          availability: a.scope,
          isDefault: isWorkspaceDefault,
          starterPrompts: mapStarterPrompts(
            schema.starterPrompts,
            schema.meta.identity.category
          ),
          systemPromptSnippet: a.systemPrompt?.slice(0, 200) ?? null,
          knowledgeCount: schema.knowledgeItems.length,
          outputFormat: schema.outputConfig.format,
          responseDepth: schema.outputConfig.responseDepth,
          preferredModelId: modelPolicy.preferredModelId,
          allowedModelIds: modelPolicy.allowedModelIds,
          requiresStructuredOutput:
            modelPolicy.requiresStructuredOutput ?? schema.outputConfig.format !== "markdown",
        };
      })
      .sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load agents." },
      { status: 500 }
    );
  }
}
