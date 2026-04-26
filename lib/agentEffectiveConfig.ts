import type { AgentModelPreferences } from "@/lib/agentModelPolicy";
import type { Prisma } from "@prisma/client";
import {
  normalizeAgentInputSchema,
  type AgentKnowledgeItem,
  type AgentOutputConfig,
} from "@/lib/agentConfig";
import { effectiveRequiresStructuredOutput } from "@/lib/agentModelPolicy";
import { parseStarterPromptsFromAgentInputSchema } from "@/lib/chatStarterPrompts";
import type { UiStarterPrompt } from "@/lib/types";
import { resolveEffectiveAgentKnowledge } from "@/lib/knowledgeRepository";

type AgentConfigLike = {
  inputSchema: unknown;
  outputFormat: "markdown" | "json" | "template";
  outputSchema: unknown;
  knowledgeLinks?: Array<{
    legacyItemId: string | null;
    knowledge: {
      id: string;
      title: string;
      sourceType: string;
      content: string | null;
      fileRef: Prisma.JsonValue | null;
      summary: string;
      tags: Prisma.JsonValue | null;
      priority: number;
      appliesTo: string;
      isActive: boolean;
      ownerNote: string;
      lastReviewedAt: Date | null;
      processingStatus: string;
    };
  }>;
};

export type EffectiveAgentConfig = {
  knowledgeItems: AgentKnowledgeItem[];
  outputConfig: AgentOutputConfig;
  starterPrompts: UiStarterPrompt[];
  modelPreferences: AgentModelPreferences;
  requiresStructuredOutput: boolean;
  behaviorMeta: {
    behaviorRules: string;
    toneGuidance: string;
    avoidRules: string;
    strictMode: boolean;
    importMethod: string | null;
  };
  identityMeta: {
    icon: string | null;
    category: string | null;
  };
};

function hasExplicitOutputConfig(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const base = raw as Record<string, unknown>;
  if (!("outputConfig" in base)) return false;
  return Boolean(base.outputConfig && typeof base.outputConfig === "object");
}

export function buildEffectiveAgentConfig(agent: AgentConfigLike): EffectiveAgentConfig {
  const normalized = normalizeAgentInputSchema(agent.inputSchema);

  // Preserve top-level DB output contract when legacy records never wrote inputSchema.outputConfig.
  const fallbackFormat =
    agent.outputSchema && typeof agent.outputSchema === "object"
      ? "json"
      : agent.outputFormat;
  const outputConfig: AgentOutputConfig = hasExplicitOutputConfig(agent.inputSchema)
    ? {
        ...normalized.outputConfig,
        schema: normalized.outputConfig.schema ?? agent.outputSchema ?? null,
      }
    : {
        ...normalized.outputConfig,
        format: fallbackFormat,
        schema:
          fallbackFormat === "json"
            ? normalized.outputConfig.schema ?? agent.outputSchema ?? null
            : normalized.outputConfig.schema ?? null,
      };

  return {
    // Transitional dual-read truth (Phase 2.4):
    // prefer relational links when present, fallback to legacy JSON knowledgeItems.
    knowledgeItems: resolveEffectiveAgentKnowledge({
      inputSchema: agent.inputSchema,
      knowledgeLinks: agent.knowledgeLinks,
    }),
    outputConfig,
    starterPrompts: parseStarterPromptsFromAgentInputSchema(
      agent.inputSchema,
      normalized.meta.identity.category
    ),
    modelPreferences: normalized.modelPreferences,
    requiresStructuredOutput: effectiveRequiresStructuredOutput(
      normalized.modelPreferences,
      outputConfig.format
    ),
    behaviorMeta: normalized.meta.behavior,
    identityMeta: normalized.meta.identity,
  };
}
