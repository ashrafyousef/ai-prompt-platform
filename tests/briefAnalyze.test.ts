import { describe, expect, it } from "vitest";
import {
  analyzeRawBriefDeterministic,
  buildDeterministicBriefAnalysis,
  extractProposedFieldsFromRawText,
} from "@/lib/briefAnalyze";

describe("briefAnalyze", () => {
  it("flags empty raw brief", () => {
    const result = analyzeRawBriefDeterministic("");
    expect(result.issues.some((issue) => issue.code === "missing_raw_brief")).toBe(true);
  });

  it("flags gaps in unstructured brief text", () => {
    const result = analyzeRawBriefDeterministic("Please make some social posts.");
    expect(result.issues.some((issue) => issue.code === "missing_target_audience")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "missing_deliverables")).toBe(true);
    expect(result.issues.some((issue) => issue.code === "missing_timeline")).toBe(true);
  });

  it("extracts labeled sections into proposed fields", () => {
    const raw = [
      "Objective: Launch a summer awareness campaign",
      "Target audience: Urban professionals aged 25-40",
      "Deliverables: 3x social videos and 1 landing page",
      "Channels: Instagram, TikTok, YouTube",
      "Timeline: Launch by July 15",
      "Brand restrictions: No competitor mentions",
    ].join("\n");

    const proposed = extractProposedFieldsFromRawText(raw);
    expect(proposed.objective).toMatch(/summer awareness campaign/i);
    expect(proposed.targetAudience).toMatch(/urban professionals/i);
    expect(proposed.deliverables).toMatch(/social videos/i);
    expect(proposed.channels).toMatch(/instagram/i);
    expect(proposed.timeline).toMatch(/july 15/i);
  });

  it("reports weak key message when message is too short", () => {
    const raw = "Objective: Launch campaign\nKey message: Buy now";
    const result = analyzeRawBriefDeterministic(raw);
    expect(result.issues.some((issue) => issue.code === "weak_key_message")).toBe(true);
  });

  it("builds deterministic analysis envelope", () => {
    const analysis = buildDeterministicBriefAnalysis("Objective: Build master brief workflow");
    expect(analysis.mode).toBe("deterministic");
    expect(analysis.generatedAt).toBeTruthy();
    expect(analysis.proposedFields?.objective).toMatch(/master brief workflow/i);
  });
});
