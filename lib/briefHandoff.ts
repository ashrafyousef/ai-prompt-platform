import {
  BRIEF_INTAKE_FIELD_DEFINITIONS,
  type BriefDocumentV2,
  type BriefIntakeFieldKey,
} from "@/lib/briefIntake";

export const NOT_PROVIDED = "Not provided";

export type BriefHandoffRow = {
  key: BriefIntakeFieldKey;
  label: string;
  value: string;
};

export type BriefHandoffSection = {
  id: string;
  title: string;
  rows: BriefHandoffRow[];
};

const HANDOFF_GROUPS: ReadonlyArray<{
  id: string;
  title: string;
  keys: BriefIntakeFieldKey[];
}> = [
  {
    id: "project-context",
    title: "Project Context",
    keys: ["clientBackground", "campaignType", "referenceNotes"],
  },
  { id: "objective", title: "Objective", keys: ["objective"] },
  { id: "audience", title: "Audience", keys: ["targetAudience"] },
  { id: "message", title: "Message", keys: ["keyMessage"] },
  { id: "logistics", title: "Logistics", keys: ["deliverables", "channels", "timeline"] },
  {
    id: "constraints",
    title: "Constraints & Mandatories",
    keys: ["brandRestrictions", "mandatoryContent"],
  },
  { id: "open-questions", title: "Open Questions", keys: ["openQuestions"] },
];

const LABELS_BY_KEY = new Map(BRIEF_INTAKE_FIELD_DEFINITIONS.map((def) => [def.key, def.label]));

function resolveValue(document: Pick<BriefDocumentV2, "fields">, key: BriefIntakeFieldKey): string {
  const raw = document.fields[key]?.trim();
  return raw && raw.length > 0 ? raw : NOT_PROVIDED;
}

/**
 * Maps an approved brief's existing fields into the 7 handoff groups used by
 * the Approved Brief Handoff Panel (Phase 2F.1). Pure function — no I/O.
 */
export function buildBriefHandoffSections(
  document: Pick<BriefDocumentV2, "fields">
): BriefHandoffSection[] {
  return HANDOFF_GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    rows: group.keys.map((key) => ({
      key,
      label: LABELS_BY_KEY.get(key) ?? key,
      value: resolveValue(document, key),
    })),
  }));
}
