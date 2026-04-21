import type { AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";
import type { PlatformPolicySource } from "@/lib/platformModelGovernance";

export type UiSession = {
  id: string;
  title: string;
  updatedAt: string;
};

/** Client-only assistant lifecycle (server history omits these). */
export type UiGenerationState =
  | { status: "streaming" }
  | { status: "complete" }
  | { status: "failed"; code: string; title: string; detail: string };

export type UiMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  imageUrls?: string[];
  /** One submit attempt: shared by user + assistant rows until history refresh replaces ids. */
  turnId?: string;
  deliveryStatus?: "PENDING" | "STREAMING" | "FAILED" | "COMPLETED" | "CANCELLED";
  retryOfAssistantMessageId?: string | null;
  attemptIndex?: number | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  provider?: string | null;
  model?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  failedAt?: string | null;
  generation?: UiGenerationState;
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
  | "text"
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
  /** Curated primary list vs secondary row in the model menu. */
  listSection?: "curated" | "more";
  disabledReason: string | null;
  contextWindow: number;
  visionCapable: boolean;
  healthAdvisory?: {
    status: "recently_rate_limited";
    scope: "model" | "provider";
    observedAt: string;
    ttlSeconds: number;
    message: string;
  } | null;
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
  /** Deployment (or future DB-backed) policy snapshot; complements per-user governed `models`. */
  workspacePolicy?: {
    source: PlatformPolicySource;
    defaultAgentId: string | null;
    enabledModelIds: string[] | null;
    configuredDefaultModelId: string | null;
    configuredFallbackModelId: string | null;
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
  /** Inference capabilities this agent requires (enforced with governance; blocking in chat when missing). */
  requiredCapabilities?: Array<"vision" | "structured_output" | "long_context" | "fast" | "best_quality">;
  /** Stored preference for how to handle model mismatches (UX may still evolve). */
  modelPreferenceFallbackBehavior?: "warn" | "block" | "suggest_compatible";
  /** Optional admin-only note from `modelPreferences.notes`; not shown in standard chat UI. */
  modelPreferenceNotes?: string | null;
  knowledgeItems?: AgentKnowledgeItem[];
  outputConfig?: AgentOutputConfig;
};
