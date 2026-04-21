import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/auth";
import { normalizeAgentInputSchema } from "@/lib/agentConfig";
import { effectiveRequiresStructuredOutput } from "@/lib/agentModelPolicy";
import { DEFAULT_AGENT_SLUG } from "@/lib/chatDefaultAgent";
import { parseStarterPromptsFromAgentInputSchema } from "@/lib/chatStarterPrompts";
import { getSystemChatConfig } from "@/lib/systemConfig";

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
          knowledgeCount: schema.knowledgeItems.length,
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
      { status: 500 }
    );
  }
}
