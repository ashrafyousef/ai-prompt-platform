import type { UiAgent } from "@/lib/types";

/** Canonical slug used to identify the Lumex agent when no workspace default is configured elsewhere. */
export const DEFAULT_AGENT_SLUG = "lumex";

export const CHAT_LAST_USED_AGENT_STORAGE_PREFIX = "chat:lastUsedAgentId:";

export function chatLastUsedAgentStorageKey(userId: string): string {
  return `${CHAT_LAST_USED_AGENT_STORAGE_PREFIX}${userId}`;
}

/**
 * Returns true if this agent matches the Lumex workspace agent by slug or common name variants.
 * Keeps Lumex-specific matching in one module (not scattered across UI).
 */
export function isLumexAgent(agent: Pick<UiAgent, "slug" | "name">): boolean {
  const slug = agent.slug.trim().toLowerCase();
  const name = agent.name.trim().toLowerCase();
  return (
    slug === DEFAULT_AGENT_SLUG ||
    slug.endsWith(`/${DEFAULT_AGENT_SLUG}`) ||
    name === DEFAULT_AGENT_SLUG
  );
}

export type ResolveChatDefaultAgentPrefs = {
  /** Persisted client preference; must be validated against the current agent list. */
  lastUsedAgentId?: string | null;
  /** Workspace/system default (e.g. from API: agent marked `isDefault` or future `defaultAgentId`). */
  workspaceDefaultAgentId?: string | null;
};

/**
 * Resolves which agent id should be active on load. Priority:
 * 1. lastUsedAgentId if still present in the published list
 * 2. workspace/system default agent if present in the list
 * 3. Lumex (slug/name match)
 * 4. First agent in the provided list (API order: workspace default first, then name)
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
