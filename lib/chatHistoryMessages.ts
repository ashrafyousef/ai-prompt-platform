import type { Prisma } from "@prisma/client";
import type { UiMessage } from "@/lib/types";

export type ChatHistoryMessageRecord = {
  id: string;
  role: string;
  content: string;
  imageUrls: Prisma.JsonValue | null;
  agentConfigId: string | null;
  editedFromId: string | null;
  regenOfId: string | null;
  turnId: string | null;
  deliveryStatus: UiMessage["deliveryStatus"];
  retryOfAssistantMessageId: string | null;
  attemptIndex: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string | null;
  model: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  agentConfig?: { id: string; name: string } | null;
};

function normalizeImageUrls(value: Prisma.JsonValue | null): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value.filter((item): item is string => typeof item === "string" && item.length > 0);
  return urls.length > 0 ? urls : undefined;
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** Maps persisted chat rows to client history messages with optional agent attribution. */
export function serializeChatHistoryMessage(row: ChatHistoryMessageRecord): UiMessage {
  const role =
    row.role === "user" || row.role === "assistant" || row.role === "system"
      ? row.role
      : "assistant";

  const agentName =
    role === "assistant" && row.agentConfig?.name?.trim()
      ? row.agentConfig.name.trim()
      : undefined;

  return {
    id: row.id,
    role,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    imageUrls: normalizeImageUrls(row.imageUrls),
    agentConfigId: row.agentConfigId,
    agentName,
    turnId: row.turnId ?? undefined,
    deliveryStatus: row.deliveryStatus,
    retryOfAssistantMessageId: row.retryOfAssistantMessageId,
    attemptIndex: row.attemptIndex,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    provider: row.provider,
    model: row.model,
    startedAt: toIso(row.startedAt),
    completedAt: toIso(row.completedAt),
    failedAt: toIso(row.failedAt),
  };
}
