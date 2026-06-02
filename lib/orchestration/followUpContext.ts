import type { Message } from "@prisma/client";
import { isSimpleConversationalTurn } from "@/lib/orchestration/outputInstructions";

/** Shared orchestration guidance for all agents — not a phrase trigger list. */
export const FOLLOW_UP_CONTEXT_SYSTEM_RULE =
  "When the user sends a short confirmation, continuation, or refinement request, treat it as connected to the recent conversation. Use the most recent relevant user instruction, uploaded file/image, assistant proposal, draft, or prompt to continue the work. Do not ask the user to repeat details already present in the conversation unless the context is genuinely ambiguous. If there are multiple possible targets, ask one concise clarification question.";

const SHORT_FOLLOW_UP_MAX_CHARS = 80;
const SHORT_FOLLOW_UP_MAX_WORDS = 6;

/**
 * Very short, non-acknowledgement turns that usually continue prior work
 * (for example "go ahead", "yes", "same style") — length-based, not phrase-matched.
 */
export function isShortFollowUpStyleTurn(userInput: string): boolean {
  const trimmed = userInput.trim();
  if (!trimmed || trimmed.length > SHORT_FOLLOW_UP_MAX_CHARS) return false;
  if (isSimpleConversationalTurn(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words.length > 0 && words.length <= SHORT_FOLLOW_UP_MAX_WORDS;
}

export function shouldIncludeFollowUpContextGuidance(
  userInput: string,
  history: Message[]
): boolean {
  if (history.length <= 1) return false;
  if (isSimpleConversationalTurn(userInput)) return false;
  return true;
}

/** System message content for follow-up context, or null when not applicable. */
export function buildFollowUpContextSystemMessage(
  userInput: string,
  history: Message[]
): string | null {
  if (!shouldIncludeFollowUpContextGuidance(userInput, history)) return null;

  const parts = [FOLLOW_UP_CONTEXT_SYSTEM_RULE];
  if (isShortFollowUpStyleTurn(userInput)) {
    parts.push(
      "The latest user message is brief; interpret it in light of the preceding turns and continue the in-progress work rather than restarting."
    );
  }
  return parts.join("\n\n");
}
