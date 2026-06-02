import { describe, expect, it } from "vitest";
import {
  LlmRequestFailedError,
  mapLlmProviderErrorToClientMessage,
  openAiOmitsTemperature,
  parseProviderErrorBody,
} from "@/lib/openai/client";

describe("openAiOmitsTemperature", () => {
  it("omits temperature for GPT-5 family OpenAI models", () => {
    expect(openAiOmitsTemperature("openai", "gpt-5.4-mini", "openai-gpt-5.4-mini")).toBe(true);
    expect(openAiOmitsTemperature("openai", "gpt-5.4", "openai-gpt-5.4")).toBe(true);
  });

  it("keeps temperature for non-GPT-5 OpenAI models", () => {
    expect(openAiOmitsTemperature("openai", "gpt-4o-mini", "openai-gpt-4o-mini")).toBe(false);
  });

  it("does not affect Groq models", () => {
    expect(openAiOmitsTemperature("groq", "llama-3.3-70b-versatile", "groq-llama-70b")).toBe(false);
  });
});

describe("parseProviderErrorBody", () => {
  it("extracts OpenAI-style error fields", () => {
    const parsed = parseProviderErrorBody(
      JSON.stringify({
        error: {
          type: "invalid_request_error",
          code: "unsupported_value",
          param: "temperature",
          message: "Unsupported value: 'temperature' does not support 0.4 with this model.",
        },
      })
    );
    expect(parsed.errorType).toBe("invalid_request_error");
    expect(parsed.errorCode).toBe("unsupported_value");
    expect(parsed.errorParam).toBe("temperature");
    expect(parsed.errorMessage).toContain("temperature");
  });
});

describe("mapLlmProviderErrorToClientMessage", () => {
  const base = {
    provider: "openai" as const,
    model: "gpt-5.4-mini",
    status: 400,
  };

  it("maps unsupported temperature to model settings message", () => {
    const message = mapLlmProviderErrorToClientMessage({
      ...base,
      ...parseProviderErrorBody(
        JSON.stringify({
          error: {
            code: "unsupported_value",
            param: "temperature",
            message: "Only the default (1) value is supported.",
          },
        })
      ),
    });
    expect(message).toBe(
      "The selected model rejected one of the request settings. Try again or switch models."
    );
  });

  it("maps context length errors", () => {
    const message = mapLlmProviderErrorToClientMessage({
      ...base,
      errorType: "invalid_request_error",
      errorCode: "context_length_exceeded",
      errorParam: null,
      errorMessage: "This model's maximum context length is exceeded.",
    });
    expect(message).toBe(
      "This conversation is too long for the selected model. Start a new chat or switch to a larger-context model."
    );
  });

  it("maps image download failures", () => {
    const message = mapLlmProviderErrorToClientMessage({
      ...base,
      errorType: "invalid_request_error",
      errorCode: "invalid_request_error",
      errorParam: "messages.[1].content.[1].image_url.url",
      errorMessage: "Failed to download image from URL.",
    });
    expect(message).toBe(
      "The model could not read the attached image. Re-upload it or try a smaller image."
    );
  });

  it("falls back to generic provider rejection for other 400 errors", () => {
    const message = mapLlmProviderErrorToClientMessage({
      ...base,
      errorType: "invalid_request_error",
      errorCode: "invalid_request_error",
      errorParam: null,
      errorMessage: "Something else went wrong.",
    });
    expect(message).toBe(
      "The AI provider rejected this request (prompt, image, or model). Try a smaller image or different model."
    );
  });
});

describe("LlmRequestFailedError", () => {
  it("does not embed raw provider JSON in the error message", () => {
    const error = new LlmRequestFailedError({
      provider: "openai",
      model: "gpt-5.4-mini",
      status: 400,
      errorType: "invalid_request_error",
      errorCode: "unsupported_value",
      errorParam: "temperature",
      errorMessage: "secret details should not appear in user-facing Error.message by default",
    });
    expect(error.message).toBe("LLM request failed: 400");
    expect(error.details.errorMessage).toContain("secret details");
  });
});
