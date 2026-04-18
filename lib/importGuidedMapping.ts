import type { KnowledgeSource } from "@/hooks/useAgentWizard";

function parseKeyValueLine(line: string): { key: string; value: string } | null {
  const match = line.match(/^([a-zA-Z][a-zA-Z _-]{1,40}):\s*(.+)$/);
  if (!match) return null;
  return { key: match[1].trim().toLowerCase(), value: match[2].trim() };
}

function toKnowledgeCandidate(id: string, title: string, content: string): KnowledgeSource {
  return {
    id,
    sourceType: "manual_text",
    title,
    content,
    fileRef: null,
    summary: "",
    tags: [],
    priority: 3,
    appliesTo: "all",
    isActive: true,
    ownerNote: "Imported from guided extraction",
    lastReviewedAt: null,
    status: "ready",
  };
}

export function mapGuidedImportText(rawText: string) {
  const text = rawText.trim();
  const warnings: string[] = [];
  if (!text) {
    return {
      name: "",
      description: "",
      behaviorNotes: "",
      starterPrompts: [] as string[],
      knowledgeCandidates: [] as KnowledgeSource[],
      unmappedText: "",
      warnings: ["Paste content to generate suggested mappings."],
    };
  }
  if (text.length < 120) {
    warnings.push("Input is short; suggestions may be incomplete.");
  }
  if (text.length > 20000) {
    warnings.push("Large input detected; only the first relevant sections may be mapped.");
  }

  const lines = text.split(/\r?\n/);
  let name = "";
  let description = "";
  const behaviorLines: string[] = [];
  const starterPrompts: string[] = [];
  const knowledgeCandidates: KnowledgeSource[] = [];
  const unmapped: string[] = [];

  let mode: "general" | "behavior" | "starter" | "knowledge" = "general";
  let kIndex = 0;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const heading = trimmed.toLowerCase();
    if (heading.includes("starter prompt") || heading.includes("example prompt")) {
      mode = "starter";
      return;
    }
    if (
      heading.includes("knowledge") ||
      heading.includes("faq") ||
      heading.includes("context") ||
      heading.includes("glossary") ||
      heading.includes("rules")
    ) {
      mode = "knowledge";
      return;
    }
    if (
      heading.includes("system prompt") ||
      heading.includes("behavior") ||
      heading.includes("instructions") ||
      heading.includes("tone") ||
      heading.includes("avoid")
    ) {
      mode = "behavior";
      return;
    }

    const kv = parseKeyValueLine(trimmed);
    if (kv) {
      if (kv.key.includes("name") || kv.key.includes("title")) {
        if (!name) name = kv.value;
        else unmapped.push(trimmed);
        return;
      }
      if (kv.key.includes("description") || kv.key.includes("summary")) {
        if (!description) description = kv.value;
        else unmapped.push(trimmed);
        return;
      }
      if (kv.key.includes("starter")) {
        kv.value
          .split(/[|;]/)
          .map((item) => item.trim())
          .filter(Boolean)
          .forEach((item) => starterPrompts.push(item));
        return;
      }
      if (kv.key.includes("knowledge") || kv.key.includes("faq") || kv.key.includes("context")) {
        knowledgeCandidates.push(
          toKnowledgeCandidate(`guided-k-${++kIndex}`, kv.key, kv.value)
        );
        return;
      }
      if (
        kv.key.includes("behavior") ||
        kv.key.includes("instruction") ||
        kv.key.includes("tone") ||
        kv.key.includes("avoid")
      ) {
        behaviorLines.push(`${kv.key}: ${kv.value}`);
        return;
      }
    }

    if (mode === "starter" && (trimmed.startsWith("-") || trimmed.startsWith("*"))) {
      starterPrompts.push(trimmed.replace(/^[-*]\s*/, "").trim());
      return;
    }
    if (mode === "knowledge") {
      knowledgeCandidates.push(
        toKnowledgeCandidate(`guided-k-${++kIndex}`, `Knowledge candidate ${kIndex}`, trimmed)
      );
      return;
    }
    if (mode === "behavior") {
      behaviorLines.push(trimmed);
      return;
    }

    unmapped.push(trimmed);
  });

  const dedupStarterPrompts = Array.from(new Set(starterPrompts)).slice(0, 12);

  return {
    name: name.trim(),
    description: description.trim(),
    behaviorNotes: behaviorLines.join("\n").trim(),
    starterPrompts: dedupStarterPrompts,
    knowledgeCandidates: knowledgeCandidates.slice(0, 12),
    unmappedText: unmapped.join("\n"),
    warnings,
  };
}
