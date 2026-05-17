import { describe, expect, it } from "vitest";
import {
  buildChatOutputInstructions,
  buildLegacyMarkdownOutputInstructions,
  ensureMarkdownSections,
  shouldEnforceLegacyMarkdownSections,
} from "@/lib/orchestration/outputInstructions";
import type { AgentOutputConfig } from "@/lib/agentConfig";

const baseOutputConfig: AgentOutputConfig = {
  format: "markdown",
  requiredSections: [],
  responseDepth: "standard",
  citationsPolicy: "none",
  fallbackBehavior: "",
  template: null,
  schema: null,
};

describe("buildChatOutputInstructions", () => {
  it("uses JSON instructions when outputSchema is set", () => {
    const schema = { type: "object", properties: { prompt: { type: "string" } } };
    const text = buildChatOutputInstructions(
      { outputSchema: schema },
      { ...baseOutputConfig, format: "json" }
    );
    expect(text).toContain("Return valid JSON only");
    expect(text).toContain("prompt");
    expect(text).not.toContain("## Result");
  });

  it("uses custom section headings when requiredSections is set", () => {
    const text = buildChatOutputInstructions(
      { outputSchema: null },
      {
        ...baseOutputConfig,
        requiredSections: ["Creative direction", "Final prompt"],
      }
    );
    expect(text).toContain("### Creative direction");
    expect(text).toContain("### Final prompt");
    expect(text).not.toMatch(/^## Result/m);
    expect(text).not.toBe(buildLegacyMarkdownOutputInstructions());
  });

  it("falls back to legacy markdown when requiredSections is empty", () => {
    const text = buildChatOutputInstructions({ outputSchema: null }, baseOutputConfig);
    expect(text).toBe(buildLegacyMarkdownOutputInstructions());
  });
});

describe("ensureMarkdownSections", () => {
  it("does not inject legacy headings when custom sections are configured", () => {
    const output = ensureMarkdownSections("### Creative direction\nHello", [
      "Creative direction",
    ]);
    expect(output).toBe("### Creative direction\nHello");
    expect(output).not.toContain("## Result");
  });

  it("injects legacy headings when no custom sections are configured", () => {
    const output = ensureMarkdownSections("plain answer", []);
    expect(output).toContain("## Result");
    expect(output).toContain("## Details");
  });
});

describe("shouldEnforceLegacyMarkdownSections", () => {
  it("is false for JSON agents and custom-section markdown agents", () => {
    expect(
      shouldEnforceLegacyMarkdownSections(
        { outputSchema: { type: "object" } },
        baseOutputConfig
      )
    ).toBe(false);
    expect(
      shouldEnforceLegacyMarkdownSections(
        { outputSchema: null },
        { ...baseOutputConfig, requiredSections: ["Final prompt"] }
      )
    ).toBe(false);
  });

  it("is true for legacy markdown agents without custom sections", () => {
    expect(
      shouldEnforceLegacyMarkdownSections({ outputSchema: null }, baseOutputConfig)
    ).toBe(true);
  });
});
