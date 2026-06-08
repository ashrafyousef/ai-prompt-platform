import { describe, expect, it } from "vitest";
import { MODEL_REGISTRY_DEFINITIONS } from "@/lib/models";
import { getPricingForRegistryModelId } from "@/lib/pricing";

describe("pricing coverage", () => {
  it("every registry model id has a pricing entry", () => {
    for (const model of MODEL_REGISTRY_DEFINITIONS) {
      expect(getPricingForRegistryModelId(model.id)).not.toBeNull();
    }
  });

  it("each pricing entry has non-null input and output rates", () => {
    for (const model of MODEL_REGISTRY_DEFINITIONS) {
      const pricing = getPricingForRegistryModelId(model.id);
      expect(pricing).not.toBeNull();
      expect(pricing?.inputPer1M).not.toBeNull();
      expect(pricing?.outputPer1M).not.toBeNull();
      expect(typeof pricing?.inputPer1M).toBe("number");
      expect(typeof pricing?.outputPer1M).toBe("number");
    }
  });

  it("openai-gpt-5.5 matches official Standard API rates", () => {
    const pricing = getPricingForRegistryModelId("openai-gpt-5.5");
    expect(pricing?.inputPer1M).toBe(5.0);
    expect(pricing?.cachedInputPer1M).toBe(0.5);
    expect(pricing?.outputPer1M).toBe(30.0);
  });

  it("openai-gpt-5.4 matches official Standard API rates", () => {
    const pricing = getPricingForRegistryModelId("openai-gpt-5.4");
    expect(pricing?.inputPer1M).toBe(2.5);
    expect(pricing?.cachedInputPer1M).toBe(0.25);
    expect(pricing?.outputPer1M).toBe(15.0);
  });

  it("openai-gpt-5.4-mini matches official Standard API rates", () => {
    const pricing = getPricingForRegistryModelId("openai-gpt-5.4-mini");
    expect(pricing?.inputPer1M).toBe(0.75);
    expect(pricing?.cachedInputPer1M).toBe(0.075);
    expect(pricing?.outputPer1M).toBe(4.5);
  });
});
