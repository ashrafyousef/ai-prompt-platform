/**
 * Agent `modelPreferences` vs platform governance — enforcement & sanitization
 * -----------------------------------------------------------------------------
 * **Field definitions & defaults:** `lib/agentModelPolicy.ts` (Zod schema + merge/legacy parsing).
 *
 * **Precedence (highest first):**
 * 1. Platform governance — curated registry, role/tier, workspace allowlists, provider keys, `enabledModelIds`,
 *    monthly/team budget (`getModelsForRole`, `applyGovernanceToModels`, `GET /api/models`).
 * 2. Agent `modelPreferences` — narrows *within* the user’s governed list (allowlist ∩ visible models; required caps).
 * 3. User selection — must appear on the governed list for that session (`assertGovernedModelSessionAccessible` on send).
 * 4. Explicit UX + validation — `computeModelCompatibilityIssues` / `validateSendTimeModelPreferences`; no silent reroutes.
 *
 * `preferredModelId`: advisory only. `fallbackBehavior`: warning/block *severity* for soft rules, not model swapping.
 *
 * **Future extension (design questions — not implemented here):** DB-backed workspace policy should extend usage/registry
 * paths, not agent prefs alone; agent “premium” allowances must still intersect `/api/models`; consider role-aware
 * publish validation, an effective-policy debug view, and a clearer split between hard capability tags vs runtime
 * heuristics (context size estimates).
 */

import type { AgentModelPreferences } from "@/lib/agentModelPolicy";
import type { UserRole } from "@/lib/models";
import { buildModelAccessDeniedMessage, resolveModelById } from "@/lib/models";
import type { UiModelSummary } from "@/lib/types";

/** Strip unknown or removed registry ids so stored agent config stays aligned with the curated registry. */
export function sanitizeModelPreferencesToRegistry(mp: AgentModelPreferences): AgentModelPreferences {
  const allowedModelIds = mp.allowedModelIds.filter((id) => Boolean(resolveModelById(id)));
  const preferredModelId =
    mp.preferredModelId && resolveModelById(mp.preferredModelId) ? mp.preferredModelId : null;
  if (
    allowedModelIds.length === mp.allowedModelIds.length &&
    preferredModelId === mp.preferredModelId
  ) {
    return mp;
  }
  return { ...mp, allowedModelIds, preferredModelId };
}

export type GovernedModelSessionRow = {
  id: string;
  enabled: boolean;
  displayName: string;
  disabledReason?: string | null;
};

/**
 * Enforce session-level governance after role checks: model must appear in the governed list and be enabled
 * (registry + budget overlays). Call after `assertModelAccessForRole` and `getGovernedModelsForUser`.
 */
export function assertGovernedModelSessionAccessible(
  modelId: string,
  governedModels: GovernedModelSessionRow[],
  role: UserRole
): void {
  const row = governedModels.find((m) => m.id === modelId);
  if (!row) {
    throw new Error(buildModelAccessDeniedMessage(modelId, role));
  }
  if (!row.enabled) {
    throw new Error(row.disabledReason ?? `${row.displayName} is currently unavailable.`);
  }
}

/**
 * Pick the first model that is both **governed-visible** (`models` from `GET /api/models`) and, when set,
 * allowed by the agent allowlist. Use for compatibility suggestions only — never to auto-switch sends.
 */
export function pickFirstCompatibleGovernedModel(
  models: UiModelSummary[],
  options: {
    allowedModelIds?: readonly string[] | null;
    predicate: (m: UiModelSummary) => boolean;
  }
): UiModelSummary | undefined {
  const allowedSet =
    options.allowedModelIds && options.allowedModelIds.length > 0
      ? new Set(options.allowedModelIds)
      : null;
  return models.find(
    (m) =>
      m.enabled &&
      (!allowedSet || allowedSet.has(m.id)) &&
      options.predicate(m)
  );
}
