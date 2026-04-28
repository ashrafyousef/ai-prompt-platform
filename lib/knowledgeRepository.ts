import type { Prisma } from "@prisma/client";
import { normalizeAgentInputSchema, type AgentKnowledgeItem } from "@/lib/agentConfig";

type AgentKnowledgeBridgeInput = {
  agentId: string;
  workspaceId: string;
  teamId: string | null;
  inputSchema: Prisma.JsonValue | null;
};

function toSortOrder(index: number): number {
  return index >= 0 ? index : 0;
}

export function extractKnowledgeItemsFromInputSchema(inputSchema: unknown): AgentKnowledgeItem[] {
  const normalized = normalizeAgentInputSchema(inputSchema);
  return normalized.knowledgeItems;
}

export async function replaceAgentKnowledgeFromInputSchema(
  tx: Prisma.TransactionClient,
  input: AgentKnowledgeBridgeInput
): Promise<void> {
  const items = extractKnowledgeItemsFromInputSchema(input.inputSchema);
  await tx.agentKnowledge.deleteMany({ where: { agentId: input.agentId } });

  if (items.length === 0) {
    return;
  }

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const knowledge = await tx.knowledgeItem.create({
      data: {
        workspaceId: input.workspaceId,
        teamId: input.teamId,
        title: item.title,
        sourceType: item.sourceType,
        content: item.content,
        fileRef: item.fileRef ?? undefined,
        summary: item.summary,
        tags: item.tags,
        priority: item.priority,
        appliesTo: item.appliesTo,
        isActive: item.isActive,
        ownerNote: item.ownerNote,
        lastReviewedAt: item.lastReviewedAt ? new Date(item.lastReviewedAt) : null,
        processingStatus: item.processingStatus ?? "ready",
      },
      select: { id: true },
    });

    await tx.agentKnowledge.create({
      data: {
        agentId: input.agentId,
        knowledgeId: knowledge.id,
        legacyItemId: item.id,
        sortOrder: toSortOrder(i),
      },
    });
  }
}

type RelationalKnowledgeLink = {
  legacyItemId: string | null;
  knowledge: {
    id: string;
    title: string;
    sourceType: string;
    content: string | null;
    fileRef: Prisma.JsonValue | null;
    summary: string;
    tags: Prisma.JsonValue | null;
    priority: number;
    appliesTo: string;
    isActive: boolean;
    ownerNote: string;
    lastReviewedAt: Date | null;
    processingStatus: string;
  };
};

type DualReadKnowledgeInput = {
  inputSchema: unknown;
  knowledgeLinks?: RelationalKnowledgeLink[];
};

function normalizeKnowledgeSourceType(sourceType: string): AgentKnowledgeItem["sourceType"] {
  const allowed = new Set([
    "manual_text",
    "faq",
    "pdf",
    "docx",
    "txt",
    "glossary",
    "rules",
    "examples",
  ]);
  return (allowed.has(sourceType) ? sourceType : "manual_text") as AgentKnowledgeItem["sourceType"];
}

function normalizeTags(tags: Prisma.JsonValue | null): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0);
}

export function resolveEffectiveAgentKnowledge(input: DualReadKnowledgeInput): AgentKnowledgeItem[] {
  const relational = input.knowledgeLinks ?? [];
  if (relational.length > 0) {
    return relational.map((link) => ({
      id: link.legacyItemId?.trim() || link.knowledge.id,
      title: link.knowledge.title,
      sourceType: normalizeKnowledgeSourceType(link.knowledge.sourceType),
      content: link.knowledge.content,
      fileRef:
        link.knowledge.fileRef && typeof link.knowledge.fileRef === "object"
          ? (link.knowledge.fileRef as AgentKnowledgeItem["fileRef"])
          : null,
      summary: link.knowledge.summary,
      tags: normalizeTags(link.knowledge.tags),
      priority: link.knowledge.priority,
      appliesTo: link.knowledge.appliesTo || "all",
      isActive: link.knowledge.isActive,
      ownerNote: link.knowledge.ownerNote,
      lastReviewedAt: link.knowledge.lastReviewedAt?.toISOString() ?? null,
      processingStatus: (link.knowledge.processingStatus || "ready") as AgentKnowledgeItem["processingStatus"],
    }));
  }
  return extractKnowledgeItemsFromInputSchema(input.inputSchema);
}
