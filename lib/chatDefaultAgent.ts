import type { UiAgent } from "@/lib/types";

/** Canonical slug for the default published chat agent when no workspace default is configured elsewhere. */
export const DEFAULT_AGENT_SLUG = "visual-director";

/** Legacy slug retained for backward compatibility during Beta 1.2 transition. */
export const LEGACY_DEFAULT_AGENT_SLUG = "lumex";

export const CHAT_LAST_USED_AGENT_STORAGE_PREFIX = "chat:lastUsedAgentId:";

export function chatLastUsedAgentStorageKey(userId: string): string {
  return `${CHAT_LAST_USED_AGENT_STORAGE_PREFIX}${userId}`;
}

/**
 * Returns true if this agent matches the workspace default chat agent by slug, name, or id.
 * Supports Visual Director (current) and legacy Lumex slug during transition.
 */
export function isLumexAgent(agent: Pick<UiAgent, "slug" | "name" | "id">): boolean {
  const slug = agent.slug.trim().toLowerCase();
  const name = agent.name.trim().toLowerCase();
  const id = agent.id.trim().toLowerCase();
  const slugs = [DEFAULT_AGENT_SLUG, LEGACY_DEFAULT_AGENT_SLUG];
  return slugs.some(
    (candidate) =>
      slug === candidate ||
      slug.endsWith(`/${candidate}`) ||
      name === candidate ||
      id === candidate
  );
}

/** Published agent flagged by the API as the workspace default (`CHAT_DEFAULT_AGENT_ID` or Lumex when unset). */
export function getWorkspaceDefaultAgentId(agents: UiAgent[]): string | null {
  const marked = agents.find((a) => a.isDefault);
  return marked?.id ?? null;
}

export type ResolveChatDefaultAgentPrefs = {
  /** Persisted client preference; must be validated against the current agent list. */
  lastUsedAgentId?: string | null;
  /** Workspace/system default (e.g. from API: agent marked `isDefault` or future `defaultAgentId`). */
  workspaceDefaultAgentId?: string | null;
};

/**
 * Resolves which agent id should be active on load. Priority:
 * 1. lastUsedAgentId if still present in the published list (returning users)
 * 2. workspace/system default agent id if present (env `CHAT_DEFAULT_AGENT_ID` or API fallback; future: admin DB)
 * 3. Visual Director or legacy Lumex (slug / name / id match via {@link isLumexAgent})
 * 4. First agent in the provided list (API order: default first, then name)
 */
export function resolveChatDefaultAgentId(
  agents: UiAgent[],
  prefs: ResolveChatDefaultAgentPrefs
): string {
  if (agents.length === 0) return "";

  const byId = (id: string) => agents.find((a) => a.id === id);

  const last = prefs.lastUsedAgentId?.trim();
  if (last && byId(last)) return last;

  const workspace = prefs.workspaceDefaultAgentId?.trim();
  if (workspace && byId(workspace)) return workspace;

  const lumex = agents.find((a) => isLumexAgent(a));
  if (lumex) return lumex.id;

  return agents[0].id;
}
