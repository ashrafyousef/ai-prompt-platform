import type { UiStarterPrompt } from "@/lib/types";

/** Derive a short card label from prompt text when no explicit label exists. */
export function buildStarterLabelFromPrompt(prompt: string, index: number): string {
  const compact = prompt.replace(/\s+/g, " ").trim();
  const sentence = compact.split(/[.!?]/)[0]?.trim() ?? "";
  if (!sentence) return `Starter ${index + 1}`;
  return sentence.length > 56 ? `${sentence.slice(0, 53)}…` : sentence;
}

/**
 * Source of truth for **chat starter prompts**: reads `inputSchema.starterPrompts` as stored on the agent.
 * Supports string entries (admin wizard) and structured objects for future/admin-extended configs.
 *
 * **Distinct from `inputSchema.examples`:** starters are short user-facing suggestions; exemplars are admin-only
 * input/ideal pairs for design and QA — see {@link AgentBuilderInputSchema} in `agentConfig.ts`.
 */
export function parseStarterPromptsFromAgentInputSchema(
  rawInputSchema: unknown,
  fallbackCategory: string | null
): UiStarterPrompt[] {
  const base =
    rawInputSchema && typeof rawInputSchema === "object"
      ? (rawInputSchema as Record<string, unknown>)
      : {};
  const raw = base.starterPrompts;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const out: UiStarterPrompt[] = [];
  let stringIndex = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const item = raw[i];
    if (typeof item === "string") {
      const prompt = item.trim();
      if (!prompt) continue;
      stringIndex += 1;
      out.push({
        id: `starter-${stringIndex}`,
        label: buildStarterLabelFromPrompt(prompt, stringIndex),
        prompt,
        category: fallbackCategory,
        order: stringIndex,
        isActive: true,
      });
      continue;
    }
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
      if (!prompt) continue;
      stringIndex += 1;
      const id =
        typeof o.id === "string" && o.id.trim().length > 0
          ? o.id.trim()
          : `starter-${stringIndex}`;
      const labelRaw = typeof o.label === "string" ? o.label.trim() : "";
      const label =
        labelRaw.length > 0 ? labelRaw : buildStarterLabelFromPrompt(prompt, stringIndex);
      const category =
        typeof o.category === "string" && o.category.trim().length > 0
          ? o.category.trim()
          : fallbackCategory;
      const order =
        typeof o.order === "number" && Number.isFinite(o.order) ? o.order : stringIndex;
      const isActive = typeof o.isActive === "boolean" ? o.isActive : true;
      out.push({ id, label, prompt, category, order, isActive });
    }
  }

  out.sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER));
  return out;
}
