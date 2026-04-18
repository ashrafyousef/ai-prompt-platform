import { z } from "zod";

export const knowledgeSourceTypeValues = [
  "manual_text",
  "faq",
  "pdf",
  "docx",
  "txt",
  "glossary",
  "rules",
  "examples",
] as const;

export type AgentKnowledgeSourceType = (typeof knowledgeSourceTypeValues)[number];

export const knowledgeProcessingStatusValues = [
  "pending",
  "ready",
  "processing",
  "indexed",
  "failed",
] as const;
export type KnowledgeProcessingStatus = (typeof knowledgeProcessingStatusValues)[number];

export const responseDepthValues = ["brief", "standard", "detailed"] as const;
export type AgentResponseDepth = (typeof responseDepthValues)[number];

export const citationsPolicyValues = ["none", "optional", "required"] as const;
export type AgentCitationsPolicy = (typeof citationsPolicyValues)[number];

export type AgentKnowledgeItem = {
  id: string;
  title: string;
  sourceType: AgentKnowledgeSourceType;
  content: string | null;
  fileRef: {
    fileName: string;
    mimeType?: string;
    sizeBytes?: number;
    url?: string;
  } | null;
  summary: string;
  tags: string[];
  priority: number;
  appliesTo: "all" | string;
  isActive: boolean;
  ownerNote: string;
  lastReviewedAt: string | null;
  processingStatus?: KnowledgeProcessingStatus;
};

export type AgentOutputConfig = {
  format: "markdown" | "json" | "template";
  requiredSections: string[];
  responseDepth: AgentResponseDepth;
  citationsPolicy: AgentCitationsPolicy;
  fallbackBehavior: string;
  template: string | null;
  schema: unknown | null;
};

export type AgentExemplar = {
  id: string;
  userMessage: string;
  idealResponse: string;
  notes: string;
};

export type AgentGuardrail = {
  id: string;
  rule: string;
  enforcement: "block" | "warn" | "log";
};

export type AgentMode = {
  id: string;
  name: string;
  description: string;
  systemPromptOverride: string | null;
  outputConfigOverride: Partial<AgentOutputConfig> | null;
};

export type AgentBuilderInputSchema = {
  version: number;
  starterPrompts: string[];
  knowledgeItems: AgentKnowledgeItem[];
  outputConfig: AgentOutputConfig;
  examples?: AgentExemplar[];
  guardrails?: AgentGuardrail[];
  modes?: AgentMode[];
  meta: {
    identity: { icon: string | null; category: string | null };
    behavior: {
      behaviorRules: string;
      toneGuidance: string;
      avoidRules: string;
      strictMode: boolean;
      importMethod: string | null;
    };
  };
};

const knowledgeSourceTypeSchema = z.enum(knowledgeSourceTypeValues);
const knowledgeProcessingStatusSchema = z.enum(knowledgeProcessingStatusValues);
const responseDepthSchema = z.enum(responseDepthValues);
const citationsPolicySchema = z.enum(citationsPolicyValues);

const fileRefSchema = z
  .object({
    fileName: z.string().min(1),
    mimeType: z.string().optional(),
    sizeBytes: z.number().int().positive().optional(),
    url: z.string().min(1).optional(),
  })
  .nullable();

export const agentKnowledgeItemSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    sourceType: knowledgeSourceTypeSchema,
    content: z.string().nullable().optional().default(null),
    fileRef: fileRefSchema.optional().default(null),
    summary: z.string().default(""),
    tags: z.array(z.string().min(1)).default([]),
    priority: z.number().int().min(1).max(5).default(3),
    appliesTo: z.union([z.literal("all"), z.string().min(1)]).default("all"),
    isActive: z.boolean().default(true),
    ownerNote: z.string().default(""),
    lastReviewedAt: z.string().datetime().nullable().optional().default(null),
    processingStatus: knowledgeProcessingStatusSchema.optional().default("ready"),
  })
  .superRefine((value, ctx) => {
    const hasContent = Boolean(value.content && value.content.trim().length > 0);
    const hasFileRef = Boolean(value.fileRef?.fileName);
    if (!hasContent && !hasFileRef) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Knowledge item requires content or file reference.",
      });
    }
  });

export const agentOutputConfigSchema = z.object({
  format: z.enum(["markdown", "json", "template"]).default("markdown"),
  requiredSections: z.array(z.string().min(1)).default([]),
  responseDepth: responseDepthSchema.default("standard"),
  citationsPolicy: citationsPolicySchema.default("none"),
  fallbackBehavior: z
    .string()
    .default("Provide a best-effort response in markdown when strict formatting cannot be satisfied."),
  template: z.string().nullable().optional(),
  schema: z.record(z.unknown()).nullable().optional(),
});

export const agentExemplarSchema = z.object({
  id: z.string().min(1),
  userMessage: z.string().min(1),
  idealResponse: z.string().min(1),
  notes: z.string().default(""),
});

export const agentGuardrailSchema = z.object({
  id: z.string().min(1),
  rule: z.string().min(1),
  enforcement: z.enum(["block", "warn", "log"]).default("warn"),
});

export const agentModeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().default(""),
  systemPromptOverride: z.string().nullable().default(null),
  outputConfigOverride: agentOutputConfigSchema.partial().nullable().default(null),
});

const legacyKnowledgeSourceSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  content: z.string().optional(),
});

export const agentBuilderInputSchema = z.object({
  version: z.number().int().min(1).default(2),
  starterPrompts: z.array(z.string().min(1)).default([]),
  knowledgeItems: z.array(agentKnowledgeItemSchema).default([]),
  outputConfig: agentOutputConfigSchema.default({
    format: "markdown",
    requiredSections: [],
    responseDepth: "standard",
    citationsPolicy: "none",
    fallbackBehavior:
      "Provide a best-effort response in markdown when strict formatting cannot be satisfied.",
    template: null,
    schema: null,
  }),
  examples: z.array(agentExemplarSchema).optional().default([]),
  guardrails: z.array(agentGuardrailSchema).optional().default([]),
  modes: z.array(agentModeSchema).optional().default([]),
  meta: z
    .object({
      identity: z
        .object({
          icon: z.string().nullable().default(null),
          category: z.string().nullable().default(null),
        })
        .default({ icon: null, category: null }),
      behavior: z
        .object({
          behaviorRules: z.string().default(""),
          toneGuidance: z.string().default(""),
          avoidRules: z.string().default(""),
          strictMode: z.boolean().default(false),
          importMethod: z.string().nullable().default(null),
        })
        .default({
          behaviorRules: "",
          toneGuidance: "",
          avoidRules: "",
          strictMode: false,
          importMethod: null,
        }),
    })
    .default({
      identity: { icon: null, category: null },
      behavior: {
        behaviorRules: "",
        toneGuidance: "",
        avoidRules: "",
        strictMode: false,
        importMethod: null,
      },
    }),
});

function mapLegacySourceType(value?: string): AgentKnowledgeSourceType {
  switch (value) {
    case "text":
      return "manual_text";
    case "file":
      return "txt";
    case "faq":
      return "faq";
    case "pdf":
      return "pdf";
    case "docx":
      return "docx";
    case "txt":
      return "txt";
    case "glossary":
      return "glossary";
    case "rules":
      return "rules";
    case "examples":
      return "examples";
    default:
      return "manual_text";
  }
}

export function normalizeAgentInputSchema(raw: unknown): AgentBuilderInputSchema {
  const base =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const parsed = agentBuilderInputSchema.safeParse(base);
  const starterPromptsRaw = parsed.success
    ? parsed.data.starterPrompts
    : Array.isArray(base.starterPrompts)
    ? base.starterPrompts
    : [];
  const starterPrompts = starterPromptsRaw
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  const modernKnowledge = parsed.success ? parsed.data.knowledgeItems : [];
  const legacyKnowledgeRaw = Array.isArray(base.knowledge) ? base.knowledge : [];
  const legacyKnowledge = legacyKnowledgeRaw
    .map((entry, index) => {
      const source = legacyKnowledgeSourceSchema.safeParse(entry);
      if (!source.success) return null;
      const content = (source.data.content ?? "").trim();
      if (!content) return null;
      return {
        id: `legacy-${index}`,
        title: source.data.title?.trim() || `Knowledge item ${index + 1}`,
        sourceType: mapLegacySourceType(source.data.type),
        content,
        fileRef: null,
        summary: "",
        tags: [],
        priority: 3,
        appliesTo: "all" as const,
        isActive: true,
        ownerNote: "",
        lastReviewedAt: null,
        processingStatus: "ready",
      } satisfies AgentKnowledgeItem;
    })
    .filter(Boolean) as AgentKnowledgeItem[];

  const knowledgeItems = modernKnowledge.length > 0 ? modernKnowledge : legacyKnowledge;

  const iconFromLegacy =
    typeof base.icon === "string" && base.icon.trim().length > 0
      ? base.icon.trim()
      : null;
  const categoryFromLegacy =
    typeof base.category === "string" && base.category.trim().length > 0
      ? base.category.trim()
      : null;

  const outputConfig =
    parsed.success
      ? parsed.data.outputConfig
      : agentOutputConfigSchema.parse({});

  const meta = parsed.success
    ? parsed.data.meta
    : {
        identity: { icon: null, category: null },
        behavior: {
          behaviorRules: "",
          toneGuidance: "",
          avoidRules: "",
          strictMode: false,
          importMethod: null,
        },
      };

  const examples = parsed.success ? (parsed.data.examples ?? []) : [];
  const guardrails = parsed.success ? (parsed.data.guardrails ?? []) : [];
  const modes = parsed.success ? (parsed.data.modes ?? []) : [];

  return {
    version: 2,
    starterPrompts,
    knowledgeItems,
    outputConfig: {
      ...outputConfig,
      template: outputConfig.template ?? null,
      schema: outputConfig.schema ?? null,
    },
    examples,
    guardrails,
    modes,
    meta: {
      identity: {
        icon: meta.identity.icon ?? iconFromLegacy,
        category: meta.identity.category ?? categoryFromLegacy,
      },
      behavior: meta.behavior,
    },
  };
}
