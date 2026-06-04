/**
 * Display-only filtering for chat history: one visible assistant message per turn.
 * Older assistant attempts remain in the database; they are omitted from the main list.
 */

export type ChatMessageForDisplay = {
  id: string;
  role: string;
  turnId?: string | null;
  attemptIndex?: number | null;
  createdAt: string | Date;
};

function createdAtMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

/** True when `challenger` should replace `current` as the visible attempt for a turn. */
export function isNewerAssistantAttempt(
  current: ChatMessageForDisplay,
  challenger: ChatMessageForDisplay
): boolean {
  const currentIdx = current.attemptIndex ?? 0;
  const challengerIdx = challenger.attemptIndex ?? 0;
  if (challengerIdx !== currentIdx) return challengerIdx > currentIdx;
  return createdAtMs(challenger.createdAt) > createdAtMs(current.createdAt);
}

/**
 * Returns messages in input order, hiding older assistant rows that share a turnId.
 * User/system rows are always kept. Assistants without turnId are kept (legacy rows).
 */
export function selectVisibleChatMessages<T extends ChatMessageForDisplay>(
  messages: T[]
): T[] {
  const latestAssistantByTurn = new Map<string, T>();
  const hiddenAssistantIds = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    const turnId = message.turnId?.trim();
    if (!turnId) continue;

    const existing = latestAssistantByTurn.get(turnId);
    if (!existing) {
      latestAssistantByTurn.set(turnId, message);
      continue;
    }
    if (isNewerAssistantAttempt(existing, message)) {
      hiddenAssistantIds.add(existing.id);
      latestAssistantByTurn.set(turnId, message);
    } else {
      hiddenAssistantIds.add(message.id);
    }
  }

  return messages.filter((message) => {
    if (message.role !== "assistant") return true;
    const turnId = message.turnId?.trim();
    if (!turnId) return true;
    return !hiddenAssistantIds.has(message.id);
  });
}
