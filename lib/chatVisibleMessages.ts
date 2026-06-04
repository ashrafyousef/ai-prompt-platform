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

/** Group key for one user turn's assistant attempts (explicit turnId or nearest preceding user). */
export function assistantTurnGroupKey(
  message: ChatMessageForDisplay,
  lastUserTurnKey: string | null
): string | null {
  if (message.role !== "assistant") return null;
  const explicit = message.turnId?.trim();
  if (explicit) return explicit;
  return lastUserTurnKey;
}

/**
 * Returns messages in input order, hiding older assistant rows in the same turn group.
 * User/system rows are always kept. Ungroupable orphan assistants are kept (legacy rows).
 */
export function selectVisibleChatMessages<T extends ChatMessageForDisplay>(
  messages: T[]
): T[] {
  const latestAssistantByTurn = new Map<string, T>();
  const hiddenAssistantIds = new Set<string>();
  let lastUserTurnKey: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      lastUserTurnKey = message.turnId?.trim() || message.id;
      continue;
    }
    if (message.role !== "assistant") continue;

    const groupKey = assistantTurnGroupKey(message, lastUserTurnKey);
    if (!groupKey) continue;

    const existing = latestAssistantByTurn.get(groupKey);
    if (!existing) {
      latestAssistantByTurn.set(groupKey, message);
      continue;
    }
    if (isNewerAssistantAttempt(existing, message)) {
      hiddenAssistantIds.add(existing.id);
      latestAssistantByTurn.set(groupKey, message);
    } else {
      hiddenAssistantIds.add(message.id);
    }
  }

  return messages.filter((message) => {
    if (message.role !== "assistant") return true;
    return !hiddenAssistantIds.has(message.id);
  });
}
