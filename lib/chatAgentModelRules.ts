/**
 * Chat-side model ↔ agent rules: compatibility issues (client) and send-time validation (server).
 * - Client: `computeModelCompatibilityIssues` — input `models` must be `GET /api/models` (governed); suggestions via
 *   {@link pickFirstCompatibleGovernedModel}.
 * - Server: `validateSendTimeModelPreferences` — same prefs, resolved registry model after governance checks on the route.
 * Precedence: `agentModelGovernance.ts`; field shapes: `agentModelPolicy.ts`.
 */
import { pickFirstCompatibleGovernedModel } from "@/lib/agentModelGovernance";
import {
  effectiveRequiresStructuredOutput,
  missingRequiredCapabilities,
  type AgentModelPreferences,
  type AgentSelectableCapability,
  type ModelPreferenceFallbackBehavior,
} from "@/lib/agentModelPolicy";
import { MODEL_CAPABILITY_LABELS } from "@/lib/modelUiLabels";
import type { UiAgent, UiModelSummary } from "@/lib/types";

/** ~4 chars per token — keep aligned with send route and composer heuristics. */
export const CHAT_EST_CHARS_PER_TOKEN = 4;

export function estTokensFromChars(chars: number): number {
  return Math.ceil(Math.max(0, chars) / CHAT_EST_CHARS_PER_TOKEN);
}

export type ChatCompatibilityIssue = {
  id: string;
  severity: "warning" | "blocking";
  message: string;
  suggestedModelId?: string;
  suggestedModelName?: string;
};

/**
 * Whether a missing **required** capability should block send.
 * `long_context` is soft unless fallbackBehavior is `block` (per product rules).
 */
export function shouldBlockMissingRequiredCapability(
  cap: AgentSelectableCapability,
  fallbackBehavior: ModelPreferenceFallbackBehavior
): boolean {
  if (cap === "long_context") {
    return fallbackBehavior === "block";
  }
  return true;
}

/** Effective structured-output need: use API-computed flag when present; else infer from output format. */
export function effectiveAgentRequiresStructuredCapability(agent: UiAgent | undefined): boolean {
  if (!agent) return false;
  if (agent.requiresStructuredOutput !== undefined && agent.requiresStructuredOutput !== null) {
    return Boolean(agent.requiresStructuredOutput);
  }
  return (agent.outputFormat ?? "markdown") !== "markdown";
}

type CompatibilityComputeInput = {
  /** Governed list from GET /api/models for the current user (role + budget + env). */
  models: UiModelSummary[];
  selectedModelId: string;
  activeAgent?: UiAgent;
  imageAttachmentCount: number;
  textCharLength: number;
};

/**
 * Shared chat compatibility rules (client). Mirrors send-time validation in {@link validateSendTimeModelPreferences}.
 * Uses flattened `UiAgent` fields from GET /api/agents (derived from normalized `modelPreferences`).
 * Suggestions use {@link pickFirstCompatibleGovernedModel} so they never reference models outside the governed list.
 */
export function computeModelCompatibilityIssues(input: CompatibilityComputeInput): ChatCompatibilityIssue[] {
  const { models, selectedModelId, activeAgent, imageAttachmentCount, textCharLength } = input;
  const selected = models.find((m) => m.id === selectedModelId);
  if (!selected) return [];

  const issues: ChatCompatibilityIssue[] = [];
  const fallback = activeAgent?.modelPreferenceFallbackBehavior ?? "suggest_compatible";

  const allowedIds = activeAgent?.allowedModelIds;
  const allowedSet =
    allowedIds && allowedIds.length > 0 ? new Set(allowedIds) : null;

  const inAllowlist = (m: Pick<UiModelSummary, "id">) => !allowedSet || allowedSet.has(m.id);

  const pickSuggestedGoverned = (predicate: (m: UiModelSummary) => boolean) =>
    pickFirstCompatibleGovernedModel(models, { allowedModelIds: allowedIds, predicate });

  if (allowedSet && !allowedSet.has(selected.id)) {
    const suggested = pickSuggestedGoverned((m) => allowedSet.has(m.id));
    issues.push({
      id: "agent-allowlist",
      severity: "blocking",
      message: `${activeAgent?.name ?? "This agent"} only allows specific models.`,
      suggestedModelId: suggested?.id,
      suggestedModelName: suggested?.displayName,
    });
  }

  if (imageAttachmentCount > 0 && !selected.capabilities.includes("vision")) {
    const suggested = pickSuggestedGoverned((m) => m.capabilities.includes("vision"));
    issues.push({
      id: "vision-required",
      severity: "blocking",
      message: "Attached images require a model with Vision support.",
      suggestedModelId: suggested?.id,
      suggestedModelName: suggested?.displayName,
    });
  }

  if (effectiveAgentRequiresStructuredCapability(activeAgent) && !selected.capabilities.includes("structured_output")) {
    const suggested = pickSuggestedGoverned((m) => m.capabilities.includes("structured_output"));
    issues.push({
      id: "structured-required",
      severity: "blocking",
      message: `${activeAgent?.name ?? "This agent"} requires structured output — pick a model that supports JSON / structured responses.`,
      suggestedModelId: suggested?.id,
      suggestedModelName: suggested?.displayName,
    });
  }

  const requiredCaps = activeAgent?.requiredCapabilities ?? [];
  for (const cap of requiredCaps) {
    if (cap === "structured_output" && effectiveAgentRequiresStructuredCapability(activeAgent)) {
      continue;
    }
    if (selected.capabilities.includes(cap)) continue;

    const suggested = pickSuggestedGoverned((m) => m.capabilities.includes(cap));
    const label = MODEL_CAPABILITY_LABELS[cap] ?? cap;
    const blocking = shouldBlockMissingRequiredCapability(cap, fallback);
    issues.push({
      id: `agent-required-cap-${cap}`,
      severity: blocking ? "blocking" : "warning",
      message: `${activeAgent?.name ?? "This agent"} requires ${label} for this configuration.`,
      suggestedModelId: suggested?.id,
      suggestedModelName: suggested?.displayName,
    });
  }

  const est = estTokensFromChars(textCharLength);
  if (
    selected.contextWindow > 0 &&
    est > selected.contextWindow * 0.88 &&
    !selected.capabilities.includes("long_context")
  ) {
    const suggested = pickSuggestedGoverned(
      (m) => m.capabilities.includes("long_context") && m.contextWindow >= selected.contextWindow
    );
    const blocking = fallback === "block";
    issues.push({
      id: "long-context-heuristic",
      severity: blocking ? "blocking" : "warning",
      message: blocking
        ? `Input may exceed what ${selected.displayName} can handle without a long-context model — pick a long-context model or shorten the prompt.`
        : `This input may be large relative to ${selected.displayName} (no long-context flag). Use a long-context model if you hit truncation.`,
      suggestedModelId: suggested?.id,
      suggestedModelName: suggested?.displayName,
    });
  }

  if (activeAgent?.preferredModelId && activeAgent.preferredModelId !== selected.id) {
    const preferred = models.find((m) => m.id === activeAgent.preferredModelId);
    if (preferred && preferred.enabled && inAllowlist(preferred)) {
      issues.push({
        id: "agent-preferred",
        severity: "warning",
        message: `${activeAgent.name} works best with ${preferred.displayName}.`,
        suggestedModelId: preferred.id,
        suggestedModelName: preferred.displayName,
      });
    } else {
      issues.push({
        id: "preferred-unavailable",
        severity: "warning",
        message: `${activeAgent.name} has a preferred model that is not available for your role, budget, or runtime.`,
      });
    }
  }

  return issues;
}

type ModelCaps = { id: string; displayName: string; capabilities: readonly string[] };

/**
 * Send-time validation of prefs vs the **resolved registry model** for this request.
 * Preconditions: governance already passed on the route; `selectedModel` from `resolveModelById`; prefs from
 * `normalizeAgentInputSchema`. Does not re-check role/budget — that is the send handler’s responsibility.
 */
export function validateSendTimeModelPreferences(args: {
  modelPreferences: AgentModelPreferences;
  outputFormat: string;
  selectedModel: ModelCaps;
  agentName: string;
}): void {
  const { modelPreferences: mp, outputFormat, selectedModel, agentName } = args;

  if (mp.allowedModelIds.length > 0 && !mp.allowedModelIds.includes(selectedModel.id)) {
    throw new Error(`${agentName} does not allow ${selectedModel.displayName}.`);
  }

  const requiresStructuredOutput = effectiveRequiresStructuredOutput(mp, outputFormat);
  if (requiresStructuredOutput && !selectedModel.capabilities.includes("structured_output")) {
    throw new Error(
      `${selectedModel.displayName} has weak structured output support for ${agentName}.`
    );
  }

  const missing = missingRequiredCapabilities(selectedModel.capabilities, mp.requiredCapabilities);
  const blockingMissing = missing.filter((c) => shouldBlockMissingRequiredCapability(c, mp.fallbackBehavior));
  if (blockingMissing.length > 0) {
    throw new Error(
      `${agentName} requires capabilities the selected model does not provide (${blockingMissing.join(", ")}).`
    );
  }
}
