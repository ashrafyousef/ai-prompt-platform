import { describe, expect, it } from "vitest";
import { emptyBriefDocument } from "@/lib/briefIntake";
import { buildBriefHandoffSections, NOT_PROVIDED } from "@/lib/briefHandoff";

describe("buildBriefHandoffSections", () => {
  it("represents all 12 brief fields exactly once across 7 sections", () => {
    const sections = buildBriefHandoffSections(emptyBriefDocument());
    const allKeys = sections.flatMap((section) => section.rows.map((row) => row.key));
    expect(sections).toHaveLength(7);
    expect(allKeys).toHaveLength(12);
    expect(new Set(allKeys).size).toBe(12);
  });

  it("shows 'Not provided' for empty fields", () => {
    const sections = buildBriefHandoffSections(emptyBriefDocument());
    for (const section of sections) {
      for (const row of section.rows) {
        expect(row.value).toBe(NOT_PROVIDED);
      }
    }
  });

  it("shows trimmed field content when present", () => {
    const document = emptyBriefDocument();
    document.fields.objective = "  Launch Q3 campaign  ";
    const sections = buildBriefHandoffSections(document);
    const objectiveSection = sections.find((section) => section.id === "objective");
    expect(objectiveSection?.rows[0]?.value).toBe("Launch Q3 campaign");
  });

  it("treats whitespace-only fields as not provided", () => {
    const document = emptyBriefDocument();
    document.fields.keyMessage = "   ";
    const sections = buildBriefHandoffSections(document);
    const messageSection = sections.find((section) => section.id === "message");
    expect(messageSection?.rows[0]?.value).toBe(NOT_PROVIDED);
  });

  it("groups fields per the approved Phase 2F.1 spec", () => {
    const sections = buildBriefHandoffSections(emptyBriefDocument());
    const byId = Object.fromEntries(sections.map((s) => [s.id, s.rows.map((r) => r.key)]));
    expect(byId["project-context"]).toEqual(["clientBackground", "campaignType", "referenceNotes"]);
    expect(byId["objective"]).toEqual(["objective"]);
    expect(byId["audience"]).toEqual(["targetAudience"]);
    expect(byId["message"]).toEqual(["keyMessage"]);
    expect(byId["logistics"]).toEqual(["deliverables", "channels", "timeline"]);
    expect(byId["constraints"]).toEqual(["brandRestrictions", "mandatoryContent"]);
    expect(byId["open-questions"]).toEqual(["openQuestions"]);
  });
});
