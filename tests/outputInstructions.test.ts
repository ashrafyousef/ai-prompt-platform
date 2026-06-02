import { describe, expect, it } from "vitest";
import {
  buildChatOutputInstructions,
  buildFlexibleMarkdownOutputInstructions,
  buildLegacyMarkdownOutputInstructions,
  buildSimpleConversationalOutputInstructions,
  ensureMarkdownSections,
  isSimpleConversationalTurn,
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

describe("isSimpleConversationalTurn", () => {
  it("matches short acknowledgements", () => {
    expect(isSimpleConversationalTurn("Thanks")).toBe(true);
    expect(isSimpleConversationalTurn("thank you!")).toBe(true);
    expect(isSimpleConversationalTurn("ok")).toBe(true);
    expect(isSimpleConversationalTurn("perfect.")).toBe(true);
  });

  it("does not match task-like or long messages", () => {
    expect(
      isSimpleConversationalTurn("Analyze this image and improve the creative direction")
    ).toBe(false);
    expect(isSimpleConversationalTurn("Thanks for the prompt, now refine the campaign")).toBe(
      false
    );
    expect(isSimpleConversationalTurn("")).toBe(false);
  });
});

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
      },
      "Analyze this image and improve the creative direction"
    );
    expect(text).toContain("### Creative direction");
    expect(text).toContain("### Final prompt");
    expect(text).not.toMatch(/^## Result/m);
    expect(text).not.toBe(buildLegacyMarkdownOutputInstructions());
  });

  it("uses conversational instructions for simple acknowledgements", () => {
    const text = buildChatOutputInstructions({ outputSchema: null }, baseOutputConfig, "Thanks");
    expect(text).toBe(buildSimpleConversationalOutputInstructions());
    expect(text).not.toBe(buildLegacyMarkdownOutputInstructions());
  });

  it("uses flexible markdown when requiredSections is empty and the turn is not simple", () => {
    const text = buildChatOutputInstructions(
      { outputSchema: null },
      baseOutputConfig,
      "Analyze this image and improve the creative direction"
    );
    expect(text).toBe(buildFlexibleMarkdownOutputInstructions());
    expect(text).not.toBe(buildLegacyMarkdownOutputInstructions());
  });

  it("prefers conversational instructions over custom sections for simple turns", () => {
    const text = buildChatOutputInstructions(
      { outputSchema: null },
      {
        ...baseOutputConfig,
        requiredSections: ["Creative direction", "Final prompt"],
      },
      "Thanks"
    );
    expect(text).toBe(buildSimpleConversationalOutputInstructions());
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

  it("does not inject legacy headings for simple conversational turns", () => {
    const output = ensureMarkdownSections("You're welcome!", [], "Thanks");
    expect(output).toBe("You're welcome!");
    expect(output).not.toContain("## Result");
  });

  it("does not inject legacy headings when no custom sections are configured", () => {
    const output = ensureMarkdownSections("plain answer", []);
    expect(output).toBe("plain answer");
    expect(output).not.toContain("## Result");
  });
});

describe("shouldEnforceLegacyMarkdownSections", () => {
  it("is false for JSON agents, custom-section markdown agents, and legacy markdown agents", () => {
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
    expect(
      shouldEnforceLegacyMarkdownSections({ outputSchema: null }, baseOutputConfig)
    ).toBe(false);
  });

  it("is false for simple conversational turns", () => {
    expect(
      shouldEnforceLegacyMarkdownSections({ outputSchema: null }, baseOutputConfig, "Thanks")
    ).toBe(false);
  });
});
