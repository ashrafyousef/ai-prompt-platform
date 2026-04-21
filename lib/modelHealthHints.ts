import type { ModelProvider } from "@/lib/models";

export type UiModelHealthAdvisory = {
  status: "recently_rate_limited";
  scope: "model" | "provider";
  observedAt: string;
  ttlSeconds: number;
  message: string;
};

const RATE_LIMIT_TTL_MS = 5 * 60 * 1000;
const modelRateLimitAt = new Map<string, number>();
const providerRateLimitAt = new Map<ModelProvider, number>();

function nowMs() {
  return Date.now();
}

function isFresh(ts: number, ttlMs: number) {
  return nowMs() - ts <= ttlMs;
}

function pruneExpired() {
  modelRateLimitAt.forEach((ts, modelId) => {
    if (!isFresh(ts, RATE_LIMIT_TTL_MS)) modelRateLimitAt.delete(modelId);
  });
  providerRateLimitAt.forEach((ts, provider) => {
    if (!isFresh(ts, RATE_LIMIT_TTL_MS)) providerRateLimitAt.delete(provider);
  });
}

function providerLabel(provider: ModelProvider) {
  if (provider === "openai") return "OpenAI";
  if (provider === "groq") return "Groq";
  return "Provider";
}

/** Best-effort in-memory marker for recent provider/model throttling. */
export function markRecentRateLimit(params: { modelId?: string | null; provider?: ModelProvider | null }) {
  pruneExpired();
  const ts = nowMs();
  if (params.modelId) modelRateLimitAt.set(params.modelId, ts);
  if (params.provider) providerRateLimitAt.set(params.provider, ts);
}

/**
 * Returns a short-lived advisory if this model or provider was recently rate-limited.
 * Advisory only: does not block selection or send behavior.
 */
export function getRecentRateLimitAdvisory(params: {
  modelId: string;
  provider: ModelProvider;
}): UiModelHealthAdvisory | null {
  pruneExpired();

  const modelTs = modelRateLimitAt.get(params.modelId);
  if (modelTs && isFresh(modelTs, RATE_LIMIT_TTL_MS)) {
    return {
      status: "recently_rate_limited",
      scope: "model",
      observedAt: new Date(modelTs).toISOString(),
      ttlSeconds: Math.floor(RATE_LIMIT_TTL_MS / 1000),
      message: "Recently rate-limited. May be temporarily throttled.",
    };
  }

  const providerTs = providerRateLimitAt.get(params.provider);
  if (providerTs && isFresh(providerTs, RATE_LIMIT_TTL_MS)) {
    return {
      status: "recently_rate_limited",
      scope: "provider",
      observedAt: new Date(providerTs).toISOString(),
      ttlSeconds: Math.floor(RATE_LIMIT_TTL_MS / 1000),
      message: `${providerLabel(params.provider)} recently rate-limited. May be temporarily throttled.`,
    };
  }

  return null;
}
