import type { ModelProvider } from "@/lib/models";

export type ModelPricing = {
  inputPer1M?: number | null;
  outputPer1M?: number | null;
  cachedInputPer1M?: number | null;
  currency: "USD";
  pricingMode: "standard" | "batch" | "flex" | "priority" | "custom";
};

/**
 * USD per 1M tokens (input / cached input / output).
 *
 * OpenAI registry rows are sourced from the official OpenAI API pricing page:
 * https://developers.openai.com/api/docs/pricing
 * Verified: 2026-06-08
 *
 * OpenAI GPT-5.5 and GPT-5.4 use the Standard tier for context under 270K tokens,
 * which matches normal chat usage in this workspace.
 *
 * Groq and Gemini entries are not from the OpenAI page; they remain provider/internal
 * estimates unless separately verified.
 */
const PRICING_BY_REGISTRY_ID: Record<string, ModelPricing> = {
  "openai-gpt-4.1": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 2.0,
    outputPer1M: 8.0,
    cachedInputPer1M: 0.5,
  },
  "openai-gpt-5.5": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 5.0,
    outputPer1M: 30.0,
    cachedInputPer1M: 0.5,
  },
  "openai-gpt-5.4": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 2.5,
    outputPer1M: 15.0,
    cachedInputPer1M: 0.25,
  },
  "openai-gpt-4o-mini": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  "openai-gpt-5.4-mini": {
    currency: "USD",
    pricingMode: "standard",
    inputPer1M: 0.75,
    outputPer1M: 4.5,
    cachedInputPer1M: 0.075,
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
