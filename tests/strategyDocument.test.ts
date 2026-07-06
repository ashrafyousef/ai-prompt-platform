import { describe, expect, it } from "vitest";
import { emptyBriefDocument, type BriefDocumentV2 } from "@/lib/briefIntake";
import {
  STRATEGY_FIELD_KEYS,
  emptyStrategyDocument,
  parseStrategyDocumentJson,
  mergeStrategyDocument,
  hasStrategyContent,
  buildPrefilledStrategyDocument,
} from "@/lib/strategyDocument";

describe("strategyDocument", () => {
  it("has exactly 14 fields", () => {
    expect(STRATEGY_FIELD_KEYS).toHaveLength(14);
  });

  it("parses malformed/empty stored JSON into an empty document", () => {
    expect(parseStrategyDocumentJson(null)).toEqual(emptyStrategyDocument());
    expect(parseStrategyDocumentJson(undefined)).toEqual(emptyStrategyDocument());
    expect(parseStrategyDocumentJson("not json")).toEqual(emptyStrategyDocument());
  });

  it("merges a PARTIAL patch (one field only) without dropping untouched fields", () => {
    const existing = emptyStrategyDocument();
    existing.fields.strategicSummary = "Existing summary";
    existing.fields.audienceInsight = "Existing audience insight";
    const merged = mergeStrategyDocument(existing, {
      fields: { coreTensionOpportunity: "New tension" },
    });
    expect(merged.fields.strategicSummary).toBe("Existing summary");
    expect(merged.fields.audienceInsight).toBe("Existing audience insight");
    expect(merged.fields.coreTensionOpportunity).toBe("New tension");
  });

  it("hasStrategyContent is false for an all-empty document and true if any field is set", () => {
    const empty = emptyStrategyDocument();
    expect(hasStrategyContent(empty)).toBe(false);
    empty.fields.messageHierarchy = "Own the street.";
    expect(hasStrategyContent(empty)).toBe(true);
  });

  it("prefills exactly the 4 spec-defined fields from an approved brief, leaving the other 10 empty", () => {
    const brief: BriefDocumentV2 = emptyBriefDocument();
    brief.fields.objective = "Launch Q3 sneaker campaign";
    brief.fields.brandRestrictions = "No competitor logos";
    brief.fields.mandatoryContent = "#OwnTheStreet hashtag required";
    brief.fields.timeline = "Launch Aug 15";
    brief.fields.openQuestions = "Confirm influencer budget";

    const strategy = buildPrefilledStrategyDocument(brief);

    expect(strategy.fields.objectiveInterpretation).toBe("Launch Q3 sneaker campaign");
    expect(strategy.fields.brandComplianceGuardrails).toBe(
      "Brand restrictions: No competitor logos\n\nMandatory content: #OwnTheStreet hashtag required"
    );
    expect(strategy.fields.timelineFeasibilityNotes).toBe("Launch Aug 15");
    expect(strategy.fields.openStrategicQuestions).toBe("Confirm influencer budget");

    expect(strategy.fields.strategicSummary).toBe("");
    expect(strategy.fields.audienceInsight).toBe("");
    expect(strategy.fields.coreTensionOpportunity).toBe("");
    expect(strategy.fields.singleMindedProposition).toBe("");
    expect(strategy.fields.reasonsToBelieve).toBe("");
  });

  it("omits a guardrails line when its source brief field is empty", () => {
    const brief: BriefDocumentV2 = emptyBriefDocument();
    brief.fields.brandRestrictions = "No competitor logos";
    const strategy = buildPrefilledStrategyDocument(brief);
    expect(strategy.fields.brandComplianceGuardrails).toBe("Brand restrictions: No competitor logos");
  });

  it("leaves brandComplianceGuardrails empty when both source fields are empty", () => {
    const brief = emptyBriefDocument();
    const strategy = buildPrefilledStrategyDocument(brief);
    expect(strategy.fields.brandComplianceGuardrails).toBe("");
  });
});
