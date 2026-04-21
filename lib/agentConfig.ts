/**
 * Agent builder `inputSchema` — normalization, Zod schemas, and `AgentBuilderInputSchema` type.
 *
 * **Model preferences:** Canonical JSON lives under `modelPreferences`; legacy `meta.modelPolicy` and loose keys are
 * merged in `normalizeAgentInputSchema` (see `agentModelPolicy.ts` module doc). Registry alignment runs via
 * `sanitizeModelPreferencesToRegistry` after merge.
 */
import { z } from "zod";
import { sanitizeModelPreferencesToRegistry } from "./agentModelGovernance";
import {
  agentModelPolicySchema,
  agentModelPreferencesSchema,
  mergeAgentModelPreferences,
  parseLegacyModelPolicyFields,
  type AgentModelPreferences,
  type AgentModelPolicy,
} from "./agentModelPolicy";

export type { AgentModelPolicy, AgentModelPreferences } from "./agentModelPolicy";

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

/**
 * Canonical admin example / exemplar row (stored under `inputSchema.examples`).
 * Legacy persisted rows used `userMessage` / `idealResponse` / `evaluationPrompt`; see {@link normalizeAgentInputSchema}.
 */
export type AgentExampleItem = {
  id: string;
  title: string;
  input: string;
  idealOutput: string;
  notes?: string;
  category?: string;
  isActive?: boolean;
  order?: number;
};

/** Admin-only seed prompts for evaluation workflows (not end-user starters). */
export type AgentEvaluationSeedPrompt = {
  id: string;
  title: string;
  prompt: string;
  category?: string;
  isActive?: boolean;
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

/** Admin-only quality / evaluation metadata (not shown to end users). */
export type AgentQualityMeta = {
  evaluationNotes: string;
  defaultEvaluationPrompt: string;
  /** Short phrases that lightweight checks can look for in test output. */
  qualityChecks: string[];
};

/**
 * Persisted `inputSchema` — **examples & evaluation layer** (mostly admin-only).
 *
 * - **`starterPrompts`** — End-user chat quick-starts; see `chatStarterPrompts.ts`. Not gold-standard pairs.
 * - **`examples`** — Admin exemplars (`input` + `idealOutput`): readiness, alignment hints, test-sandbox ideal
 *   comparison. Not shown as chat starters.
 * - **`evaluationSeedPrompts`** — Optional canned prompts for admin evaluation flows (distinct from starters).
 * - **`meta.quality`** — Notes, `defaultEvaluationPrompt`, `qualityChecks` for deterministic sandbox checks.
 *
 * **Defaults & shape:** {@link normalizeAgentInputSchema} is the single read path; {@link agentOutputConfigSchema}
 * supplies output defaults when missing. Empty `examples` / seeds are valid for older agents.
 *
 * **Admin flows:** Builder/edit (Examples, Quality tabs) → publish readiness (`adminExamplesReadiness`,
 * `adminExamplesAlignment`) → test sandbox (`findExampleMatchingPrompt`, `runLightweightQualityChecks`, session-only manual eval).
 *
 * **Readiness vs runtime:** Readiness helpers are advisory (they do not block saves). Chat/send uses normalized
 * config plus governance; examples are not automatically injected as few-shot unless a future feature wires that.
 *
 * **Future extension (out of scope today):** persisted evaluation history; automated scoring / LLM judges;
 * publish-time QA gates; versioned benchmark packs; per-model exemplar variants.
 */
export type AgentBuilderInputSchema = {
  version: number;
  starterPrompts: string[];
  knowledgeItems: AgentKnowledgeItem[];
  outputConfig: AgentOutputConfig;
  /** Canonical model preferences (JSON-serializable). */
  modelPreferences: AgentModelPreferences;
  /** Admin design-time examples / exemplars (canonical shape after normalize). */
  examples: AgentExampleItem[];
  /** Optional evaluation seed prompts (admin metadata; not starter prompts). */
  evaluationSeedPrompts: AgentEvaluationSeedPrompt[];
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
    quality?: AgentQualityMeta;
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

export const agentQualityMetaSchema = z.object({
  evaluationNotes: z.string().default(""),
  defaultEvaluationPrompt: z.string().default(""),
  qualityChecks: z.array(z.string().min(1).max(200)).max(20).default([]),
});

/** Strict validation for API writes (canonical example rows). */
export const agentExampleItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  input: z.string().min(1),
  idealOutput: z.string().min(1),
  notes: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  order: z.number().int().min(0).optional(),
});

export const agentEvaluationSeedPromptSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  prompt: z.string().min(1),
  category: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

/** @deprecated Use {@link agentExampleItemSchema}. */
export const agentExemplarSchema = agentExampleItemSchema;

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
  /** Accepts canonical items and legacy `{ userMessage, idealResponse, … }` rows; normalized output is always canonical. */
  examples: z.array(z.unknown()).optional().default([]),
  evaluationSeedPrompts: z.array(z.unknown()).optional().default([]),
  guardrails: z.array(agentGuardrailSchema).optional().default([]),
  modes: z.array(agentModeSchema).optional().default([]),
  modelPreferences: agentModelPreferencesSchema.optional(),
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
      quality: agentQualityMetaSchema.optional(),
      /** @deprecated Read only — merged into `modelPreferences` on normalize. */
      modelPolicy: agentModelPolicySchema.optional(),
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

/** Derive a short title from example input (first line, truncated). */
export function deriveAgentExampleTitle(input: string): string {
  const line = input.trim().split(/\n/)[0]?.trim() ?? "";
  if (!line) return "Exemplar";
  return line.length > 64 ? `${line.slice(0, 61)}…` : line;
}

function normalizeExampleItem(raw: unknown, index: number): AgentExampleItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const fromInput =
    typeof o.input === "string" && o.input.trim().length > 0 ? o.input.trim() : "";
  const fromUserMessage =
    typeof o.userMessage === "string" && o.userMessage.trim().length > 0 ? o.userMessage.trim() : "";
  const input = fromInput || fromUserMessage;

  const fromIdeal =
    typeof o.idealOutput === "string" && o.idealOutput.trim().length > 0 ? o.idealOutput.trim() : "";
  const fromLegacyIdeal =
    typeof o.idealResponse === "string" && o.idealResponse.trim().length > 0 ? o.idealResponse.trim() : "";
  const idealOutput = fromIdeal || fromLegacyIdeal;

  if (!input || !idealOutput) return null;

  const id =
    typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim() : `ex-${index}`;

  const hasTitle = typeof o.title === "string" && o.title.trim().length > 0;
  const title = hasTitle ? (o.title as string).trim() : deriveAgentExampleTitle(fromInput || fromUserMessage);

  let notes: string | undefined;
  const notesRaw = typeof o.notes === "string" ? o.notes.trim() : "";
  const legacyEval =
    typeof o.evaluationPrompt === "string" && o.evaluationPrompt.trim().length > 0
      ? (o.evaluationPrompt as string).trim()
      : "";
  if (notesRaw && legacyEval) {
    notes = `${notesRaw}\n\n[Evaluation prompt]\n${legacyEval}`;
  } else if (legacyEval) {
    notes = `[Evaluation prompt]\n${legacyEval}`;
  } else if (notesRaw) {
    notes = notesRaw;
  }

  const category =
    typeof o.category === "string" && o.category.trim().length > 0
      ? (o.category as string).trim()
      : undefined;
  const isActive = typeof o.isActive === "boolean" ? o.isActive : true;
  const order =
    typeof o.order === "number" && Number.isFinite(o.order) ? Math.max(0, Math.floor(o.order)) : index;

  const item: AgentExampleItem = {
    id,
    title,
    input,
    idealOutput,
    isActive,
    order,
  };
  if (notes !== undefined) item.notes = notes;
  if (category !== undefined) item.category = category;
  return item;
}

function normalizeExamplesList(raw: unknown): AgentExampleItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentExampleItem[] = [];
  for (let i = 0; i < raw.length; i++) {
    const one = normalizeExampleItem(raw[i], i);
    if (one) out.push(one);
  }
  return out;
}

function normalizeEvaluationSeedItem(raw: unknown, index: number): AgentEvaluationSeedPrompt | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id =
    typeof o.id === "string" && o.id.trim().length > 0 ? o.id.trim() : `eseed-${index}`;
  const title = typeof o.title === "string" ? o.title.trim() : "";
  const prompt = typeof o.prompt === "string" ? o.prompt.trim() : "";
  if (!title || !prompt) return null;
  const category =
    typeof o.category === "string" && o.category.trim().length > 0
      ? (o.category as string).trim()
      : undefined;
  const isActive = typeof o.isActive === "boolean" ? o.isActive : true;
  const item: AgentEvaluationSeedPrompt = { id, title, prompt, isActive };
  if (category !== undefined) item.category = category;
  return item;
}

function normalizeEvaluationSeedPromptsList(raw: unknown): AgentEvaluationSeedPrompt[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentEvaluationSeedPrompt[] = [];
  for (let i = 0; i < raw.length; i++) {
    const one = normalizeEvaluationSeedItem(raw[i], i);
    if (one) out.push(one);
  }
  return out;
}

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

/**
 * Single read path for persisted `inputSchema`: merges modern + legacy knowledge, identity, and **model
 * preferences** (`parseLegacyModelPolicyFields` + `meta.modelPolicy` + root `modelPreferences` →
 * `mergeAgentModelPreferences` → `sanitizeModelPreferencesToRegistry`). Callers: APIs, chat orchestration, admin.
 *
 * Also normalizes **examples**, **evaluationSeedPrompts**, and **quality** meta (legacy exemplar field names →
 * canonical `AgentExampleItem`). See {@link AgentBuilderInputSchema} for how those fields relate to starters and runtime.
 */
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

  const rawMeta =
    base && typeof base === "object" && "meta" in base && base.meta && typeof base.meta === "object"
      ? (base.meta as Record<string, unknown>)
      : null;
  const qualityFromRaw =
    rawMeta && "quality" in rawMeta
      ? agentQualityMetaSchema.safeParse(rawMeta.quality)
      : null;
  const qualityMeta =
    parsed.success && parsed.data.meta.quality !== undefined
      ? agentQualityMetaSchema.parse(parsed.data.meta.quality)
      : qualityFromRaw?.success
        ? qualityFromRaw.data
        : undefined;

  const rawExamples = parsed.success
    ? (parsed.data.examples ?? [])
    : Array.isArray(base.examples)
    ? base.examples
    : [];
  const examples = normalizeExamplesList(rawExamples);

  const rawSeedPrompts = parsed.success
    ? (parsed.data.evaluationSeedPrompts ?? [])
    : Array.isArray(base.evaluationSeedPrompts)
    ? base.evaluationSeedPrompts
    : [];
  const evaluationSeedPrompts = normalizeEvaluationSeedPromptsList(rawSeedPrompts);

  const guardrails = parsed.success ? (parsed.data.guardrails ?? []) : [];
  const modes = parsed.success ? (parsed.data.modes ?? []) : [];

  const legacyModelFields = parseLegacyModelPolicyFields(base);
  const modelPreferencesFromRoot = parsed.success ? parsed.data.modelPreferences : undefined;
  const modelPolicyFromMeta = parsed.success ? parsed.data.meta.modelPolicy : undefined;
  const mergedFromLegacy = mergeAgentModelPreferences(modelPolicyFromMeta, legacyModelFields);
  const modelPreferencesRaw = mergeAgentModelPreferences(modelPreferencesFromRoot, mergedFromLegacy);
  const modelPreferences = sanitizeModelPreferencesToRegistry(modelPreferencesRaw);

  return {
    version: 2,
    starterPrompts,
    knowledgeItems,
    outputConfig: {
      ...outputConfig,
      template: outputConfig.template ?? null,
      schema: outputConfig.schema ?? null,
    },
    modelPreferences,
    examples,
    evaluationSeedPrompts,
    guardrails,
    modes,
    meta: {
      identity: {
        icon: meta.identity.icon ?? iconFromLegacy,
        category: meta.identity.category ?? categoryFromLegacy,
      },
      behavior: meta.behavior,
      ...(qualityMeta !== undefined ? { quality: qualityMeta } : {}),
    },
  };
}
