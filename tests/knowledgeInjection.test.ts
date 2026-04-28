import { describe, expect, it } from "vitest";
import { buildInjectedKnowledgeBlock, toKnowledgeInjectionTelemetry } from "../lib/knowledgeInjection";
import type { AgentKnowledgeItem } from "../lib/agentConfig";

function makeItem(overrides: Partial<AgentKnowledgeItem>): AgentKnowledgeItem {
  return {
    id: "k-1",
    title: "Default",
    sourceType: "manual_text",
    content: "Default content",
    fileRef: null,
    summary: "",
    tags: [],
    priority: 3,
    appliesTo: "all",
    isActive: true,
    ownerNote: "",
    lastReviewedAt: null,
    processingStatus: "ready",
    ...overrides,
  };
}

describe("buildInjectedKnowledgeBlock", () => {
  it("returns safe empty state when no knowledge exists", () => {
    const result = buildInjectedKnowledgeBlock([]);
    expect(result.block).toBe("");
    expect(result.meta).toEqual({
      totalItems: 0,
      activeItems: 0,
      injectedItems: 0,
      truncated: false,
      injectedChars: 0,
    });
  });

  it("ignores inactive knowledge items", () => {
    const result = buildInjectedKnowledgeBlock([
      makeItem({ id: "a", isActive: false }),
      makeItem({ id: "b", isActive: false }),
    ]);
    expect(result.block).toBe("");
    expect(result.meta.totalItems).toBe(2);
    expect(result.meta.activeItems).toBe(0);
    expect(result.meta.injectedItems).toBe(0);
    expect(result.meta.truncated).toBe(false);
  });

  it("injects active items using shared formatting", () => {
    const result = buildInjectedKnowledgeBlock([
      makeItem({ id: "a", title: "Policy", content: "Always answer tersely." }),
    ]);
    expect(result.block.startsWith("Reference Knowledge:\n")).toBe(true);
    expect(result.block).toContain("### Policy");
    expect(result.meta.totalItems).toBe(1);
    expect(result.meta.activeItems).toBe(1);
    expect(result.meta.injectedItems).toBe(1);
    expect(result.meta.truncated).toBe(false);
    expect(result.meta.injectedChars).toBeGreaterThan(0);
  });

  it("truncates deterministically when total cap is reached", () => {
    const long = "x".repeat(200);
    const result = buildInjectedKnowledgeBlock(
      [
        makeItem({ id: "a", title: "A", content: long }),
        makeItem({ id: "b", title: "B", content: long }),
      ],
      { maxTotalChars: 180, maxItemChars: 120 }
    );
    expect(result.meta.activeItems).toBe(2);
    expect(result.meta.injectedItems).toBe(1);
    expect(result.meta.truncated).toBe(true);
    expect(result.meta.injectedChars).toBeGreaterThan(0);
  });
});

describe("toKnowledgeInjectionTelemetry", () => {
  it("returns standardized telemetry payload shape", () => {
    const telemetry = toKnowledgeInjectionTelemetry({
      totalItems: 2,
      activeItems: 1,
      injectedItems: 1,
      injectedChars: 88,
      truncated: false,
    });
    expect(telemetry).toEqual({
      totalItems: 2,
      activeItems: 1,
      injectedItems: 1,
      injectedChars: 88,
      truncated: false,
    });
  });

  it("returns null when telemetry source is absent", () => {
    expect(toKnowledgeInjectionTelemetry(null)).toBeNull();
    expect(toKnowledgeInjectionTelemetry(undefined)).toBeNull();
  });
});
