import { describe, expect, it } from "vitest";
import { serializeChatHistoryMessage } from "@/lib/chatHistoryMessages";

const baseRow = {
  id: "msg-1",
  content: "Hello",
  imageUrls: null,
  agentConfigId: "agent-1",
  editedFromId: null,
  regenOfId: null,
  turnId: "turn-1",
  deliveryStatus: "COMPLETED" as const,
  retryOfAssistantMessageId: null,
  attemptIndex: 1,
  errorCode: null,
  errorMessage: null,
  provider: null,
  model: null,
  startedAt: null,
  completedAt: null,
  failedAt: null,
  createdAt: new Date("2026-06-08T12:00:00.000Z"),
};

describe("serializeChatHistoryMessage", () => {
  it("includes agentName for assistant messages with linked agent config", () => {
    const message = serializeChatHistoryMessage({
      ...baseRow,
      role: "assistant",
      agentConfig: { id: "agent-strategist", name: "Strategist" },
    });
    expect(message.agentName).toBe("Strategist");
    expect(message.agentConfigId).toBe("agent-1");
  });

  it("does not include agentName for user messages", () => {
    const message = serializeChatHistoryMessage({
      ...baseRow,
      role: "user",
      agentConfig: { id: "agent-strategist", name: "Strategist" },
    });
    expect(message.agentName).toBeUndefined();
  });

  it("preserves distinct agent labels across assistant messages", () => {
    const strategist = serializeChatHistoryMessage({
      ...baseRow,
      id: "asst-1",
      role: "assistant",
      agentConfigId: "agent-strategist",
      agentConfig: { id: "agent-strategist", name: "Strategist" },
    });
    const copywriter = serializeChatHistoryMessage({
      ...baseRow,
      id: "asst-2",
      role: "assistant",
      agentConfigId: "agent-copywriter",
      agentConfig: { id: "agent-copywriter", name: "Copywriter" },
    });
    expect(strategist.agentName).toBe("Strategist");
    expect(copywriter.agentName).toBe("Copywriter");
  });

  it("omits agentName when assistant message has no linked agent config", () => {
    const message = serializeChatHistoryMessage({
      ...baseRow,
      role: "assistant",
      agentConfigId: null,
      agentConfig: null,
    });
    expect(message.agentName).toBeUndefined();
  });
});
