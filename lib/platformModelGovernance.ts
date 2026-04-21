/**
 * Platform model governance — single entry for “how models and chat defaults are configured”.
 *
 * **Layers (in order):**
 * 1. **Registry** — `MODEL_REGISTRY_DEFINITIONS` / `getModelRegistry()` in `lib/models.ts` (display names, provider,
 *    capabilities, cost tier, role columns, provider API ids).
 * 2. **Deployment policy** — env vars below (enablement, allowlists, default model ids). Parsed in `lib/systemConfig.ts`.
 * 3. **Usage governance** — monthly token budgets in `lib/usage.ts` (`ROLE_LIMITS` + `TokenUsage`).
 *
 * **Future admin UI:** persist the same logical shape as `SystemModelGovernanceConfig` + `SystemChatConfig` per workspace
 * (or global tenant), merge DB overrides before env, and set `policySource` to `"database"`. Do not duplicate registry
 * rows in the DB unless you need per-tenant overrides; prefer referencing `modelId` keys from the code registry.
 */

import type { ModelOption, UserRole } from "./models";
import {
  MODEL_REGISTRY_DEFINITIONS,
  ROLE_LIMITS,
  getModelRegistry,
  resolveConfiguredDefaultModelId,
  resolveConfiguredFallbackModelId,
} from "./models";
import {
  getSystemChatConfig,
  getSystemModelGovernanceConfig,
  type SystemChatConfig,
  type SystemModelGovernanceConfig,
} from "./systemConfig";

/** Env keys that map to `getSystemModelGovernanceConfig` / `getSystemChatConfig` (document for operators). */
export const PLATFORM_MODEL_ENV_KEYS = {
  defaultModelId: "CHAT_DEFAULT_MODEL_ID",
  fallbackModelId: "CHAT_FALLBACK_MODEL_ID",
  enabledModelIds: "CHAT_ENABLED_MODEL_IDS",
  roleModelAllowlistJson: "CHAT_ROLE_MODEL_ALLOWLIST_JSON",
  defaultAgentId: "CHAT_DEFAULT_AGENT_ID",
  tokenSoftLimit: "TOKEN_SOFT_LIMIT",
  tokenHardLimit: "TOKEN_HARD_LIMIT",
  teamTokenSoftLimit: "TEAM_TOKEN_SOFT_LIMIT",
  teamTokenHardLimit: "TEAM_TOKEN_HARD_LIMIT",
} as const;

export type PlatformPolicySource = "environment" | "database";

export type PlatformModelGovernance = {
  policySource: PlatformPolicySource;
  systemModelPolicy: SystemModelGovernanceConfig;
  systemChatDefaults: SystemChatConfig;
  /** Immutable curated rows (metadata only). */
  registryDefinitions: typeof MODEL_REGISTRY_DEFINITIONS;
  /** Registry with runtime enablement (API keys + enabled list). */
  resolvedRegistry: ModelOption[];
  roleLimits: typeof ROLE_LIMITS;
};

export function getPlatformModelGovernance(): PlatformModelGovernance {
  return {
    policySource: "environment",
    systemModelPolicy: getSystemModelGovernanceConfig(),
    systemChatDefaults: getSystemChatConfig(),
    registryDefinitions: MODEL_REGISTRY_DEFINITIONS,
    resolvedRegistry: getModelRegistry(),
    roleLimits: ROLE_LIMITS,
  };
}

/** Effective default/fallback ids for a governed model list (e.g. after role + budget filters). */
export function resolvePlatformModelDefaults(models: ModelOption[]): {
  defaultModelId: string | null;
  fallbackModelId: string | null;
} {
  return {
    defaultModelId: resolveConfiguredDefaultModelId(models),
    fallbackModelId: resolveConfiguredFallbackModelId(models),
  };
}

/** Role policy snapshot for diagnostics or future admin read APIs. */
export function getRoleModelPolicy(role: UserRole) {
  return ROLE_LIMITS[role] ?? ROLE_LIMITS.USER;
}
