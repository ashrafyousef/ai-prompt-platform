import { describe, expect, it } from "vitest";
import {
  isNewerAssistantAttempt,
  selectVisibleChatMessages,
} from "@/lib/chatVisibleMessages";

describe("selectVisibleChatMessages", () => {
  it("keeps only the latest assistant attempt per turnId", () => {
    const messages = [
      { id: "u1", role: "user", turnId: "t1", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        role: "assistant",
        turnId: "t1",
        attemptIndex: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "a2",
        role: "assistant",
        turnId: "t1",
        attemptIndex: 2,
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    ];

    const visible = selectVisibleChatMessages(messages);
    expect(visible.map((m) => m.id)).toEqual(["u1", "a2"]);
  });

  it("does not collapse assistants from different turns", () => {
    const messages = [
      { id: "u1", role: "user", turnId: "t1", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        role: "assistant",
        turnId: "t1",
        attemptIndex: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      { id: "u2", role: "user", turnId: "t2", createdAt: "2026-01-01T00:01:00.000Z" },
      {
        id: "a2",
        role: "assistant",
        turnId: "t2",
        attemptIndex: 1,
        createdAt: "2026-01-01T00:01:01.000Z",
      },
    ];

    const visible = selectVisibleChatMessages(messages);
    expect(visible.map((m) => m.id)).toEqual(["u1", "a1", "u2", "a2"]);
  });

  it("shows failed assistant when it is the latest attempt", () => {
    const messages = [
      { id: "u1", role: "user", turnId: "t1", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        role: "assistant",
        turnId: "t1",
        attemptIndex: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "a2",
        role: "assistant",
        turnId: "t1",
        attemptIndex: 2,
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    ];

    const visible = selectVisibleChatMessages(messages);
    expect(visible.some((m) => m.id === "a2")).toBe(true);
    expect(visible.some((m) => m.id === "a1")).toBe(false);
  });

  it("groups legacy assistants without turnId under the preceding user", () => {
    const messages = [
      { id: "u1", role: "user", createdAt: "2026-01-01T00:00:00.000Z" },
      {
        id: "a1",
        role: "assistant",
        attemptIndex: 1,
        createdAt: "2026-01-01T00:00:01.000Z",
      },
      {
        id: "a2",
        role: "assistant",
        attemptIndex: 2,
        createdAt: "2026-01-01T00:00:02.000Z",
      },
    ];

    const visible = selectVisibleChatMessages(messages);
    expect(visible.map((m) => m.id)).toEqual(["u1", "a2"]);
  });
});

describe("isNewerAssistantAttempt", () => {
  it("prefers higher attemptIndex", () => {
    const older = {
      id: "a1",
      role: "assistant",
      attemptIndex: 1,
      createdAt: "2026-01-01T00:00:01.000Z",
    };
    const newer = {
      id: "a2",
      role: "assistant",
      attemptIndex: 2,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    expect(isNewerAssistantAttempt(older, newer)).toBe(true);
  });
});
