import { describe, expect, it } from "vitest";
import {
  BRIEF_INTAKE_FIELD_KEYS,
  BRIEF_INTAKE_VERSION,
  briefIntakeResponsesSchema,
  emptyBriefIntakeResponses,
  hasBriefIntakeContent,
  hasBriefIntakeContentFromUnknown,
  parseBriefResponsesJson,
} from "@/lib/briefIntake";

describe("briefIntake", () => {
  it("returns empty v1 defaults for null input", () => {
    const parsed = parseBriefResponsesJson(null);
    expect(parsed.version).toBe(BRIEF_INTAKE_VERSION);
    for (const key of BRIEF_INTAKE_FIELD_KEYS) {
      expect(parsed.fields[key]).toBe("");
    }
  });

  it("normalizes partial legacy objects", () => {
    const parsed = parseBriefResponsesJson({
      objective: "Launch campaign",
      unknownField: "ignored",
    });
    expect(parsed.fields.objective).toBe("Launch campaign");
    expect(parsed.fields.deliverables).toBe("");
  });

  it("reads nested fields object", () => {
    const parsed = parseBriefResponsesJson({
      version: 1,
      fields: {
        keyMessage: "Quality first",
      },
    });
    expect(parsed.fields.keyMessage).toBe("Quality first");
  });

  it("truncates overlong field values", () => {
    const long = "x".repeat(5000);
    const parsed = parseBriefResponsesJson({ objective: long });
    expect(parsed.fields.objective).toHaveLength(4000);
  });

  it("validates full v1 responses with Zod", () => {
    const responses = emptyBriefIntakeResponses();
    responses.fields.objective = "Test";
    expect(briefIntakeResponsesSchema.parse(responses)).toEqual(responses);
  });

  it("detects saved intake content", () => {
    const empty = emptyBriefIntakeResponses();
    expect(hasBriefIntakeContent(empty)).toBe(false);
    expect(hasBriefIntakeContentFromUnknown(null)).toBe(false);

    const filled = emptyBriefIntakeResponses();
    filled.fields.timeline = "Q3 2026";
    expect(hasBriefIntakeContent(filled)).toBe(true);
    expect(hasBriefIntakeContentFromUnknown(filled)).toBe(true);
  });
});
