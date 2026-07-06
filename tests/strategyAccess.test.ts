import { describe, expect, it } from "vitest";
import { canEditStrategyResponses, canMarkStrategyReady } from "@/lib/strategyAccess";

describe("canEditStrategyResponses", () => {
  it("DRAFT + ACTIVE project = true", () => {
    expect(canEditStrategyResponses("DRAFT", "ACTIVE")).toBe(true);
  });
  it("READY_FOR_CREATIVE + ACTIVE project = false", () => {
    expect(canEditStrategyResponses("READY_FOR_CREATIVE", "ACTIVE")).toBe(false);
  });
  it("DRAFT + ARCHIVED project = false", () => {
    expect(canEditStrategyResponses("DRAFT", "ARCHIVED")).toBe(false);
  });
  it("ARCHIVED strategy = false regardless of project status", () => {
    expect(canEditStrategyResponses("ARCHIVED", "ACTIVE")).toBe(false);
  });
});

describe("canMarkStrategyReady", () => {
  it("DRAFT + ACTIVE project = true", () => {
    expect(canMarkStrategyReady("DRAFT", "ACTIVE")).toBe(true);
  });
  it("READY_FOR_CREATIVE + ACTIVE project = false (already ready, not reversible here)", () => {
    expect(canMarkStrategyReady("READY_FOR_CREATIVE", "ACTIVE")).toBe(false);
  });
  it("DRAFT + ARCHIVED project = false", () => {
    expect(canMarkStrategyReady("DRAFT", "ARCHIVED")).toBe(false);
  });
});
