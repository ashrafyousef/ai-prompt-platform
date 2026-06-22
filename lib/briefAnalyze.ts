import {
  BRIEF_INTAKE_FIELD_KEYS,
  emptyBriefIntakeFields,
  type BriefAnalysis,
  type BriefAnalysisIssue,
  type BriefIntakeFieldKey,
  type BriefIntakeFields,
} from "@/lib/briefIntake";

/** Labeled section headers such as "Objective:" or "Target audience:" */
const LABELED_SECTION_PATTERNS: Record<BriefIntakeFieldKey, RegExp[]> = {
  objective: [
    /^objective[:\s-]+(.+)$/im,
    /\b(?:objective|goal|task summary|brief objective|campaign goal)[:\s-]+([^\n]+)/i,
  ],
  clientBackground: [
    /^client[:\s-]+(.+)$/im,
    /\b(?:client background|about (?:the )?client|background)[:\s-]+([^\n]+)/i,
  ],
  campaignType: [/^campaign[:\s-]+(.+)$/im, /\b(?:campaign type|project type)[:\s-]+([^\n]+)/i],
  targetAudience: [
    /^target audience[:\s-]+(.+)$/im,
    /^audience[:\s-]+(.+)$/im,
  ],
  keyMessage: [
    /^key message[:\s-]+(.+)$/im,
    /\b(?:key message|main message|core message)[:\s-]+([^\n]+)/i,
  ],
  deliverables: [/^deliverables[:\s-]+(.+)$/im, /\bdeliverables include[:\s-]+([^\n]+)/i],
  channels: [/^channels[:\s-]+(.+)$/im, /^placements[:\s-]+(.+)$/im],
  timeline: [
    /^timeline[:\s-]+(.+)$/im,
    /\b(?:timeline|deadline|due date|launch date)[:\s-]+([^\n]+)/i,
  ],
  brandRestrictions: [
    /^brand restrictions[:\s-]+(.+)$/im,
    /\b(?:brand restrictions|compliance notes?|brand guidelines)[:\s-]+([^\n]+)/i,
  ],
  mandatoryContent: [/^mandatory[:\s-]+(.+)$/im, /\bmandatory content[:\s-]+([^\n]+)/i],
  referenceNotes: [/^references?[:\s-]+(.+)$/im, /\b(?:reference links?|inspiration)[:\s-]+([^\n]+)/i],
  openQuestions: [/^open questions?[:\s-]+(.+)$/im],
};

const ISSUE_CHECKS: Array<{
  code: string;
  field: BriefIntakeFieldKey;
  severity: BriefAnalysisIssue["severity"];
  missingMessage: string;
  weakMessage?: string;
  weakIf?: (value: string, rawText: string) => boolean;
}> = [
  {
    code: "missing_objective",
    field: "objective",
    severity: "warning",
    missingMessage: "No clear objective or task summary was detected.",
    weakMessage: "The objective looks vague or very short.",
    weakIf: (value) => value.trim().length > 0 && value.trim().length < 24,
  },
  {
    code: "incomplete_client_background",
    field: "clientBackground",
    severity: "info",
    missingMessage: "Client background is missing or not clearly labeled.",
    weakMessage: "Client background looks incomplete.",
    weakIf: (value) => value.trim().length > 0 && value.trim().length < 30,
  },
  {
    code: "weak_campaign_type",
    field: "campaignType",
    severity: "info",
    missingMessage: "Campaign or project type is not clearly stated.",
    weakMessage: "Campaign / project type is unclear.",
    weakIf: (value) => value.trim().length > 0 && value.trim().length < 12,
  },
  {
    code: "missing_target_audience",
    field: "targetAudience",
    severity: "warning",
    missingMessage: "Target audience is missing.",
  },
  {
    code: "weak_key_message",
    field: "keyMessage",
    severity: "warning",
    missingMessage: "Key message is missing.",
    weakMessage: "Key message is present but unclear or too short.",
    weakIf: (value) => value.trim().length > 0 && value.trim().length < 16,
  },
  {
    code: "missing_deliverables",
    field: "deliverables",
    severity: "warning",
    missingMessage: "Deliverables are not specified.",
  },
  {
    code: "missing_channels",
    field: "channels",
    severity: "warning",
    missingMessage: "Channels or placements are not specified.",
  },
  {
    code: "missing_timeline",
    field: "timeline",
    severity: "warning",
    missingMessage: "Timeline or deadline is missing.",
  },
  {
    code: "missing_open_questions",
    field: "openQuestions",
    severity: "info",
    missingMessage: "No open questions or missing-information notes were captured.",
  },
];

const DELIVERABLE_KEYWORDS =
  /\b(?:instagram|posts?|story|stories|banner|banners|video|videos|format|formats|outdoor|adaptation|landing page|email|ooh|print|asset|assets|creative|adaptations)\b/i;

function normalizeExtracted(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 4000);
}

export function isMeaningfulExtract(value: string): boolean {
  const normalized = normalizeExtracted(value);
  if (!normalized) return false;
  if (/^[.\-,;:!?…]+$/.test(normalized)) return false;
  if (normalized.length < 3) return false;
  return /[a-zA-Z0-9]/.test(normalized);
}

function firstMatch(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const extracted = normalizeExtracted(match[1]);
      if (isMeaningfulExtract(extracted)) return extracted;
    }
  }
  return "";
}

function assignField(fields: BriefIntakeFields, key: BriefIntakeFieldKey, value: string): void {
  const normalized = normalizeExtracted(value);
  if (!isMeaningfulExtract(normalized)) return;
  if (!isMeaningfulExtract(fields[key]) || fields[key].length < normalized.length) {
    fields[key] = normalized;
  }
}

function extractLabeledField(rawText: string, field: BriefIntakeFieldKey): string {
  return firstMatch(rawText, LABELED_SECTION_PATTERNS[field]);
}

function extractNaturalLanguageFields(rawText: string): Partial<BriefIntakeFields> {
  const extracted: Partial<BriefIntakeFields> = {};

  const client = firstMatch(rawText, [/^client[:\s-]+(.+)$/im]);
  if (client) extracted.clientBackground = client;

  const campaign = firstMatch(rawText, [/^campaign[:\s-]+(.+)$/im]);
  if (campaign) extracted.campaignType = campaign;

  const objectiveSentence = firstMatch(rawText, [
    /We need a campaign for ([^.]+\.)/i,
    /We need (?:an? )?campaign[^.]*\./i,
  ]);
  if (objectiveSentence) {
    extracted.objective = objectiveSentence.endsWith(".")
      ? objectiveSentence
      : `${objectiveSentence}.`;
  }

  const keyMessage = firstMatch(rawText, [
    /The message should (?:focus on|emphasize|highlight)\s+([^.]+)\./i,
    /The message should be\s+([^.]+)\./i,
    /Key message is\s+([^.]+)\./i,
  ]);
  if (keyMessage) extracted.keyMessage = keyMessage;

  const targetAudience = firstMatch(rawText, [
    /Target customers are\s+([^.]+)\./i,
    /Target audience is\s+([^.]+)\./i,
    /Target audience are\s+([^.]+)\./i,
    /Our target audience is\s+([^.]+)\./i,
    /Audience is\s+([^.]+)\./i,
  ]);
  if (targetAudience) extracted.targetAudience = targetAudience;

  const deliverablesLine = rawText.match(/^We need\s+(.+)$/im);
  if (deliverablesLine?.[1] && DELIVERABLE_KEYWORDS.test(deliverablesLine[1])) {
    extracted.deliverables = normalizeExtracted(deliverablesLine[1].replace(/\.$/, ""));
  } else {
    const deliverables = firstMatch(rawText, [
      /Deliverables include\s+([^.]+)\./i,
      /We need\s+((?:Instagram|instagram)[^.]+)\./i,
    ]);
    if (deliverables) extracted.deliverables = deliverables;
  }

  const channels = firstMatch(rawText, [
    /(?:will be )?used across\s+([^.]+)\./i,
    /(?:will run|runs|running|live)\s+(?:across|on)\s+([^.]+)\./i,
    /across\s+((?:social media|digital)[^.]*channels?[^.]*)\./i,
    /(?:channels?|placements?) (?:include|are)\s+([^.]+)\./i,
  ]);
  if (channels) {
    extracted.channels = channels;
  }

  const tone = firstMatch(rawText, [/The tone should feel\s+([^.]+)\./i, /Tone should be\s+([^.]+)\./i]);
  if (tone && !extracted.keyMessage) {
    extracted.keyMessage = tone;
  }

  const mandatory = firstMatch(rawText, [
    /^mandatory[:\s-]+(.+)$/im,
    /Mandatory:\s*(.+)$/im,
    /Must use\s+([^.]+)\./i,
    /Must include\s+([^.]+)\./i,
  ]);
  if (mandatory) {
    extracted.mandatoryContent = mandatory;
    if (/\b(?:brand(?:ing)?|compliance|legal|visuals?|logo|guidelines?)\b/i.test(mandatory)) {
      extracted.brandRestrictions = mandatory;
    }
  }

  return extracted;
}

function fallbackObjective(rawText: string): string {
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";

  const labeledHeader = /^(client|campaign|objective|target audience|deliverables|mandatory)\s*:/i;
  const substantive = paragraphs.find(
    (paragraph) => !labeledHeader.test(paragraph) && paragraph.length > 20
  );
  return normalizeExtracted(substantive ?? paragraphs[0]);
}

export function extractProposedFieldsFromRawText(rawText: string): BriefIntakeFields {
  const proposed = emptyBriefIntakeFields();
  const trimmed = rawText.trim();
  if (!trimmed) return proposed;

  const naturalLanguage = extractNaturalLanguageFields(trimmed);
  for (const key of BRIEF_INTAKE_FIELD_KEYS) {
    const value = naturalLanguage[key];
    if (value) assignField(proposed, key, value);
  }

  for (const key of BRIEF_INTAKE_FIELD_KEYS) {
    const labeled = extractLabeledField(trimmed, key);
    if (labeled) assignField(proposed, key, labeled);
  }

  if (!isMeaningfulExtract(proposed.objective)) {
    const fallback = fallbackObjective(trimmed);
    if (isMeaningfulExtract(fallback)) proposed.objective = fallback;
  }

  if (!isMeaningfulExtract(proposed.referenceNotes) && /https?:\/\//i.test(trimmed)) {
    const links = trimmed.match(/https?:\/\/[^\s)]+/gi) ?? [];
    proposed.referenceNotes = links.join("\n").slice(0, 4000);
  }

  return proposed;
}

function hasMandatoryOrComplianceNotes(fields: BriefIntakeFields): boolean {
  return (
    isMeaningfulExtract(fields.brandRestrictions) || isMeaningfulExtract(fields.mandatoryContent)
  );
}

export function analyzeRawBriefDeterministic(rawText: string): {
  issues: BriefAnalysisIssue[];
  proposedFields: BriefIntakeFields;
} {
  const trimmed = rawText.trim();
  const proposedFields = extractProposedFieldsFromRawText(trimmed);
  const issues: BriefAnalysisIssue[] = [];

  if (!trimmed) {
    return {
      issues: [
        {
          code: "missing_raw_brief",
          severity: "warning",
          message: "Paste a client brief before running analysis.",
        },
      ],
      proposedFields,
    };
  }

  for (const check of ISSUE_CHECKS) {
    const value = proposedFields[check.field];
    if (!isMeaningfulExtract(value)) {
      issues.push({
        code: check.code,
        severity: check.severity,
        message: check.missingMessage,
      });
      continue;
    }

    if (check.weakIf?.(value, trimmed) && check.weakMessage) {
      issues.push({
        code: check.code,
        severity: check.severity,
        message: check.weakMessage,
      });
    }
  }

  if (!hasMandatoryOrComplianceNotes(proposedFields)) {
    const hasMandatoryCue = /\b(?:must include|mandatory|required copy|legal approval|must use)\b/i.test(
      trimmed
    );
    if (!hasMandatoryCue) {
      issues.push({
        code: "missing_mandatory_compliance",
        severity: "info",
        message: "Brand restrictions or compliance notes are missing.",
      });
    } else {
      issues.push({
        code: "missing_mandatory_content",
        severity: "info",
        message: "Mandatory content requirements were not clearly identified.",
      });
    }
  }

  return { issues, proposedFields };
}

export function buildDeterministicBriefAnalysis(rawText: string): BriefAnalysis {
  const { issues, proposedFields } = analyzeRawBriefDeterministic(rawText);
  return {
    generatedAt: new Date().toISOString(),
    mode: "deterministic",
    issues,
    proposedFields,
  };
}
