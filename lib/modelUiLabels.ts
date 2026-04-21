import type { UiModelCapability, UiModelSummary } from "@/lib/types";

/** Short labels for model capability chips (composer, context drawer, etc.). */
export const MODEL_CAPABILITY_LABELS: Record<UiModelCapability, string> = {
  text: "Text",
  vision: "Vision",
  fast: "Fast",
  best_quality: "Best quality",
  long_context: "Long context",
  structured_output: "JSON / structured output",
};

/** Capabilities shown as chips — omit ubiquitous `text` to reduce noise. */
export const MODEL_CAPABILITY_CHIP_SET = new Set<UiModelCapability>([
  "vision",
  "fast",
  "best_quality",
  "long_context",
  "structured_output",
]);

export const PROVIDER_DISPLAY: Record<UiModelSummary["provider"], string> = {
  openai: "OpenAI",
  groq: "Groq",
  gemini: "Google Gemini",
};

export const COST_TIER_DISPLAY: Record<UiModelSummary["costTier"], string> = {
  low: "Lower cost",
  medium: "Mid cost",
  high: "Premium",
};
