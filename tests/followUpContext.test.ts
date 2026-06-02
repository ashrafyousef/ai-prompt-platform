import { describe, expect, it } from "vitest";
import {
  buildFollowUpContextSystemMessage,
  FOLLOW_UP_CONTEXT_SYSTEM_RULE,
  isShortFollowUpStyleTurn,
  shouldIncludeFollowUpContextGuidance,
} from "@/lib/orchestration/followUpContext";
import {
  buildChatOutputInstructions,
  buildFlexibleMarkdownOutputInstructions,
  buildSimpleConversationalOutputInstructions,
  isSimpleConversationalTurn,
} from "@/lib/orchestration/outputInstructions";
import { buildMessages } from "@/lib/orchestration/buildMessages";
import type { AgentOutputConfig } from "@/lib/agentConfig";
import type { AgentConfig, Message } from "@prisma/client";

const baseOutputConfig: AgentOutputConfig = {
  format: "markdown",
  requiredSections: [],
  responseDepth: "standard",
  citationsPolicy: "none",
  fallbackBehavior: "",
  template: null,
  schema: null,
};

function historyMessage(
  role: "user" | "assistant",
  content: string,
  index: number
): Message {
  return {
    id: `msg-${index}`,
    sessionId: "session-1",
    userId: "user-1",
    role,
    content,
    imageUrls: [],
    agentConfigId: null,
    turnId: null,
    editedFromId: null,
    regenOfId: null,
    retryOfAssistantMessageId: null,
    attemptIndex: 1,
    model: null,
    provider: null,
    deliveryStatus: "COMPLETED",
    startedAt: null,
    completedAt: null,
    failedAt: null,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(`2026-06-0${index}T12:00:00Z`),
  };
}

const minimalAgent = {
  id: "agent-1",
  name: "Nur",
  slug: "lumex",
  systemPrompt: "You are a creative assistant.",
  outputSchema: null,
  temperature: 0.4,
  maxTokens: 900,
} as AgentConfig;

describe("isShortFollowUpStyleTurn", () => {
  it("matches brief continuation-style turns without phrase lists", () => {
    expect(isShortFollowUpStyleTurn("go ahead")).toBe(true);
    expect(isShortFollowUpStyleTurn("yes")).toBe(true);
    expect(isShortFollowUpStyleTurn("like the original style")).toBe(true);
    expect(isShortFollowUpStyleTurn("make it more premium")).toBe(true);
  });

  it("does not match simple acknowledgements or long task prompts", () => {
    expect(isShortFollowUpStyleTurn("Thanks")).toBe(false);
    expect(isShortFollowUpStyleTurn("ok")).toBe(false);
    expect(
      isShortFollowUpStyleTurn("Analyze this image and improve the creative direction")
    ).toBe(false);
  });
});

describe("shouldIncludeFollowUpContextGuidance", () => {
  const priorHistory = [
    historyMessage("user", "Analyze the attached image", 1),
    historyMessage("assistant", "Here is a creative direction...", 2),
    historyMessage("user", "go ahead", 3),
  ];

  it("includes guidance for follow-ups when prior history exists", () => {
    expect(shouldIncludeFollowUpContextGuidance("go ahead", priorHistory)).toBe(true);
    expect(shouldIncludeFollowUpContextGuidance("like the original style", priorHistory)).toBe(
      true
    );
  });

  it("excludes simple acknowledgements and first-turn messages", () => {
    expect(shouldIncludeFollowUpContextGuidance("Thanks", priorHistory)).toBe(false);
    expect(shouldIncludeFollowUpContextGuidance("go ahead", [historyMessage("user", "go ahead", 1)])).toBe(
      false
    );
  });
});

describe("buildFollowUpContextSystemMessage", () => {
  const priorHistory = [
    historyMessage("user", "Analyze the attached image", 1),
    historyMessage("assistant", "Suggested direction...", 2),
    historyMessage("user", "go ahead", 3),
  ];

  it("returns the shared principle-based rule", () => {
    const message = buildFollowUpContextSystemMessage("go ahead", priorHistory);
    expect(message).toContain(FOLLOW_UP_CONTEXT_SYSTEM_RULE);
    expect(message).toContain("continue the in-progress work");
  });

  it("returns null for Thanks", () => {
    expect(buildFollowUpContextSystemMessage("Thanks", priorHistory)).toBeNull();
  });
});

describe("output instructions with follow-up turns", () => {
  it("keeps Thanks on conversational output instructions", () => {
    expect(isSimpleConversationalTurn("Thanks")).toBe(true);
    expect(buildChatOutputInstructions({ outputSchema: null }, baseOutputConfig, "Thanks")).toBe(
      buildSimpleConversationalOutputInstructions()
    );
  });

  it("keeps creative tasks on flexible structured output", () => {
    expect(
      buildChatOutputInstructions(
        { outputSchema: null },
        baseOutputConfig,
        "Analyze this image and improve the creative direction"
      )
    ).toBe(buildFlexibleMarkdownOutputInstructions());
  });
});

describe("buildMessages follow-up injection", () => {
  it("injects follow-up context guidance into system messages", () => {
    const history = [
      historyMessage("user", "Analyze the attached image", 1),
      historyMessage("assistant", "Creative direction draft", 2),
      historyMessage("user", "go ahead", 3),
    ];
    const messages = buildMessages({
      agent: minimalAgent,
      outputConfig: baseOutputConfig,
      history,
      userInput: "go ahead",
    });

    const systemContents = messages.filter((m) => m.role === "system").map((m) => m.content);
    expect(systemContents.some((c) => typeof c === "string" && c.includes(FOLLOW_UP_CONTEXT_SYSTEM_RULE))).toBe(
      true
    );
  });

  it("does not inject follow-up guidance for Thanks", () => {
    const history = [
      historyMessage("user", "Analyze the attached image", 1),
      historyMessage("assistant", "Creative direction draft", 2),
      historyMessage("user", "Thanks", 3),
    ];
    const messages = buildMessages({
      agent: minimalAgent,
      outputConfig: baseOutputConfig,
      history,
      userInput: "Thanks",
    });

    const systemContents = messages.filter((m) => m.role === "system").map((m) => m.content);
    expect(systemContents.some((c) => typeof c === "string" && c.includes(FOLLOW_UP_CONTEXT_SYSTEM_RULE))).toBe(
      false
    );
  });
});
