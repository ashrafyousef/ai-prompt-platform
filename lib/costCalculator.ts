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
  if (!pricing?.inputPer1M || !pricing?.outputPer1M) {
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

  const pt = usage.promptTokens ?? 0;
  const ct = usage.completionTokens ?? 0;
  const cached = usage.cachedInputTokens ?? 0;

  const inputCost = (pt / 1_000_000) * pricing.inputPer1M;
  const outputCost = (ct / 1_000_000) * pricing.outputPer1M;
  const cachedInputPer1M = pricing.cachedInputPer1M ?? pricing.inputPer1M;
  const cachedInputCost = (cached / 1_000_000) * cachedInputPer1M;

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
