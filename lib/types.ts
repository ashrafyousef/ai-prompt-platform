import type { AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";

export type UiSession = {
  id: string;
  title: string;
  updatedAt: string;
};

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  imageUrls?: string[];
};

export type UiStarterPrompt = {
  id: string;
  label: string;
  prompt: string;
  category?: string | null;
  order?: number | null;
  isActive?: boolean;
};

export type UiModelCapability =
  | "vision"
  | "fast"
  | "best_quality"
  | "long_context"
  | "structured_output";

export type UiModelSummary = {
  id: string;
  displayName: string;
  provider: "openai" | "groq" | "gemini";
  shortDescription: string;
  capabilities: UiModelCapability[];
  costTier: "low" | "medium" | "high";
  allowedRoles: Array<"USER" | "TEAM_LEAD" | "ADMIN">;
  enabled: boolean;
  preferredFor: string[];
  disabledReason: string | null;
  contextWindow: number;
  visionCapable: boolean;
};

export type UiModelsResponse = {
  models: UiModelSummary[];
  activeRuntimeProvider: string;
  role: string;
  monthlyTokenLimit: number;
  allowedCostTiers: Array<"low" | "medium" | "high">;
  defaults?: {
    defaultModelId: string | null;
    fallbackModelId: string | null;
  };
  governance?: {
    user: {
      used: number;
      softLimit: number;
      hardLimit: number;
      remaining: number;
      percentUsed: number;
      status: "ok" | "warning" | "blocked";
    };
    team: {
      used: number;
      softLimit: number;
      hardLimit: number;
      remaining: number;
      percentUsed: number;
      status: "ok" | "warning" | "blocked";
    } | null;
  };
};

export type UiAgent = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  category: string | null;
  availability?: "GLOBAL" | "TEAM";
  isDefault: boolean;
  starterPrompts: UiStarterPrompt[];
  systemPromptSnippet?: string | null;
  knowledgeCount?: number;
  outputFormat?: string | null;
  responseDepth?: string | null;
  preferredModelId?: string | null;
  allowedModelIds?: string[];
  requiresStructuredOutput?: boolean;
  knowledgeItems?: AgentKnowledgeItem[];
  outputConfig?: AgentOutputConfig;
};
