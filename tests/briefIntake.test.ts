import { describe, expect, it } from "vitest";
import {
  BRIEF_DOCUMENT_VERSION,
  BRIEF_INTAKE_FIELD_KEYS,
  BRIEF_INTAKE_VERSION,
  briefIntakeResponsesSchema,
  emptyBriefDocument,
  emptyBriefIntakeResponses,
  hasBriefIntakeContent,
  hasBriefIntakeContentFromUnknown,
  hasSavedRawBriefText,
  mergeBriefDocument,
  parseBriefDocumentJson,
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
    const empty = emptyBriefDocument();
    expect(hasBriefIntakeContent(empty)).toBe(false);
    expect(hasBriefIntakeContentFromUnknown(null)).toBe(false);

    const filled = emptyBriefDocument();
    filled.fields.timeline = "Q3 2026";
    expect(hasBriefIntakeContent(filled)).toBe(true);
    expect(hasBriefIntakeContentFromUnknown(filled)).toBe(true);
  });

  it("upgrades v1 stored JSON to v2 document with source/analysis empty", () => {
    const document = parseBriefDocumentJson({
      version: 1,
      fields: { objective: "Legacy objective" },
    });
    expect(document.version).toBe(BRIEF_DOCUMENT_VERSION);
    expect(document.fields.objective).toBe("Legacy objective");
    expect(document.source).toBeUndefined();
    expect(document.analysis).toBeUndefined();
  });

  it("preserves source and analysis when parsing v2", () => {
    const document = parseBriefDocumentJson({
      version: 2,
      fields: { objective: "Saved objective" },
      source: { rawText: "Client pasted brief", savedAt: "2026-01-01T00:00:00.000Z" },
      analysis: {
        generatedAt: "2026-01-02T00:00:00.000Z",
        mode: "deterministic",
        issues: [{ code: "missing_channels", severity: "warning", message: "Missing channels" }],
      },
    });
    expect(document.source?.rawText).toBe("Client pasted brief");
    expect(document.analysis?.issues).toHaveLength(1);
  });

  it("merges field patches without wiping source or analysis", () => {
    const existing = parseBriefDocumentJson({
      version: 2,
      fields: { objective: "Old objective" },
      source: { rawText: "Raw brief" },
      analysis: {
        generatedAt: "2026-01-02T00:00:00.000Z",
        mode: "deterministic",
        issues: [],
      },
    });
    const merged = mergeBriefDocument(existing, {
      fields: {
        ...existing.fields,
        objective: "New objective",
      },
    });
    expect(merged.fields.objective).toBe("New objective");
    expect(merged.source?.rawText).toBe("Raw brief");
    expect(merged.analysis?.mode).toBe("deterministic");
  });

  it("detects saved raw brief text", () => {
    const document = emptyBriefDocument();
    expect(hasSavedRawBriefText(document)).toBe(false);
    document.source = { rawText: "Client brief" };
    expect(hasSavedRawBriefText(document)).toBe(true);
  });
});
