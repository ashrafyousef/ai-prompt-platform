import type { ModelProvider } from "@/lib/models";

export type ModelPricing = {
  inputPer1M?: number | null;
  outputPer1M?: number | null;
  cachedInputPer1M?: number | null;
  currency: "USD";
  pricingMode: "standard" | "batch" | "flex" | "priority" | "custom";
};

/** Illustrative USD per 1M tokens — override via env or extend as needed. */
const PRICING_BY_REGISTRY_ID: Record<string, ModelPricing> = {
  "openai-gpt-4.1": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 2.0,
    outputPer1M: 8.0,
    cachedInputPer1M: 0.5,
  },
  "openai-gpt-4o-mini": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  "groq-llama-8b": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.05,
    outputPer1M: 0.08,
  },
  "groq-llama-70b": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.59,
    outputPer1M: 0.79,
  },
  "groq-llama-vision": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.59,
    outputPer1M: 0.79,
  },
  "gemini-2.5-pro": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 1.25,
    outputPer1M: 10.0,
  },
};

export function getPricingForRegistryModelId(registryModelId: string): ModelPricing | null {
  return PRICING_BY_REGISTRY_ID[registryModelId] ?? null;
}

export function defaultPricingForProvider(provider: ModelProvider): ModelPricing {
  return {
    currency: "USD",
    pricingMode: "custom",
    inputPer1M: null,
    outputPer1M: null,
  };
}
