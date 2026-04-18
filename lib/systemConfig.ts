import type { UserRole } from "@/lib/models";

export type SystemModelGovernanceConfig = {
  defaultModelId: string | null;
  fallbackModelId: string | null;
  enabledModelIds: string[] | null;
  roleModelAllowlist: Partial<Record<UserRole, string[]>>;
};

export type SystemChatConfig = {
  defaultAgentId: string | null;
};

function parseCsv(value: string | undefined): string[] | null {
  if (!value) return null;
  const parsed = value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : null;
}

function parseRoleModelAllowlist(raw: string | undefined): Partial<Record<UserRole, string[]>> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const roles: UserRole[] = ["USER", "TEAM_LEAD", "ADMIN"];
    return roles.reduce<Partial<Record<UserRole, string[]>>>((acc, role) => {
      const value = parsed[role];
      if (Array.isArray(value)) {
        const normalized = value
          .filter((entry): entry is string => typeof entry === "string")
          .map((entry) => entry.trim())
          .filter(Boolean);
        if (normalized.length > 0) {
          acc[role] = normalized;
        }
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function getSystemModelGovernanceConfig(): SystemModelGovernanceConfig {
  return {
    defaultModelId: process.env.CHAT_DEFAULT_MODEL_ID?.trim() || null,
    fallbackModelId: process.env.CHAT_FALLBACK_MODEL_ID?.trim() || null,
    enabledModelIds: parseCsv(process.env.CHAT_ENABLED_MODEL_IDS),
    roleModelAllowlist: parseRoleModelAllowlist(process.env.CHAT_ROLE_MODEL_ALLOWLIST_JSON),
  };
}

export function getSystemChatConfig(): SystemChatConfig {
  return {
    defaultAgentId: process.env.CHAT_DEFAULT_AGENT_ID?.trim() || null,
  };
}
