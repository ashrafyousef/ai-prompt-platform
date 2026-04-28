import type { AgentKnowledgeItem } from "@/lib/agentConfig";

export type KnowledgeInjectionMeta = {
  totalItems: number;
  activeItems: number;
  injectedItems: number;
  truncated: boolean;
  injectedChars: number;
};

export type KnowledgeInjectionTelemetry = {
  totalItems: number;
  activeItems: number;
  injectedItems: number;
  injectedChars: number;
  truncated: boolean;
};

type BuildKnowledgeBlockOptions = {
  maxTotalChars?: number;
  maxItemChars?: number;
};

const DEFAULT_MAX_TOTAL_CHARS = 8000;
const DEFAULT_MAX_ITEM_CHARS = 1200;

export function buildInjectedKnowledgeBlock(
  items: AgentKnowledgeItem[],
  options: BuildKnowledgeBlockOptions = {}
): { block: string; meta: KnowledgeInjectionMeta } {
  const maxTotalChars = options.maxTotalChars ?? DEFAULT_MAX_TOTAL_CHARS;
  const maxItemChars = options.maxItemChars ?? DEFAULT_MAX_ITEM_CHARS;

  const active = items.filter((item) => item.isActive);
  if (active.length === 0) {
    return {
      block: "",
      meta: {
        totalItems: items.length,
        activeItems: 0,
        injectedItems: 0,
        truncated: false,
        injectedChars: 0,
      },
    };
  }

  let used = 0;
  let truncated = false;
  const lines: string[] = [];

  for (const item of active) {
    const body = item.content?.trim()
      ? item.content.trim().slice(0, maxItemChars)
      : `[Uploaded file: ${item.fileRef?.fileName ?? "unknown"}]`;
    const chunk = `### ${item.title}\nType: ${item.sourceType}\n${body}`;
    if (used + chunk.length > maxTotalChars) {
      truncated = true;
      break;
    }
    lines.push(chunk);
    used += chunk.length;
  }

  const block = lines.length > 0 ? `Reference Knowledge:\n${lines.join("\n\n")}` : "";

  return {
    block,
    meta: {
      totalItems: items.length,
      activeItems: active.length,
      injectedItems: lines.length,
      truncated,
      injectedChars: block.length,
    },
  };
}

export function toKnowledgeInjectionTelemetry(
  meta: KnowledgeInjectionMeta | null | undefined
): KnowledgeInjectionTelemetry | null {
  if (!meta) return null;
  return {
    totalItems: meta.totalItems,
    activeItems: meta.activeItems,
    injectedItems: meta.injectedItems,
    injectedChars: meta.injectedChars,
    truncated: meta.truncated,
  };
}
