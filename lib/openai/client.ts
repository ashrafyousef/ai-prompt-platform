import { ChatMessage } from "@/lib/orchestration/buildMessages";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

type CompletionOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export async function createChatCompletion(messages: ChatMessage[], options: {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return "OPENAI_API_KEY is not configured. Add it to your environment to enable real model responses.";
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-4o-mini",
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 900,
      stream: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? "";
}

export async function* streamChatCompletion(
  messages: ChatMessage[],
  options: CompletionOptions
): AsyncGenerator<string, void, unknown> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    yield "OPENAI_API_KEY is not configured. Add it to your environment to enable real model responses.";
    return;
  }

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: options.model ?? "gpt-4o-mini",
      messages,
      temperature: options.temperature ?? 0.4,
      max_tokens: options.maxTokens ?? 900,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI request failed: ${response.status} ${text}`);
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
