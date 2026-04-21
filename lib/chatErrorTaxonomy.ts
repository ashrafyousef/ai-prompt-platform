/**
 * Maps provider / server error strings to stable codes + in-thread titles for failed assistant cards.
 * Uses substring heuristics only (no SSE errorCode dependency).
 */
export type ClassifiedChatError = {
  code: string;
  title: string;
  detail: string;
};

export function classifyChatError(raw: string): ClassifiedChatError {
  const t = raw.trim();
  const lower = t.toLowerCase();

  if (lower.includes("rate limit") || lower.includes("429") || lower.includes("openai rate limit")) {
    return {
      code: "rate_limit",
      title: "Rate limit",
      detail:
        t.length > 0 && t.length < 400
          ? t
          : "OpenAI rate limit reached. Wait 1–2 minutes, send one message at a time, or use a smaller image.",
    };
  }
  if (
    lower.includes("does not support image") ||
    (lower.includes("vision") && lower.includes("select")) ||
    lower.includes("image inputs")
  ) {
    return {
      code: "vision_required",
      title: "Model and images",
      detail: t.length < 400 ? t : "This model cannot process image inputs. Pick a Vision-capable model.",
    };
  }
  if (lower.includes("unauthorized") || lower.includes("api key") || lower.includes("401")) {
    return {
      code: "auth",
      title: "API configuration",
      detail: t.length < 400 ? t : "AI API rejected the request. Check server API keys.",
    };
  }
  if (lower.includes("token soft limit") || lower.includes("monthly token limit")) {
    return {
      code: "budget",
      title: "Usage limit",
      detail: t,
    };
  }
  if (
    lower.includes("not available") ||
    lower.includes("governance") ||
    lower.includes("does not have access")
  ) {
    return {
      code: "governance",
      title: "Model unavailable",
      detail: t.length < 400 ? t : "The selected model is not available for this session.",
    };
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return {
      code: "timeout",
      title: "Timed out",
      detail: t.length < 400 ? t : "The request timed out before the model finished responding.",
    };
  }
  if (lower.includes("could not load an attached image")) {
    return {
      code: "image_load",
      title: "Image",
      detail: t,
    };
  }

  return {
    code: "unknown",
    title: "Couldn't complete response",
    detail: t.length > 0 && t.length < 500 ? t : "Something went wrong while generating the response.",
  };
}
