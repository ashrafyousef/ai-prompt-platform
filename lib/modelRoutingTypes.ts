import type { UserRole } from "@/lib/models";
import type { UiModelSummary } from "@/lib/types";
import type { AgentModelPreferences } from "@/lib/agentModelPolicy";

export type RouterMode = "manual" | "auto" | "suggested";

export type TaskClass = "simple" | "standard" | "complex" | "premium";

export type BudgetPressure = "ok" | "warning" | "blocked";

export type RoutedModelDecision = {
  mode: RouterMode;
  selectedModelId: string | null;
  suggestedModelId: string | null;
  fallbackModelIds: string[];
  reasonCodes: string[];
  taskClass: TaskClass;
  estimatedCostTier: "low" | "medium" | "high";
  blocked: boolean;
  blockReason?: string;
};

/** Inputs after governance: only models the user may see this session. */
export type ModelRouterInput = {
  routingMode: RouterMode;
  /** User’s picker (registry id); may be empty for auto. */
  userSelectedModelId: string | null;
  governedModels: readonly UiModelSummary[];
  modelPreferences: AgentModelPreferences;
  outputFormat: string;
  userRole: UserRole;
  budgetPressure: BudgetPressure;
  textLength: number;
  needsVision: boolean;
  needsStructuredOutput: boolean;
  /** Heuristic: long user message may need long_context models. */
  needsLongContextHeuristic: boolean;
};
