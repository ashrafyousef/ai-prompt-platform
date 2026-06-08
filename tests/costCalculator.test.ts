import { describe, expect, it } from "vitest";
import { calculateCost } from "@/lib/costCalculator";
import type { ModelPricing } from "@/lib/pricing";
import type { NormalizedUsage } from "@/lib/usageNormalizer";

const baseUsage: NormalizedUsage = {
  provider: "openai",
  modelId: "openai-gpt-5.4",
  promptTokens: 1_000_000,
  completionTokens: 500_000,
  totalTokens: 1_500_000,
  exact: true,
  source: "provider_usage",
};

const standardPricing: ModelPricing = {
  currency: "USD",
  pricingMode: "standard",
  inputPer1M: 2.5,
  outputPer1M: 15.0,
  cachedInputPer1M: 0.25,
};

describe("calculateCost", () => {
  it("computes ordinary input and output cost", () => {
    const result = calculateCost(baseUsage, standardPricing);

    expect(result.inputCost).toBe(2.5);
    expect(result.outputCost).toBe(7.5);
    expect(result.cachedInputCost).toBe(0);
    expect(result.totalCost).toBe(10);
    expect(result.exact).toBe(true);
    expect(result.notes).toEqual([]);
  });

  it("charges cached tokens at the cached rate and does not charge them twice", () => {
    const usage: NormalizedUsage = {
      ...baseUsage,
      promptTokens: 1_000_000,
      cachedInputTokens: 400_000,
    };

    const result = calculateCost(usage, standardPricing);

    // nonCachedInputTokens = max(1_000_000 - 400_000, 0) = 600_000
    expect(result.inputCost).toBeCloseTo(1.5);
    expect(result.cachedInputCost).toBeCloseTo(0.1);
    expect(result.outputCost).toBe(7.5);
    expect(result.totalCost).toBeCloseTo(9.1);
  });

  it("falls back to input rate when cached rate is absent", () => {
    const pricingWithoutCached: ModelPricing = {
      currency: "USD",
      pricingMode: "standard",
      inputPer1M: 1.0,
      outputPer1M: 2.0,
      cachedInputPer1M: null,
    };
    const usage: NormalizedUsage = {
      ...baseUsage,
      promptTokens: 200_000,
      completionTokens: 0,
      cachedInputTokens: 50_000,
    };

    const result = calculateCost(usage, pricingWithoutCached);

    expect(result.inputCost).toBeCloseTo(0.15);
    expect(result.cachedInputCost).toBeCloseTo(0.05);
    expect(result.totalCost).toBeCloseTo(0.2);
  });

  it("returns zero cost with a warning when pricing is missing", () => {
    const result = calculateCost(baseUsage, null);

    expect(result.inputCost).toBe(0);
    expect(result.outputCost).toBe(0);
    expect(result.cachedInputCost).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.notes).toContain("Missing per-1M pricing for model — costs set to 0.");
  });

  it("keeps approximate-cost notes for estimated usage", () => {
    const estimatedUsage: NormalizedUsage = {
      ...baseUsage,
      exact: false,
      estimationMethod: "char_div_4",
      source: "estimated",
    };

    const result = calculateCost(estimatedUsage, standardPricing);

    expect(result.exact).toBe(false);
    expect(result.notes).toContain("Token counts estimated (char/4) — cost is approximate.");
  });
});
