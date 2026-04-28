import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authErrorStatus, requireAuthorizedUserContext } from "@/lib/auth";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { effectiveRequiresStructuredOutput } from "@/lib/agentModelPolicy";
import { DEFAULT_AGENT_SLUG } from "@/lib/chatDefaultAgent";
import { parseStarterPromptsFromAgentInputSchema } from "@/lib/chatStarterPrompts";
import { getSystemChatConfig } from "@/lib/systemConfig";
import { canViewAgentForActor } from "@/lib/agentScope";
import { resolveEffectiveAgentKnowledge } from "@/lib/knowledgeRepository";

export async function GET() {
  try {
    const auth = await requireAuthorizedUserContext();

    const where: Prisma.AgentConfigWhereInput = {
      workspaceId: auth.workspaceId,
      status: "PUBLISHED",
      isEnabled: true,
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
        teamId: true,
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

    const configuredDefaultId = getSystemChatConfig().defaultAgentId;

    const agents = rows
      .filter((a) =>
        canViewAgentForActor(
          {
            workspaceId: auth.workspaceId,
            workspaceRole: auth.workspaceRole,
            platformRole: auth.role,
            teamId: auth.teamId,
          },
          { workspaceId: auth.workspaceId, scope: a.scope, teamId: a.teamId ?? null }
        )
      )
      .map((a) => {
        const schema = normalizeAgentInputSchema(a.inputSchema);
        const effectiveKnowledge = resolveEffectiveAgentKnowledge({
          inputSchema: a.inputSchema,
          knowledgeLinks: a.knowledgeLinks,
        });
        const prefs = schema.modelPreferences;
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
          starterPrompts: parseStarterPromptsFromAgentInputSchema(
            a.inputSchema,
            schema.meta.identity.category
          ),
          systemPromptSnippet: a.systemPrompt?.slice(0, 200) ?? null,
          knowledgeCount: effectiveKnowledge.length,
          outputFormat: schema.outputConfig.format,
          responseDepth: schema.outputConfig.responseDepth,
          preferredModelId: prefs.preferredModelId,
          allowedModelIds: prefs.allowedModelIds,
          requiresStructuredOutput: effectiveRequiresStructuredOutput(
            prefs,
            schema.outputConfig.format
          ),
          requiredCapabilities: prefs.requiredCapabilities,
          modelPreferenceFallbackBehavior: prefs.fallbackBehavior,
          modelPreferenceNotes: prefs.notes?.trim() ? prefs.notes : null,
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
      { status: authErrorStatus(error, 500) }
    );
  }
}
