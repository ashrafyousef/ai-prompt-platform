/**
 * LLM transport — **server-only**. Fetch-based OpenAI-compatible API (no official SDK).
 * Governance is enforced in routes before calling these functions.
 * Streaming: OpenAI requests `stream_options.include_usage`; usage is merged into {@link StreamUsageSink};
 * Groq/other providers fall back to char/4 estimates when no usage object is present.
 */
import { ChatMessage } from "@/lib/orchestration/buildMessages";
import type { ModelProvider } from "@/lib/models";
import { resolveModelById } from "@/lib/models";
import type { ProviderUsagePayload } from "@/lib/usageNormalizer";
import { estimateUsageFallback, normalizeUsageFromProvider } from "@/lib/usageNormalizer";
import type { NormalizedUsage } from "@/lib/usageNormalizer";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

const LEGACY_MODEL_MAP: Record<string, string> = {
  "v1.0": "groq-llama-8b",
  "v2.0": "groq-llama-70b",
};

export type ResolvedProvider = {
  apiUrl: string;
  apiKey: string;
  defaultModel: string;
  provider: ModelProvider;
  /** Registry id when resolved from curated list. */
  registryModelId: string | null;
};

export function resolveModelName(modelVersion?: string): string {
  return resolveProvider(modelVersion).defaultModel;
}

function resolveProvider(modelVersion?: string): ResolvedProvider {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  const registryId = (modelVersion && LEGACY_MODEL_MAP[modelVersion]) ?? modelVersion;
  const resolved = registryId ? resolveModelById(registryId) : undefined;

  if (resolved && (resolved.provider === "groq" || resolved.provider === "openai")) {
    const apiKey = resolved.provider === "groq" ? (groqKey ?? "") : (openaiKey ?? "");
    const apiUrl = resolved.provider === "groq" ? GROQ_API_URL : OPENAI_API_URL;
    return {
      apiUrl,
      apiKey,
      defaultModel: resolved.modelId,
      provider: resolved.provider,
      registryModelId: resolved.id,
    };
  }

  if (groqKey) {
    return {
      apiUrl: GROQ_API_URL,
      apiKey: groqKey,
      defaultModel: "llama-3.3-70b-versatile",
      provider: "groq",
      registryModelId: null,
    };
  }
  return {
    apiUrl: OPENAI_API_URL,
    apiKey: openaiKey ?? "",
    defaultModel: "gpt-4o-mini",
    provider: "openai",
    registryModelId: null,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** `Retry-After` as seconds (OpenAI 429), capped. Returns null if missing. */
function parseRetryAfterSeconds(headers: Headers): number | null {
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 120);
}

const MAX_LLM_HTTP_RETRIES = 3;

/** Retries 429 / 503 with backoff or Retry-After before surfacing failure. */
async function postChatCompletions(
  resolved: ResolvedProvider,
  body: Record<string, unknown>
): Promise<Response> {
  for (let attempt = 1; attempt <= MAX_LLM_HTTP_RETRIES; attempt++) {
    const response = await fetch(resolved.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resolved.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) return response;

    const retryable = response.status === 429 || response.status === 503;
    if (retryable && attempt < MAX_LLM_HTTP_RETRIES) {
      await response.text().catch(() => {});
      const waitMs =
        response.status === 429
          ? (parseRetryAfterSeconds(response.headers) ?? Math.min(2 * attempt, 15)) * 1000
          : Math.min(2000 * attempt, 10000);
      await sleep(waitMs);
      continue;
    }

    return response;
  }

  throw new Error("LLM request failed: exhausted retries");
}

type CompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  modelVersion?: string;
  hasImages?: boolean;
};

export type StreamUsageSink = {
  /** Populated when the provider returns usage (OpenAI stream final chunk or Groq if present). */
  normalized?: NormalizedUsage;
  raw?: ProviderUsagePayload | null;
};

/** OpenAI may send `delta.content` as a string or (rarely) an array of `{ type: "text", text }` parts. */
function stringifyStreamDeltaContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const item of content) {
    if (item && typeof item === "object" && "type" in item) {
      const o = item as { type?: string; text?: string };
      if (o.type === "text" && typeof o.text === "string") parts.push(o.text);
    }
  }
  return parts.join("");
}

export async function createChatCompletion(
  messages: ChatMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    modelVersion?: string;
  }
): Promise<{ content: string; rawUsage: ProviderUsagePayload | null }> {
  const resolved = resolveProvider(options.modelVersion);
  if (!resolved.apiKey) {
    return {
      content: "No API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in your environment.",
      rawUsage: null,
    };
  }

  const model = options.model ?? resolved.defaultModel;

  const response = await postChatCompletions(resolved, {
    model,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 900,
    stream: false,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: ProviderUsagePayload;
  };
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { content, rawUsage: data?.usage ?? null };
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions & {
    /** Filled after the stream ends (exact usage when provider sends it, else estimated). */
    usageSink?: StreamUsageSink;
    /** Chars for estimation fallback (user + context serialized). */
    promptCharEstimate?: number;
  }
): AsyncGenerator<string, void, unknown> {
  const resolved = resolveProvider(options.modelVersion);
  if (!resolved.apiKey) {
    yield "No API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in your environment.";
    return;
  }

  const model = options.model ?? resolved.defaultModel;
  const isOpenAi = resolved.apiUrl === OPENAI_API_URL;
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 900,
    stream: true,
  };
  if (isOpenAi) {
    body.stream_options = { include_usage: true };
  }

  const response = await postChatCompletions(resolved, body);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let lastUsage: ProviderUsagePayload | null = null;
  let outputChars = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const lines = event
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data: "));
        for (const line of lines) {
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          const parsed = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: unknown } }>;
            usage?: ProviderUsagePayload;
          };
          if (parsed.usage) {
            lastUsage = parsed.usage;
          }
          const rawContent = parsed?.choices?.[0]?.delta?.content;
          const delta = stringifyStreamDeltaContent(rawContent);
          if (delta.length > 0) {
            outputChars += delta.length;
            yield delta;
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const sink = options.usageSink;
  if (!sink) return;

  sink.raw = lastUsage;
  const regId =
    resolved.registryModelId ??
    options.modelVersion ??
    (resolved.provider === "openai" ? "openai-gpt-4o-mini" : "groq-llama-70b");
  const promptChars = options.promptCharEstimate ?? 0;

  const fromProvider = normalizeUsageFromProvider({
    registryModelId: regId,
    provider: resolved.provider,
    usage: lastUsage,
    source: "stream_final_chunk",
  });
  if (fromProvider) {
    sink.normalized = fromProvider;
    return;
  }

  sink.normalized = estimateUsageFallback({
    registryModelId: regId,
    provider: resolved.provider,
    promptCharLength: promptChars,
    completionCharLength: outputChars,
  });
}

export async function checkOpenAiReachable(timeoutMs = 3000): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(OPENAI_MODELS_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export async function repairStructuredOutputWithModel(params: {
  rawOutput: string;
  outputSchema: unknown;
}): Promise<string | null> {
  const prompt = [
    "Fix your output to match the required JSON schema exactly.",
    `Schema: ${JSON.stringify(params.outputSchema)}`,
    "Return valid JSON only.",
    `Invalid output: ${params.rawOutput}`,
  ].join("\n\n");

  const { content: fixed } = await createChatCompletion(
    [
      { role: "system", content: "Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    { temperature: 0, maxTokens: 800 }
  );
  return fixed?.trim() || null;
}
