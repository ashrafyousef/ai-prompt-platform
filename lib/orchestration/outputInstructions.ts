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

const SIMPLE_CONVERSATIONAL_PATTERN =
  /^(thanks|thank you|thx|ty|ok|okay|k|great|good|nice|perfect|done|cool|awesome|got it|sounds good)[!.?\s]*$/i;

/** Very short acknowledgements only — not long prompts that happen to include "thanks". */
export function isSimpleConversationalTurn(userInput: string): boolean {
  const trimmed = userInput.trim();
  if (!trimmed || trimmed.length > 48) return false;
  if (
    /\b(analyze|campaign|create|direction|generate|image|improve|make|prompt|refine)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }
  return SIMPLE_CONVERSATIONAL_PATTERN.test(trimmed);
}

export function buildSimpleConversationalOutputInstructions(): string {
  return "The user sent a simple conversational message. Reply naturally and briefly in plain language. Do not use ## Result, ## Details, or other forced markdown section templates.";
}

export function buildFlexibleMarkdownOutputInstructions(): string {
  return [
    "Follow the agent system prompt for response structure.",
    "Use structured markdown sections when the user's task calls for creative direction, prompts, or analysis.",
    "For direct questions, answer clearly without forcing extra wrapper sections.",
    "Do not use ## Result or ## Details unless explicitly appropriate for the task.",
  ].join(" ");
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
  outputConfig: AgentOutputConfig,
  userInput?: string
): string {
  if (requiresJsonOutput(agent)) {
    return buildJsonOutputInstructions(agent.outputSchema);
  }

  if (userInput && isSimpleConversationalTurn(userInput)) {
    return buildSimpleConversationalOutputInstructions();
  }

  const sections = normalizeRequiredSections(outputConfig.requiredSections);
  if (sections.length === 0) {
    return buildFlexibleMarkdownOutputInstructions();
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
  outputConfig: AgentOutputConfig,
  userInput?: string
): boolean {
  if (requiresJsonOutput(agent)) return false;
  if (userInput && isSimpleConversationalTurn(userInput)) return false;
  return false;
}

/**
 * Post-process markdown when legacy ## Result / ## Details enforcement applies.
 * Skips mutation when the agent defines custom requiredSections.
 */
export function ensureMarkdownSections(
  output: string,
  requiredSections: string[],
  userInput?: string
): string {
  if (hasCustomRequiredSections({ requiredSections })) {
    return output.trim();
  }

  if (userInput && isSimpleConversationalTurn(userInput)) {
    return output.trim();
  }

  return output.trim();
}
