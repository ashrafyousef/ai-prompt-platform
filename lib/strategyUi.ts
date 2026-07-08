import type { StrategyFieldKey, StrategyFields } from "@/lib/strategyDocument";

/** Fields prefilled from the approved brief at strategy creation (Phase 2G.0 spec). */
export const STRATEGY_PREFILLED_FIELD_KEYS = [
  "objectiveInterpretation",
  "brandComplianceGuardrails",
  "timelineFeasibilityNotes",
  "openStrategicQuestions",
] as const satisfies readonly StrategyFieldKey[];

export const STRATEGY_NOT_PROVIDED = "Not provided";

export const STRATEGY_PREFILLED_BADGE_LABEL = "Prefilled from approved brief";

export const STRATEGY_MARK_READY_CONFIRM_MESSAGE =
  "Mark this strategy as Ready for Creative?\n\nAfter this step, the strategy will be locked and can no longer be edited in this version.";

export function isStrategyPrefilledField(key: StrategyFieldKey): boolean {
  return (STRATEGY_PREFILLED_FIELD_KEYS as readonly string[]).includes(key);
}

export function areStrategyFieldsDirty(saved: StrategyFields, current: StrategyFields): boolean {
  for (const key of Object.keys(saved) as StrategyFieldKey[]) {
    if (saved[key] !== current[key]) return true;
  }
  return false;
}

export function formatStrategyReadOnlyValue(value: string): string {
  return value.trim().length > 0 ? value : STRATEGY_NOT_PROVIDED;
}
