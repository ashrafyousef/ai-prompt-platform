import { z } from "zod";

export const BRIEF_INTAKE_VERSION = 1 as const;
export const BRIEF_INTAKE_FIELD_MAX_LENGTH = 4000;

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

export type BriefIntakeFields = z.infer<typeof briefIntakeFieldsSchema>;
export type BriefIntakeResponsesV1 = z.infer<typeof briefIntakeResponsesSchema>;

export function emptyBriefIntakeFields(): BriefIntakeFields {
  return Object.fromEntries(BRIEF_INTAKE_FIELD_KEYS.map((key) => [key, ""])) as BriefIntakeFields;
}

export function emptyBriefIntakeResponses(): BriefIntakeResponsesV1 {
  return {
    version: BRIEF_INTAKE_VERSION,
    fields: emptyBriefIntakeFields(),
  };
}

function coerceFieldValue(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.slice(0, BRIEF_INTAKE_FIELD_MAX_LENGTH);
}

/** Safely normalize legacy/null/invalid stored JSON into v1 responses. */
export function parseBriefResponsesJson(value: unknown): BriefIntakeResponsesV1 {
  const base = emptyBriefIntakeResponses();
  if (value === null || value === undefined) return base;

  let record: Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return base;
      record = parsed as Record<string, unknown>;
    } catch {
      return base;
    }
  } else if (typeof value === "object" && !Array.isArray(value)) {
    record = value as Record<string, unknown>;
  } else {
    return base;
  }

  const rawFields =
    record.fields && typeof record.fields === "object" && !Array.isArray(record.fields)
      ? (record.fields as Record<string, unknown>)
      : record;

  for (const key of BRIEF_INTAKE_FIELD_KEYS) {
    base.fields[key] = coerceFieldValue(rawFields[key]);
  }

  return base;
}

export function hasBriefIntakeContent(responses: BriefIntakeResponsesV1): boolean {
  return BRIEF_INTAKE_FIELD_KEYS.some((key) => responses.fields[key].trim().length > 0);
}

export function hasBriefIntakeContentFromUnknown(value: unknown): boolean {
  return hasBriefIntakeContent(parseBriefResponsesJson(value));
}
