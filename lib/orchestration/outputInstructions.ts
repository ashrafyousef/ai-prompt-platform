import type { AgentOutputConfig } from "@/lib/agentConfig";
import type { AgentConfig } from "@prisma/client";
import { requiresJsonOutput } from "@/lib/orchestration/agentContract";

export const LEGACY_MARKDOWN_HEADINGS = ["Result", "Details"] as const;

export function normalizeRequiredSections(
  sections: string[] | undefined | null
): string[] {
  if (!Array.isArray(sections)) return [];
  return sections.map((section) => section.trim()).filter(Boolean);
}

export function hasCustomRequiredSections(
  outputConfig: Pick<AgentOutputConfig, "requiredSections">
): boolean {
  return normalizeRequiredSections(outputConfig.requiredSections).length > 0;
}

export function buildJsonOutputInstructions(outputSchema: unknown): string {
  return `Return valid JSON only. Required schema: ${JSON.stringify(outputSchema)}`;
}

export function buildLegacyMarkdownOutputInstructions(): string {
  return "Return markdown with clear sections:\n## Result\n...\n## Details\n...";
}

function appendOutputConfigHints(parts: string[], outputConfig: AgentOutputConfig): void {
  if (outputConfig.format === "template" && outputConfig.template?.trim()) {
    parts.push(`Use this response template:\n${outputConfig.template.trim()}`);
  }

  if (outputConfig.responseDepth === "brief") {
    parts.push("Keep the response concise and brief.");
  } else if (outputConfig.responseDepth === "detailed") {
    parts.push("Provide a thorough, detailed response.");
  }

  if (outputConfig.citationsPolicy === "required") {
    parts.push("You must cite your sources when referencing knowledge.");
  } else if (outputConfig.citationsPolicy === "optional") {
    parts.push("Cite sources when helpful.");
  }

  if (outputConfig.fallbackBehavior?.trim()) {
    parts.push(`If you cannot fully answer: ${outputConfig.fallbackBehavior.trim()}`);
  }
}

/** System-message output instructions for production chat (markdown / JSON). */
export function buildChatOutputInstructions(
  agent: Pick<AgentConfig, "outputSchema">,
  outputConfig: AgentOutputConfig
): string {
  if (requiresJsonOutput(agent)) {
    return buildJsonOutputInstructions(agent.outputSchema);
  }

  const sections = normalizeRequiredSections(outputConfig.requiredSections);
  if (sections.length === 0) {
    return buildLegacyMarkdownOutputInstructions();
  }

  const parts: string[] = [
    "Return markdown using these ### section headings in order:",
    ...sections.map((title) => `### ${title}`),
    "Use the section titles exactly as written. Do not add ## Result, ## Details, or other sections unless they are listed above.",
    'For sections that deliver a copy-ready prompt (for example "Final prompt"), put the prompt in a fenced ```text``` code block.',
  ];
  appendOutputConfigHints(parts, outputConfig);
  return parts.join("\n");
}

export function shouldEnforceLegacyMarkdownSections(
  agent: Pick<AgentConfig, "outputSchema">,
  outputConfig: AgentOutputConfig
): boolean {
  if (requiresJsonOutput(agent)) return false;
  return !hasCustomRequiredSections(outputConfig);
}

/**
 * Post-process markdown when legacy ## Result / ## Details enforcement applies.
 * Skips mutation when the agent defines custom requiredSections.
 */
export function ensureMarkdownSections(
  output: string,
  requiredSections: string[]
): string {
  if (hasCustomRequiredSections({ requiredSections })) {
    return output.trim();
  }

  const trimmed = output.trim();
  const hasResult = /^##\s*Result\b/im.test(trimmed);
  const hasDetails = /^##\s*Details\b/im.test(trimmed);
  if (hasResult && hasDetails) return trimmed;
  return `## Result\n${trimmed || "No result provided."}\n\n## Details\n- Generated in markdown structured mode.`;
}
