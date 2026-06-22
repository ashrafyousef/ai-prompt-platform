import { describe, expect, it } from "vitest";
import {
  analyzeRawBriefDeterministic,
  buildDeterministicBriefAnalysis,
  extractProposedFieldsFromRawText,
  isMeaningfulExtract,
} from "@/lib/briefAnalyze";

const ABK_RAW_BRIEF = `Client: ABK
Campaign: Summer rewards campaign

We need a campaign for customers during the summer travel period. The message should focus on rewards, card usage, and travel lifestyle. The campaign will be used across social media and digital channels.

Target customers are existing ABK cardholders and people who may be interested in premium banking benefits.

We need Instagram posts, story formats, banners, and maybe some outdoor adaptations.

The tone should feel premium, simple, trustworthy, and travel-related.

Mandatory: use ABK branding and approved card visuals.`;

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

  it("rejects meaningless channel extractions", () => {
    expect(isMeaningfulExtract(".")).toBe(false);
    expect(isMeaningfulExtract("social media and digital")).toBe(true);
  });

  it("extracts the ABK summer rewards QA brief", () => {
    const proposed = extractProposedFieldsFromRawText(ABK_RAW_BRIEF);

    expect(proposed.targetAudience.toLowerCase()).toContain("existing abk cardholders");
    expect(proposed.deliverables.toLowerCase()).toContain("instagram posts");
    expect(proposed.channels.toLowerCase()).toContain("social media and digital channels");
    expect(
      proposed.mandatoryContent.toLowerCase().includes("abk branding") ||
        proposed.brandRestrictions.toLowerCase().includes("abk branding")
    ).toBe(true);
    expect(proposed.channels).not.toBe(".");
  });

  it("does not flag missing audience, deliverables, or compliance for the ABK QA brief", () => {
    const result = analyzeRawBriefDeterministic(ABK_RAW_BRIEF);
    const codes = result.issues.map((issue) => issue.code);

    expect(codes).not.toContain("missing_target_audience");
    expect(codes).not.toContain("missing_deliverables");
    expect(codes).not.toContain("missing_mandatory_compliance");
    expect(codes).not.toContain("missing_mandatory_content");
  });
});
