import {
  BRIEF_INTAKE_FIELD_KEYS,
  emptyBriefIntakeFields,
  type BriefAnalysis,
  type BriefAnalysisIssue,
  type BriefIntakeFieldKey,
  type BriefIntakeFields,
} from "@/lib/briefIntake";

const SECTION_PATTERNS: Record<BriefIntakeFieldKey, RegExp[]> = {
  objective: [
    /\b(?:objective|goal|task summary|brief objective|campaign goal)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
    /^objective[:\s-]*(.+)$/im,
  ],
  clientBackground: [
    /\b(?:client background|about (?:the )?client|background)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  campaignType: [
    /\b(?:campaign type|project type|campaign|project)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  targetAudience: [
    /\b(?:target audience|audience|who we(?:'|')?re talking to)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  keyMessage: [
    /\b(?:key message|main message|core message|message)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  deliverables: [
    /\b(?:deliverables|assets needed|what we need)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  channels: [
    /\b(?:channels|placements|media channels|where it runs)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  timeline: [
    /\b(?:timeline|deadline|due date|launch date|timing)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  brandRestrictions: [
    /\b(?:brand restrictions|compliance|legal|brand guidelines|do not|don't)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  mandatoryContent: [
    /\b(?:mandatory content|must include|required copy|mandatories)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  referenceNotes: [
    /\b(?:references?|links?|inspiration|examples?)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
  openQuestions: [
    /\b(?:open questions?|missing information|tbd|to be confirmed|unclear)\b[:\s-]*([^\n]+(?:\n(?!\n)[^\n]+)*)/i,
  ],
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
    code: "missing_mandatory_compliance",
    field: "brandRestrictions",
    severity: "info",
    missingMessage: "Brand restrictions or compliance notes are missing.",
  },
  {
    code: "missing_open_questions",
    field: "openQuestions",
    severity: "info",
    missingMessage: "No open questions or missing-information notes were captured.",
  },
];

function normalizeExtracted(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 4000);
}

function extractField(rawText: string, field: BriefIntakeFieldKey): string {
  for (const pattern of SECTION_PATTERNS[field]) {
    const match = rawText.match(pattern);
    if (match?.[1]) {
      const extracted = normalizeExtracted(match[1]);
      if (extracted) return extracted;
    }
  }
  return "";
}

function fallbackObjective(rawText: string): string {
  const paragraphs = rawText
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (paragraphs.length === 0) return "";
  return normalizeExtracted(paragraphs[0]);
}

export function extractProposedFieldsFromRawText(rawText: string): BriefIntakeFields {
  const proposed = emptyBriefIntakeFields();
  const trimmed = rawText.trim();
  if (!trimmed) return proposed;

  for (const key of BRIEF_INTAKE_FIELD_KEYS) {
    proposed[key] = extractField(trimmed, key);
  }

  if (!proposed.objective.trim()) {
    proposed.objective = fallbackObjective(trimmed);
  }

  if (!proposed.referenceNotes.trim() && /https?:\/\//i.test(trimmed)) {
    const links = trimmed.match(/https?:\/\/[^\s)]+/gi) ?? [];
    proposed.referenceNotes = links.join("\n").slice(0, 4000);
  }

  return proposed;
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
    if (!value.trim()) {
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

  if (!proposedFields.mandatoryContent.trim()) {
    const hasMandatoryCue = /\b(must include|mandatory|required copy|legal approval)\b/i.test(trimmed);
    if (!hasMandatoryCue) {
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
