import { describe, expect, it } from "vitest";
import { emptyStrategyDocument } from "@/lib/strategyDocument";
import {
  STRATEGY_PREFILLED_FIELD_KEYS,
  areStrategyFieldsDirty,
  formatStrategyReadOnlyValue,
  isStrategyPrefilledField,
} from "@/lib/strategyUi";

describe("strategyUi", () => {
  it("identifies exactly the four spec-defined prefilled fields", () => {
    expect(STRATEGY_PREFILLED_FIELD_KEYS).toHaveLength(4);
    expect(isStrategyPrefilledField("objectiveInterpretation")).toBe(true);
    expect(isStrategyPrefilledField("brandComplianceGuardrails")).toBe(true);
    expect(isStrategyPrefilledField("timelineFeasibilityNotes")).toBe(true);
    expect(isStrategyPrefilledField("openStrategicQuestions")).toBe(true);
    expect(isStrategyPrefilledField("strategicSummary")).toBe(false);
  });

  it("detects dirty state when any field differs from saved", () => {
    const saved = emptyStrategyDocument().fields;
    const current = { ...saved, strategicSummary: "Changed" };
    expect(areStrategyFieldsDirty(saved, current)).toBe(true);
    expect(areStrategyFieldsDirty(saved, { ...saved })).toBe(false);
  });

  it("formats empty read-only values as Not provided", () => {
    expect(formatStrategyReadOnlyValue("")).toBe("Not provided");
    expect(formatStrategyReadOnlyValue("   ")).toBe("Not provided");
    expect(formatStrategyReadOnlyValue("Has content")).toBe("Has content");
  });
});
