/**
 * Policy/scoring router over **governed** models only. Call after `getGovernedModelsForUser`.
 */
import { effectiveRequiresStructuredOutput } from "@/lib/agentModelPolicy";
import type { AgentModelPreferences } from "@/lib/agentModelPolicy";
import type { ModelOption } from "@/lib/models";
import type { UiModelSummary } from "@/lib/types";
import type {
  BudgetPressure,
  ModelRouterInput,
  RoutedModelDecision,
  RouterMode,
  TaskClass,
} from "@/lib/modelRoutingTypes";

function classifyTask(
  textLength: number,
  prefs: AgentModelPreferences,
  needsLongContextHeuristic: boolean
): TaskClass {
  if (prefs.requiredCapabilities.includes("best_quality")) return "premium";
  if (textLength > 12_000 || needsLongContextHeuristic) return "complex";
  if (textLength < 400 && prefs.requiredCapabilities.length === 0) return "simple";
  return "standard";
}

function allowlistSet(mp: AgentModelPreferences): Set<string> | null {
  if (mp.allowedModelIds.length === 0) return null;
  return new Set(mp.allowedModelIds);
}

export function modelMeetsAgentConstraints(
  m: UiModelSummary,
  mp: AgentModelPreferences,
  needsVision: boolean,
  needsStructured: boolean,
  needsLongContextHeuristic: boolean
): boolean {
  if (!m.enabled) return false;
  for (const cap of mp.requiredCapabilities) {
    if (!m.capabilities.includes(cap)) return false;
  }
  if (needsVision && !m.capabilities.includes("vision")) return false;
  if (needsStructured && !m.capabilities.includes("structured_output")) return false;
  if (needsLongContextHeuristic && !m.capabilities.includes("long_context")) return false;
  const allow = allowlistSet(mp);
  if (allow && !allow.has(m.id)) return false;
  return true;
}

function scoreModel(
  m: UiModelSummary,
  taskClass: TaskClass,
  mp: AgentModelPreferences,
  budgetPressure: BudgetPressure
): number {
  let s = 0;
  if (mp.preferredModelId === m.id) s += 120;

  if (budgetPressure === "warning" && m.costTier === "low") s += 80;
  if (budgetPressure === "warning" && m.costTier === "medium") s += 40;

  if (taskClass === "simple") {
    if (m.capabilities.includes("fast")) s += 40;
    if (m.costTier === "low") s += 25;
  }
  if (taskClass === "standard") {
    if (m.capabilities.includes("fast")) s += 20;
    s += m.costTier === "medium" ? 15 : m.costTier === "low" ? 10 : 5;
  }
  if (taskClass === "complex" || taskClass === "premium") {
    if (m.capabilities.includes("best_quality")) s += 55;
    if (m.capabilities.includes("long_context")) s += 35;
    if (m.costTier === "high") s += 30;
  }

  if (m.preferredFor?.includes("default")) s += 8;
  return s;
}

function pickOrderedCandidates(
  governedModels: readonly UiModelSummary[],
  mp: AgentModelPreferences,
  needsVision: boolean,
  needsStructured: boolean,
  needsLongContextHeuristic: boolean,
  taskClass: TaskClass,
  budgetPressure: BudgetPressure
): UiModelSummary[] {
  let list = governedModels.filter((m) =>
    modelMeetsAgentConstraints(m, mp, needsVision, needsStructured, needsLongContextHeuristic)
  );

  if (budgetPressure === "warning") {
    const lows = list.filter((m) => m.costTier === "low");
    if (lows.length > 0) list = lows;
  }

  return [...list].sort(
    (a, b) =>
      scoreModel(b, taskClass, mp, budgetPressure) - scoreModel(a, taskClass, mp, budgetPressure)
  );
}

function emptyDecision(
  mode: RouterMode,
  taskClass: TaskClass,
  reasonCodes: string[],
  blockReason?: string
): RoutedModelDecision {
  return {
    mode,
    selectedModelId: null,
    suggestedModelId: null,
    fallbackModelIds: [],
    reasonCodes,
    taskClass,
    estimatedCostTier: "low",
    blocked: true,
    blockReason,
  };
}

/** Map registry rows from `getGovernedModelsForUser` to UI-shaped rows for scoring. */
export function governedOptionsToUiSummaries(models: readonly ModelOption[]): UiModelSummary[] {
  return models.map((m) => ({
    id: m.id,
    displayName: m.displayName,
    provider: m.provider,
    shortDescription: m.shortDescription,
    capabilities: m.capabilities,
    costTier: m.costTier,
    allowedRoles: m.allowedRoles,
    enabled: m.enabled,
    preferredFor: m.preferredFor ?? [],
    listSection: m.listSection,
    disabledReason: m.disabledReason ?? null,
    contextWindow: m.contextWindow,
    visionCapable: m.capabilities.includes("vision"),
  }));
}

export function routeModel(input: ModelRouterInput): RoutedModelDecision {
  const mp = input.modelPreferences;
  const needsStructured =
    input.needsStructuredOutput ||
    effectiveRequiresStructuredOutput(mp, input.outputFormat);
  const taskClass = classifyTask(input.textLength, mp, input.needsLongContextHeuristic);

  const ordered = pickOrderedCandidates(
    input.governedModels,
    mp,
    input.needsVision,
    needsStructured,
    input.needsLongContextHeuristic,
    taskClass,
    input.budgetPressure
  );

  const fallbackModelIds = ordered.slice(0, 3).map((m) => m.id);
  const top = ordered[0];

  const mode = input.routingMode;

  if (ordered.length === 0) {
    return emptyDecision(mode, taskClass, ["NO_COMPATIBLE_MODEL"], "No model satisfies this agent and request.");
  }

  if (mode === "manual") {
    const uid = input.userSelectedModelId?.trim() || null;
    if (!uid) {
      return emptyDecision("manual", taskClass, ["USER_SELECTION_MISSING"], "Select a model.");
    }
    const picked = input.governedModels.find((m) => m.id === uid);
    if (!picked || !picked.enabled) {
      return emptyDecision("manual", taskClass, ["USER_SELECTION_BLOCKED_BY_GOVERNANCE"], "That model is not available.");
    }
    if (
      !modelMeetsAgentConstraints(
        picked,
        mp,
        input.needsVision,
        needsStructured,
        input.needsLongContextHeuristic
      )
    ) {
      return emptyDecision(
        "manual",
        taskClass,
        ["NO_COMPATIBLE_MODEL"],
        "Selected model does not meet this agent’s requirements."
      );
    }
    const codes = ["USER_SELECTION_VALID"];
    if (mp.preferredModelId === picked.id) codes.push("AGENT_PREFERRED_MODEL_APPLIED");
    return {
      mode: "manual",
      selectedModelId: picked.id,
      suggestedModelId: null,
      fallbackModelIds: fallbackModelIds.filter((id) => id !== picked.id),
      reasonCodes: codes,
      taskClass,
      estimatedCostTier: picked.costTier,
      blocked: false,
    };
  }

  if (mode === "auto") {
    if (!top) return emptyDecision("auto", taskClass, ["NO_COMPATIBLE_MODEL"]);
    const codes: string[] = ["FALLBACK_SELECTED", "AUTO_ROUTED"];
    if (mp.preferredModelId === top.id) codes.push("AGENT_PREFERRED_MODEL_APPLIED");
    if (input.budgetPressure === "warning" && top.costTier === "low") codes.push("BUDGET_DOWNGRADED_TO_CHEAPER_MODEL");
    if (input.needsVision) codes.push("VISION_REQUIRED");
    if (needsStructured) codes.push("STRUCTURED_OUTPUT_REQUIRED");
    return {
      mode: "auto",
      selectedModelId: top.id,
      suggestedModelId: null,
      fallbackModelIds: fallbackModelIds.slice(1),
      reasonCodes: codes,
      taskClass,
      estimatedCostTier: top.costTier,
      blocked: false,
    };
  }

  // suggested
  const uid = input.userSelectedModelId?.trim() || null;
  const userPick = uid ? input.governedModels.find((m) => m.id === uid) : undefined;
  const userOk =
    userPick &&
    userPick.enabled &&
    modelMeetsAgentConstraints(
      userPick,
      mp,
      input.needsVision,
      needsStructured,
      input.needsLongContextHeuristic
    );

  if (userOk) {
    return {
      mode: "suggested",
      selectedModelId: userPick.id,
      suggestedModelId: top?.id ?? userPick.id,
      fallbackModelIds,
      reasonCodes: ["USER_SELECTION_VALID", "SUGGESTION_AVAILABLE"],
      taskClass,
      estimatedCostTier: userPick.costTier,
      blocked: false,
    };
  }

  if (!top) return emptyDecision("suggested", taskClass, ["NO_COMPATIBLE_MODEL"]);
  return {
    mode: "suggested",
    selectedModelId: top.id,
    suggestedModelId: top.id,
    fallbackModelIds: fallbackModelIds.slice(1),
    reasonCodes: ["FALLBACK_SELECTED", "SUGGESTED_DEFAULT"],
    taskClass,
    estimatedCostTier: top.costTier,
    blocked: false,
  };
}
