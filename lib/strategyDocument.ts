import { z } from "zod";
import type { BriefDocumentV2 } from "@/lib/briefIntake";

export const STRATEGY_DOCUMENT_VERSION = 1 as const;
export const STRATEGY_FIELD_MAX_LENGTH = 4000;

export const STRATEGY_FIELD_KEYS = [
  "strategicSummary",
  "communicationChallenge",
  "objectiveInterpretation",
  "audienceInsight",
  "audienceBarrierMotivation",
  "marketCompetitorContext",
  "coreTensionOpportunity",
  "singleMindedProposition",
  "messageHierarchy",
  "reasonsToBelieve",
  "brandComplianceGuardrails",
  "timelineFeasibilityNotes",
  "openStrategicQuestions",
  "creativeKickoffRecommendation",
] as const;

export type StrategyFieldKey = (typeof STRATEGY_FIELD_KEYS)[number];

export const STRATEGY_FIELD_DEFINITIONS: ReadonlyArray<{
  key: StrategyFieldKey;
  label: string;
  group: string;
}> = [
  { key: "strategicSummary", label: "Strategic summary", group: "Strategic Frame" },
  { key: "communicationChallenge", label: "Business / communication challenge", group: "Strategic Frame" },
  { key: "objectiveInterpretation", label: "Objective interpretation", group: "Strategic Frame" },
  { key: "audienceInsight", label: "Target audience insight", group: "Audience & Market" },
  { key: "audienceBarrierMotivation", label: "Audience barrier / motivation", group: "Audience & Market" },
  { key: "marketCompetitorContext", label: "Market / competitor context", group: "Audience & Market" },
  { key: "coreTensionOpportunity", label: "Core tension / opportunity", group: "Core Direction" },
  { key: "singleMindedProposition", label: "Single-minded proposition", group: "Core Direction" },
  { key: "messageHierarchy", label: "Message hierarchy", group: "Core Direction" },
  { key: "reasonsToBelieve", label: "Reasons to believe", group: "Core Direction" },
  { key: "brandComplianceGuardrails", label: "Brand / compliance guardrails", group: "Guardrails & Feasibility" },
  { key: "timelineFeasibilityNotes", label: "Timeline / feasibility notes", group: "Guardrails & Feasibility" },
  { key: "openStrategicQuestions", label: "Open strategic questions", group: "Creative Kickoff Input" },
  { key: "creativeKickoffRecommendation", label: "Recommendation for Creative Kickoff", group: "Creative Kickoff Input" },
];

const fieldSchema = z.string().max(STRATEGY_FIELD_MAX_LENGTH);

const fieldsShape = Object.fromEntries(
  STRATEGY_FIELD_KEYS.map((key) => [key, fieldSchema])
) as Record<StrategyFieldKey, z.ZodString>;

export const strategyFieldsSchema = z.object(fieldsShape);

export const strategyDocumentSchema = z.object({
  version: z.literal(STRATEGY_DOCUMENT_VERSION),
  fields: strategyFieldsSchema,
});

export const strategyFieldsPatchSchema = strategyFieldsSchema.partial();

export const strategyDocumentPatchSchema = z
  .object({
    version: z.literal(STRATEGY_DOCUMENT_VERSION).optional(),
    fields: strategyFieldsPatchSchema.optional(),
  })
  .refine((value) => value.fields !== undefined, {
    message: "No document changes provided.",
  });

export type StrategyFields = z.infer<typeof strategyFieldsSchema>;
export type StrategyDocumentV1 = z.infer<typeof strategyDocumentSchema>;
export type StrategyDocumentPatch = z.infer<typeof strategyDocumentPatchSchema>;

export function emptyStrategyFields(): StrategyFields {
  return Object.fromEntries(STRATEGY_FIELD_KEYS.map((key) => [key, ""])) as StrategyFields;
}

export function emptyStrategyDocument(): StrategyDocumentV1 {
  return {
    version: STRATEGY_DOCUMENT_VERSION,
    fields: emptyStrategyFields(),
  };
}

function coerceFieldValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, STRATEGY_FIELD_MAX_LENGTH);
}

function parseStoredRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

/** Normalize stored JSON into a v1 strategy document. */
export function parseStrategyDocumentJson(value: unknown): StrategyDocumentV1 {
  const base = emptyStrategyDocument();
  const record = parseStoredRecord(value);
  if (!record) return base;

  const rawFields =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : record;

  for (const key of STRATEGY_FIELD_KEYS) {
    base.fields[key] = coerceFieldValue(rawFields[key]);
  }

  return base;
}

export function mergeStrategyDocument(
  existing: StrategyDocumentV1,
  patch: StrategyDocumentPatch
): StrategyDocumentV1 {
  const fields: StrategyFields = { ...existing.fields };

  if (patch.fields) {
    for (const key of STRATEGY_FIELD_KEYS) {
      const value = patch.fields[key];
      if (typeof value === "string") {
        fields[key] = value;
      }
    }
  }

  return {
    version: STRATEGY_DOCUMENT_VERSION,
    fields,
  };
}

export function hasStrategyContent(document: Pick<StrategyDocumentV1, "fields">): boolean {
  return STRATEGY_FIELD_KEYS.some((key) => document.fields[key].trim().length > 0);
}

/**
 * Builds a new Strategy document, prefilling exactly the 4 fields defined in
 * the Phase 2G.0 spec (Section 4) from an approved brief's document. All
 * other fields start empty — no strategic judgment is invented.
 */
export function buildPrefilledStrategyDocument(brief: Pick<BriefDocumentV2, "fields">): StrategyDocumentV1 {
  const document = emptyStrategyDocument();

  document.fields.objectiveInterpretation = brief.fields.objective.trim();
  document.fields.timelineFeasibilityNotes = brief.fields.timeline.trim();
  document.fields.openStrategicQuestions = brief.fields.openQuestions.trim();

  const restrictions = brief.fields.brandRestrictions.trim();
  const mandatory = brief.fields.mandatoryContent.trim();
  const guardrailLines: string[] = [];
  if (restrictions) guardrailLines.push(`Brand restrictions: ${restrictions}`);
  if (mandatory) guardrailLines.push(`Mandatory content: ${mandatory}`);
  document.fields.brandComplianceGuardrails = guardrailLines.join("\n\n");

  return document;
}
