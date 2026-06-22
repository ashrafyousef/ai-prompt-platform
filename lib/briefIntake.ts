import { z } from "zod";

export const BRIEF_INTAKE_VERSION = 1 as const;
export const BRIEF_DOCUMENT_VERSION = 2 as const;
export const BRIEF_INTAKE_FIELD_MAX_LENGTH = 4000;
export const BRIEF_RAW_TEXT_MAX_LENGTH = 50_000;

export const BRIEF_INTAKE_FIELD_KEYS = [
  "objective",
  "clientBackground",
  "campaignType",
  "targetAudience",
  "keyMessage",
  "deliverables",
  "channels",
  "timeline",
  "brandRestrictions",
  "mandatoryContent",
  "referenceNotes",
  "openQuestions",
] as const;

export type BriefIntakeFieldKey = (typeof BRIEF_INTAKE_FIELD_KEYS)[number];

export const BRIEF_INTAKE_FIELD_DEFINITIONS: ReadonlyArray<{
  key: BriefIntakeFieldKey;
  label: string;
}> = [
  { key: "objective", label: "Objective / task summary" },
  { key: "clientBackground", label: "Client background" },
  { key: "campaignType", label: "Campaign / project type" },
  { key: "targetAudience", label: "Target audience" },
  { key: "keyMessage", label: "Key message" },
  { key: "deliverables", label: "Deliverables" },
  { key: "channels", label: "Channels / placements" },
  { key: "timeline", label: "Timeline / deadline" },
  { key: "brandRestrictions", label: "Brand restrictions / compliance notes" },
  { key: "mandatoryContent", label: "Mandatory content" },
  { key: "referenceNotes", label: "Reference links / notes" },
  { key: "openQuestions", label: "Missing information / open questions" },
];

const fieldSchema = z.string().max(BRIEF_INTAKE_FIELD_MAX_LENGTH);

const fieldsShape = Object.fromEntries(
  BRIEF_INTAKE_FIELD_KEYS.map((key) => [key, fieldSchema])
) as Record<BriefIntakeFieldKey, z.ZodString>;

export const briefIntakeFieldsSchema = z.object(fieldsShape);

export const briefIntakeResponsesSchema = z.object({
  version: z.literal(BRIEF_INTAKE_VERSION),
  fields: briefIntakeFieldsSchema,
});

export const briefSourceSchema = z.object({
  rawText: z.string().max(BRIEF_RAW_TEXT_MAX_LENGTH),
  savedAt: z.string().datetime().optional(),
});

export const briefAnalysisIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(["info", "warning"]),
  message: z.string().min(1),
});

export const briefAnalysisSchema = z.object({
  generatedAt: z.string().datetime(),
  mode: z.literal("deterministic"),
  issues: z.array(briefAnalysisIssueSchema),
  proposedFields: briefIntakeFieldsSchema.optional(),
});

export const briefDocumentSchema = z.object({
  version: z.literal(BRIEF_DOCUMENT_VERSION),
  fields: briefIntakeFieldsSchema,
  source: briefSourceSchema.optional(),
  analysis: briefAnalysisSchema.optional(),
});

export const briefDocumentPatchSchema = z
  .object({
    version: z.literal(BRIEF_DOCUMENT_VERSION).optional(),
    fields: briefIntakeFieldsSchema.optional(),
    source: briefSourceSchema.optional(),
    analysis: briefAnalysisSchema.optional().nullable(),
  })
  .refine(
    (value) =>
      value.fields !== undefined ||
      value.source !== undefined ||
      value.analysis !== undefined,
    { message: "No document changes provided." }
  );

export type BriefIntakeFields = z.infer<typeof briefIntakeFieldsSchema>;
export type BriefIntakeResponsesV1 = z.infer<typeof briefIntakeResponsesSchema>;
export type BriefSource = z.infer<typeof briefSourceSchema>;
export type BriefAnalysisIssue = z.infer<typeof briefAnalysisIssueSchema>;
export type BriefAnalysis = z.infer<typeof briefAnalysisSchema>;
export type BriefDocumentV2 = z.infer<typeof briefDocumentSchema>;
export type BriefDocumentPatch = z.infer<typeof briefDocumentPatchSchema>;

export function emptyBriefIntakeFields(): BriefIntakeFields {
  return Object.fromEntries(BRIEF_INTAKE_FIELD_KEYS.map((key) => [key, ""])) as BriefIntakeFields;
}

export function emptyBriefIntakeResponses(): BriefIntakeResponsesV1 {
  return {
    version: BRIEF_INTAKE_VERSION,
    fields: emptyBriefIntakeFields(),
  };
}

export function emptyBriefDocument(): BriefDocumentV2 {
  return {
    version: BRIEF_DOCUMENT_VERSION,
    fields: emptyBriefIntakeFields(),
  };
}

function coerceFieldValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, BRIEF_INTAKE_FIELD_MAX_LENGTH);
}

function coerceRawText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, BRIEF_RAW_TEXT_MAX_LENGTH);
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

function parseFieldsFromRecord(record: Record<string, unknown>): BriefIntakeFields {
  const fields = emptyBriefIntakeFields();
  const rawFields =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : record;

  for (const key of BRIEF_INTAKE_FIELD_KEYS) {
    fields[key] = coerceFieldValue(rawFields[key]);
  }

  return fields;
}

function parseSourceFromRecord(record: Record<string, unknown>): BriefSource | undefined {
  if (!record.source || typeof record.source !== "object" || Array.isArray(record.source)) {
    return undefined;
  }

  const source = record.source as Record<string, unknown>;
  const rawText = coerceRawText(source.rawText);
  if (!rawText.trim()) return undefined;

  const parsed: BriefSource = { rawText };
  if (typeof source.savedAt === "string" && source.savedAt.trim()) {
    parsed.savedAt = source.savedAt;
  }
  return parsed;
}

function parseAnalysisFromRecord(record: Record<string, unknown>): BriefAnalysis | undefined {
  if (!record.analysis || typeof record.analysis !== "object" || Array.isArray(record.analysis)) {
    return undefined;
  }

  const result = briefAnalysisSchema.safeParse(record.analysis);
  return result.success ? result.data : undefined;
}

/** Normalize stored JSON into a v2 brief document. */
export function parseBriefDocumentJson(value: unknown): BriefDocumentV2 {
  const base = emptyBriefDocument();
  const record = parseStoredRecord(value);
  if (!record) return base;

  base.fields = parseFieldsFromRecord(record);
  const source = parseSourceFromRecord(record);
  if (source) base.source = source;

  const analysis = parseAnalysisFromRecord(record);
  if (analysis) base.analysis = analysis;

  return base;
}

/** Backward-compatible alias that returns v1-shaped fields from stored JSON. */
export function parseBriefResponsesJson(value: unknown): BriefIntakeResponsesV1 {
  const document = parseBriefDocumentJson(value);
  return {
    version: BRIEF_INTAKE_VERSION,
    fields: document.fields,
  };
}

export function mergeBriefDocument(
  existing: BriefDocumentV2,
  patch: BriefDocumentPatch
): BriefDocumentV2 {
  const merged: BriefDocumentV2 = {
    version: BRIEF_DOCUMENT_VERSION,
    fields: patch.fields ? { ...patch.fields } : { ...existing.fields },
  };

  if (patch.source !== undefined) {
    merged.source = patch.source;
  } else if (existing.source) {
    merged.source = { ...existing.source };
  }

  if (patch.analysis === null) {
    merged.analysis = undefined;
  } else if (patch.analysis !== undefined) {
    merged.analysis = patch.analysis;
  } else if (existing.analysis) {
    merged.analysis = { ...existing.analysis };
  }

  return merged;
}

export function hasBriefIntakeContent(document: Pick<BriefDocumentV2, "fields">): boolean {
  return BRIEF_INTAKE_FIELD_KEYS.some((key) => document.fields[key].trim().length > 0);
}

export function hasBriefIntakeContentFromUnknown(value: unknown): boolean {
  return hasBriefIntakeContent(parseBriefDocumentJson(value));
}

export function hasSavedRawBriefText(document: Pick<BriefDocumentV2, "source">): boolean {
  return Boolean(document.source?.rawText?.trim());
}
