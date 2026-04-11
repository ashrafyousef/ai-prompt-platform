import { ChatMessage } from "@/lib/orchestration/buildMessages";

// Groq is OpenAI-compatible. If GROQ_API_KEY is set it takes priority.
// Falls back to OpenAI if only OPENAI_API_KEY is set.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

const GROQ_MODELS: Record<string, string> = {
  "v1.0": "llama-3.1-8b-instant",
  "v2.0": "llama-3.3-70b-versatile",
};

const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export function resolveModelName(modelVersion?: string): string {
  return resolveProvider(modelVersion).defaultModel;
}

function resolveProvider(modelVersion?: string): { apiUrl: string; apiKey: string; defaultModel: string } {
  const groqKey = process.env.GROQ_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  if (groqKey) {
    const model = (modelVersion && GROQ_MODELS[modelVersion]) ?? GROQ_MODELS["v2.0"];
    return { apiUrl: GROQ_API_URL, apiKey: groqKey, defaultModel: model };
  }
  return { apiUrl: OPENAI_API_URL, apiKey: openaiKey ?? "", defaultModel: "gpt-4o-mini" };
}

type CompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  modelVersion?: string;
  hasImages?: boolean;
};

export async function createChatCompletion(messages: ChatMessage[], options: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const { apiUrl, apiKey, defaultModel } = resolveProvider();
  if (!apiKey) {
    return "No API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in your environment.";
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? defaultModel,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 900,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions
): AsyncGenerator<string, void, unknown> {
  const { apiUrl, apiKey, defaultModel } = resolveProvider(options.modelVersion);
  if (!apiKey) {
    yield "No API key configured. Set GROQ_API_KEY or OPENAI_API_KEY in your environment.";
    return;
  }

  let model = options.model ?? defaultModel;
  if (options.hasImages && process.env.GROQ_API_KEY) {
    model = GROQ_VISION_MODEL;
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 900,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
  }

  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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
        const parsed = JSON.parse(payload);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta.length > 0) {
          yield delta;
        }
      }
    }
  }
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

  const fixed = await createChatCompletion(
    [
      { role: "system", content: "Return valid JSON only." },
      { role: "user", content: prompt },
    ],
    { temperature: 0, maxTokens: 800 }
  );
  return fixed?.trim() || null;
}
