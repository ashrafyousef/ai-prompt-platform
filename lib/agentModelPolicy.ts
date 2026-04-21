import { z } from "zod";
import type { UiModelCapability } from "@/lib/types";

/**
 * Agent model preferences — canonical contract
 * ---------------------------------------------
 * **Storage:** `inputSchema.modelPreferences` on `AgentConfig` (JSON). Typed by {@link agentModelPreferencesSchema}.
 *
 * **Backward compatibility:** Older data may use `meta.modelPolicy` or loose root/behavior keys. On read,
 * {@link parseLegacyModelPolicyFields} collects those fragments; {@link mergeAgentModelPreferences} folds them with
 * root `modelPreferences`; `normalizeAgentInputSchema` (`agentConfig.ts`) runs the full merge, then
 * `sanitizeModelPreferencesToRegistry` (`agentModelGovernance.ts`) drops unknown registry ids.
 *
 * **Governance precedence** (summary): platform registry + role + budget + env first; agent prefs *narrow* the
 * user’s governed set; never widen it. Full order and enforcement helpers: `lib/agentModelGovernance.ts`.
 *
 * **Field semantics** (defaults from schema):
 * - `preferredModelId` — Optional hint for UX; not auto-applied; advisory if governance hides the model.
 * - `allowedModelIds` — Empty = no agent-level restriction; otherwise intersect with the user’s `/api/models` list.
 * - `requiresStructuredOutput` — `null` ⇒ infer from output format (non-markdown ⇒ structured).
 * - `requiredCapabilities` — Tags the selected model must satisfy (subset of platform capabilities).
 * - `fallbackBehavior` — Soft-rule severity only (e.g. long-context heuristic); does not change routing.
 * - `notes` — Admin-only; not used in chat routing.
 */

/** Capability tags agents may require (subset of platform model capabilities). */
export const AGENT_SELECTABLE_CAPABILITIES = [
  "vision",
  "structured_output",
  "long_context",
  "fast",
  "best_quality",
] as const satisfies readonly UiModelCapability[];

export type AgentSelectableCapability = (typeof AGENT_SELECTABLE_CAPABILITIES)[number];

const capabilityItemSchema = z.enum([
  "vision",
  "structured_output",
  "long_context",
  "fast",
  "best_quality",
]);

export const modelPreferenceFallbackBehaviorValues = ["warn", "block", "suggest_compatible"] as const;
export type ModelPreferenceFallbackBehavior = (typeof modelPreferenceFallbackBehaviorValues)[number];

/** Zod source of truth for persisted `modelPreferences`. See module docblock above for semantics. */
export const agentModelPreferencesSchema = z.object({
  preferredModelId: z.string().nullable().optional().default(null),
  allowedModelIds: z.array(z.string().min(1)).default([]),
  requiresStructuredOutput: z.boolean().nullable().optional().default(null),
  requiredCapabilities: z.array(capabilityItemSchema).default([]),
  fallbackBehavior: z
    .enum(modelPreferenceFallbackBehaviorValues)
    .default("suggest_compatible"),
  notes: z.string().optional().default(""),
});

export type AgentModelPreferences = z.infer<typeof agentModelPreferencesSchema>;

/** @deprecated Use {@link AgentModelPreferences} — alias for incremental refactors. */
export type AgentModelPolicy = AgentModelPreferences;

export function defaultAgentModelPreferences(): AgentModelPreferences {
  return agentModelPreferencesSchema.parse({});
}

/** @deprecated Use {@link defaultAgentModelPreferences}. */
export function defaultAgentModelPolicy(): AgentModelPreferences {
  return defaultAgentModelPreferences();
}

export const agentModelPolicySchema = agentModelPreferencesSchema;

/**
 * Merge partial prefs onto defaults (validated). For DB reads, prefer {@link normalizeAgentInputSchema} which
 * also applies legacy extraction and registry sanitization.
 */
export function mergeAgentModelPreferences(
  parsed: Partial<AgentModelPreferences> | undefined,
  legacy: Partial<AgentModelPreferences>
): AgentModelPreferences {
  return agentModelPreferencesSchema.parse({
    ...defaultAgentModelPreferences(),
    ...legacy,
    ...parsed,
  });
}

/** @deprecated Use {@link mergeAgentModelPreferences}. */
export const mergeAgentModelPolicy = mergeAgentModelPreferences;

/**
 * Read legacy model-policy fields from root `modelPreferences`, `meta.modelPolicy`, `meta.behavior`, and root
 * keys — used only as input to {@link normalizeAgentInputSchema}.
 */
export function parseLegacyModelPolicyFields(base: Record<string, unknown>): Partial<AgentModelPreferences> {
  const meta = base.meta && typeof base.meta === "object" ? (base.meta as Record<string, unknown>) : {};
  const behavior =
    meta.behavior && typeof meta.behavior === "object"
      ? (meta.behavior as Record<string, unknown>)
      : {};

  const oldPolicy =
    meta.modelPolicy && typeof meta.modelPolicy === "object"
      ? (meta.modelPolicy as Record<string, unknown>)
      : {};

  const rootPrefs =
    base.modelPreferences && typeof base.modelPreferences === "object"
      ? (base.modelPreferences as Record<string, unknown>)
      : {};

  const preferredRaw =
    typeof rootPrefs.preferredModelId === "string"
      ? rootPrefs.preferredModelId
      : typeof oldPolicy.preferredModelId === "string"
      ? oldPolicy.preferredModelId
      : typeof behavior.preferredModelId === "string"
      ? behavior.preferredModelId
      : typeof base.preferredModelId === "string"
      ? base.preferredModelId
      : null;

  const allowedRaw = Array.isArray(rootPrefs.allowedModelIds)
    ? rootPrefs.allowedModelIds
    : Array.isArray(oldPolicy.allowedModelIds)
    ? oldPolicy.allowedModelIds
    : Array.isArray(behavior.allowedModelIds)
    ? behavior.allowedModelIds
    : Array.isArray(base.allowedModelIds)
    ? base.allowedModelIds
    : [];

  const requiresStructuredRaw =
    typeof rootPrefs.requiresStructuredOutput === "boolean"
      ? rootPrefs.requiresStructuredOutput
      : typeof oldPolicy.requiresStructuredOutput === "boolean"
      ? oldPolicy.requiresStructuredOutput
      : typeof behavior.requiresStructuredOutput === "boolean"
      ? behavior.requiresStructuredOutput
      : typeof base.requiresStructuredOutput === "boolean"
      ? base.requiresStructuredOutput
      : null;

  const capsRaw = Array.isArray(rootPrefs.requiredCapabilities)
    ? rootPrefs.requiredCapabilities
    : Array.isArray(oldPolicy.requiredCapabilities)
    ? oldPolicy.requiredCapabilities
    : Array.isArray(behavior.requiredCapabilities)
    ? behavior.requiredCapabilities
    : Array.isArray(base.requiredCapabilities)
    ? base.requiredCapabilities
    : [];

  const requiredCapabilities = capsRaw
    .filter((c): c is AgentSelectableCapability =>
      typeof c === "string" ? (AGENT_SELECTABLE_CAPABILITIES as readonly string[]).includes(c) : false
    );

  const fallbackRaw =
    typeof rootPrefs.fallbackBehavior === "string"
      ? rootPrefs.fallbackBehavior
      : typeof oldPolicy.fallbackBehavior === "string"
      ? oldPolicy.fallbackBehavior
      : typeof behavior.fallbackBehavior === "string"
      ? behavior.fallbackBehavior
      : undefined;

  const notesRaw =
    typeof rootPrefs.notes === "string"
      ? rootPrefs.notes
      : typeof oldPolicy.notes === "string"
      ? oldPolicy.notes
      : typeof behavior.notes === "string"
      ? behavior.notes
      : undefined;

  const out: Partial<AgentModelPreferences> = {
    preferredModelId: preferredRaw?.trim() || null,
    allowedModelIds: allowedRaw
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
    requiresStructuredOutput: requiresStructuredRaw,
    requiredCapabilities,
  };

  if (
    fallbackRaw &&
    (modelPreferenceFallbackBehaviorValues as readonly string[]).includes(fallbackRaw)
  ) {
    out.fallbackBehavior = fallbackRaw as ModelPreferenceFallbackBehavior;
  }
  if (notesRaw !== undefined) {
    out.notes = notesRaw;
  }

  return out;
}

export function effectiveRequiresStructuredOutput(
  prefs: AgentModelPreferences,
  outputFormat: string
): boolean {
  if (prefs.requiresStructuredOutput !== null && prefs.requiresStructuredOutput !== undefined) {
    return prefs.requiresStructuredOutput;
  }
  return outputFormat !== "markdown";
}

export function missingRequiredCapabilities(
  modelCapabilities: readonly string[],
  required: readonly AgentSelectableCapability[]
): AgentSelectableCapability[] {
  const set = new Set(modelCapabilities);
  return required.filter((c) => !set.has(c));
}
