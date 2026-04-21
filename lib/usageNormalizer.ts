import type { ModelProvider } from "@/lib/models";

export type NormalizedUsage = {
  provider: "openai" | "groq" | "other";
  modelId: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  cachedInputTokens?: number | null;
  reasoningTokens?: number | null;
  exact: boolean;
  estimationMethod?: "char_div_4" | "none";
  source: "provider_usage" | "stream_final_chunk" | "response_usage" | "estimated";
};

export type ProviderUsagePayload = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_tokens_details?: { cached_tokens?: number };
  completion_tokens_details?: { reasoning_tokens?: number };
};

export function normalizeUsageFromProvider(params: {
  registryModelId: string;
  provider: ModelProvider;
  usage: ProviderUsagePayload | null | undefined;
  source: NormalizedUsage["source"];
}): NormalizedUsage | null {
  const u = params.usage;
  if (!u || (u.prompt_tokens == null && u.completion_tokens == null && u.total_tokens == null)) {
    return null;
  }
  const cached =
    u.prompt_tokens_details?.cached_tokens != null ? u.prompt_tokens_details.cached_tokens : null;
  const reasoning = u.completion_tokens_details?.reasoning_tokens ?? null;
  const total =
    u.total_tokens != null
      ? u.total_tokens
      : (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0);

  return {
    provider: params.provider === "groq" ? "groq" : params.provider === "openai" ? "openai" : "other",
    modelId: params.registryModelId,
    promptTokens: u.prompt_tokens ?? null,
    completionTokens: u.completion_tokens ?? null,
    totalTokens: total,
    cachedInputTokens: cached,
    reasoningTokens: reasoning,
    exact: true,
    estimationMethod: "none",
    source: params.source,
  };
}

export function completionResultToNormalized(
  raw: ProviderUsagePayload | null,
  registryModelId: string,
  provider: ModelProvider,
  promptCharLen: number,
  completionCharLen: number
): NormalizedUsage {
  const n = normalizeUsageFromProvider({
    registryModelId,
    provider,
    usage: raw,
    source: "response_usage",
  });
  if (n) return n;
  return estimateUsageFallback({
    registryModelId,
    provider,
    promptCharLength: promptCharLen,
    completionCharLength: completionCharLen,
  });
}

export function estimateUsageFallback(params: {
  registryModelId: string;
  provider: ModelProvider;
  promptCharLength: number;
  completionCharLength: number;
}): NormalizedUsage {
  const promptTokens = Math.ceil(Math.max(0, params.promptCharLength) / 4);
  const completionTokens = Math.ceil(Math.max(0, params.completionCharLength) / 4);
  return {
    provider: params.provider === "groq" ? "groq" : params.provider === "openai" ? "openai" : "other",
    modelId: params.registryModelId,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    exact: false,
    estimationMethod: "char_div_4",
    source: "estimated",
  };
}
