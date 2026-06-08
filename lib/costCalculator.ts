import type { ModelPricing } from "@/lib/pricing";
import type { NormalizedUsage } from "@/lib/usageNormalizer";

export type CalculatedCost = {
  inputCost: number;
  outputCost: number;
  cachedInputCost: number;
  totalCost: number;
  exact: boolean;
  notes: string[];
};

export function calculateCost(
  usage: NormalizedUsage,
  pricing: ModelPricing | null
): CalculatedCost {
  const notes: string[] = [];
  if (pricing?.inputPer1M == null || pricing?.outputPer1M == null) {
    notes.push("Missing per-1M pricing for model — costs set to 0.");
    return {
      inputCost: 0,
      outputCost: 0,
      cachedInputCost: 0,
      totalCost: 0,
      exact: usage.exact,
      notes,
    };
  }

  const promptTokens = usage.promptTokens ?? 0;
  const completionTokens = usage.completionTokens ?? 0;
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const nonCachedInputTokens = Math.max(promptTokens - cachedInputTokens, 0);

  const inputCost = (nonCachedInputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  const cachedInputPer1M =
    pricing.cachedInputPer1M != null ? pricing.cachedInputPer1M : pricing.inputPer1M;
  const cachedInputCost = (cachedInputTokens / 1_000_000) * cachedInputPer1M;

  if (!usage.exact) {
    notes.push("Token counts estimated (char/4) — cost is approximate.");
  }

  return {
    inputCost,
    outputCost,
    cachedInputCost,
    totalCost: inputCost + outputCost + cachedInputCost,
    exact: usage.exact,
    notes,
  };
}
