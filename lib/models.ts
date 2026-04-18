import { getSystemModelGovernanceConfig } from "@/lib/systemConfig";

export type UserRole = "USER" | "TEAM_LEAD" | "ADMIN";
export type ModelProvider = "openai" | "groq" | "gemini";
export type ModelCapability =
  | "vision"
  | "fast"
  | "best_quality"
  | "long_context"
  | "structured_output";
export type ModelCostTier = "low" | "medium" | "high";
export type ModelPreferredFor = "default" | "reasoning" | "multimodal" | "structured";

export type ModelOption = {
  id: string;
  displayName: string;
  provider: ModelProvider;
  modelId: string;
  shortDescription: string;
  capabilities: ModelCapability[];
  costTier: ModelCostTier;
  allowedRoles: UserRole[];
  enabled: boolean;
  preferredFor?: ModelPreferredFor[];
  softLimitPolicy: {
    budgetScope: "user" | "team";
    warnAtPercent: number;
  };
  hardLimitPolicy: {
    budgetScope: "user" | "team";
    blockAtPercent: number;
  };
  contextWindow: number;
  runtimeAvailable: boolean;
  disabledReason?: string;
};

export type RoleLimitConfig = {
  monthlySoftTokenLimit: number;
  monthlyHardTokenLimit: number;
  allowedCostTiers: ModelCostTier[];
};

type ModelRegistryEntry = Omit<ModelOption, "runtimeAvailable" | "enabled" | "disabledReason">;

const BASE_MODELS: ModelRegistryEntry[] = [
  {
    id: "openai-gpt-4.1",
    displayName: "GPT-4.1",
    provider: "openai",
    modelId: "gpt-4.1",
    shortDescription: "High-quality reasoning and generation for complex tasks.",
    capabilities: ["best_quality", "long_context", "structured_output"],
    costTier: "high",
    allowedRoles: ["TEAM_LEAD", "ADMIN"],
    preferredFor: ["reasoning"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 80 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 1_000_000,
  },
  {
    id: "openai-gpt-4o-mini",
    displayName: "GPT-4o Mini",
    provider: "openai",
    modelId: "gpt-4o-mini",
    shortDescription: "Fast multimodal OpenAI model for everyday assistant work.",
    capabilities: ["vision", "fast", "structured_output"],
    costTier: "low",
    allowedRoles: ["USER", "TEAM_LEAD", "ADMIN"],
    preferredFor: ["default", "multimodal"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 85 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 128_000,
  },
  {
    id: "gemini-2.5-pro",
    displayName: "Gemini 2.5 Pro",
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    shortDescription: "Advanced reasoning and long-context model (planned provider integration).",
    capabilities: ["best_quality", "long_context", "structured_output"],
    costTier: "high",
    allowedRoles: ["TEAM_LEAD", "ADMIN"],
    preferredFor: ["reasoning"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 80 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 1_000_000,
  },
  {
    id: "groq-llama-8b",
    displayName: "Llama 3.1 8B (Groq)",
    provider: "groq",
    modelId: "llama-3.1-8b-instant",
    shortDescription: "Ultra-fast text model for quick iterations.",
    capabilities: ["fast"],
    costTier: "low",
    allowedRoles: ["USER", "TEAM_LEAD", "ADMIN"],
    preferredFor: ["default"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 85 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 8_192,
  },
  {
    id: "groq-llama-70b",
    displayName: "Llama 3.3 70B (Groq)",
    provider: "groq",
    modelId: "llama-3.3-70b-versatile",
    shortDescription: "Higher-quality Groq text model for deeper reasoning.",
    capabilities: ["best_quality", "structured_output"],
    costTier: "medium",
    allowedRoles: ["TEAM_LEAD", "ADMIN"],
    preferredFor: ["reasoning"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 80 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 32_768,
  },
  {
    id: "groq-llama-vision",
    displayName: "Llama 4 Scout (Vision)",
    provider: "groq",
    modelId: "meta-llama/llama-4-scout-17b-16e-instruct",
    shortDescription: "Vision-capable model for image + text conversations.",
    capabilities: ["vision", "fast"],
    costTier: "medium",
    allowedRoles: ["TEAM_LEAD", "ADMIN"],
    preferredFor: ["multimodal"],
    softLimitPolicy: { budgetScope: "user", warnAtPercent: 80 },
    hardLimitPolicy: { budgetScope: "user", blockAtPercent: 100 },
    contextWindow: 16_384,
  },
];

export const ROLE_LIMITS: Record<UserRole, RoleLimitConfig> = {
  USER: {
    monthlySoftTokenLimit: 150_000,
    monthlyHardTokenLimit: 200_000,
    allowedCostTiers: ["low"],
  },
  TEAM_LEAD: {
    monthlySoftTokenLimit: 400_000,
    monthlyHardTokenLimit: 500_000,
    allowedCostTiers: ["low", "medium", "high"],
  },
  ADMIN: {
    monthlySoftTokenLimit: 1_500_000,
    monthlyHardTokenLimit: 2_000_000,
    allowedCostTiers: ["low", "medium", "high"],
  },
};

function providerRuntimeAvailable(provider: ModelProvider): boolean {
  if (provider === "openai") return Boolean(process.env.OPENAI_API_KEY);
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  return false;
}

function withRuntimeState(model: ModelRegistryEntry): ModelOption {
  const config = getSystemModelGovernanceConfig();
  const runtimeAvailable = providerRuntimeAvailable(model.provider);
  let enabled = runtimeAvailable;
  let disabledReason: string | undefined;

  if (!runtimeAvailable) {
    enabled = false;
    disabledReason =
      model.provider === "gemini"
        ? "Gemini provider is not enabled in this workspace yet."
        : `Missing ${model.provider.toUpperCase()} API credentials.`;
  }

  if (enabled && config.enabledModelIds && !config.enabledModelIds.includes(model.id)) {
    enabled = false;
    disabledReason = "This model is disabled by system configuration.";
  }

  return {
    ...model,
    runtimeAvailable,
    enabled,
    disabledReason,
  };
}

export function getModelRegistry(): ModelOption[] {
  return BASE_MODELS.map(withRuntimeState);
}

export const MODEL_REGISTRY: ModelOption[] = getModelRegistry();

export function resolveModelById(modelId: string): ModelOption | undefined {
  return getModelRegistry().find((m) => m.id === modelId);
}

export function getModelsForRole(role: UserRole): ModelOption[] {
  const config = getSystemModelGovernanceConfig();
  return getModelRegistry()
    .filter((m) => {
      if (!m.allowedRoles.includes(role)) return false;
      const allowlist = config.roleModelAllowlist[role];
      if (allowlist && allowlist.length > 0) {
        return allowlist.includes(m.id);
      }
      return true;
    })
    .sort((a, b) => {
      const aDefault = a.preferredFor?.includes("default") ? 1 : 0;
      const bDefault = b.preferredFor?.includes("default") ? 1 : 0;
      if (aDefault !== bDefault) return bDefault - aDefault;
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1;
      return a.displayName.localeCompare(b.displayName);
    });
}

export function detectProvider(): "groq" | "openai" {
  return process.env.GROQ_API_KEY ? "groq" : "openai";
}

export function resolveConfiguredDefaultModelId(models: ModelOption[]): string | null {
  const config = getSystemModelGovernanceConfig();
  if (config.defaultModelId && models.some((model) => model.id === config.defaultModelId)) {
    return config.defaultModelId;
  }

  const preferredDefault = models.find((model) => model.preferredFor?.includes("default") && model.enabled);
  if (preferredDefault) return preferredDefault.id;

  const firstEnabled = models.find((model) => model.enabled);
  return firstEnabled?.id ?? null;
}

export function resolveConfiguredFallbackModelId(models: ModelOption[]): string | null {
  const config = getSystemModelGovernanceConfig();
  if (config.fallbackModelId && models.some((model) => model.id === config.fallbackModelId)) {
    return config.fallbackModelId;
  }

  const lowCostEnabled = models.find((model) => model.enabled && model.costTier === "low");
  if (lowCostEnabled) return lowCostEnabled.id;

  const firstEnabled = models.find((model) => model.enabled);
  return firstEnabled?.id ?? null;
}
