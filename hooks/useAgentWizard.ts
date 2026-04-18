"use client";

import { useCallback, useReducer } from "react";
import type { AgentCitationsPolicy, AgentKnowledgeSourceType, AgentResponseDepth } from "@/lib/agentConfig";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ImportMethod = "manual" | "guided" | "knowledge-first";

export type OutputMode = "markdown" | "structured-markdown" | "json" | "template";

export type SchemaField = {
  id: string;
  name: string;
  type: "string" | "number" | "boolean" | "array";
  required: boolean;
  description: string;
};

export type StructuredSection = {
  id: string;
  title: string;
  required: boolean;
};

export type KnowledgeSource = {
  id: string;
  sourceType: AgentKnowledgeSourceType;
  title: string;
  content: string | null;
  fileRef?: { fileName: string; mimeType?: string; sizeBytes?: number; url?: string } | null;
  summary: string;
  tags: string[];
  priority: number;
  appliesTo: "all" | string;
  isActive: boolean;
  ownerNote: string;
  lastReviewedAt?: string | null;
  status: "ready" | "uploading" | "error";
};

export type AgentDraft = {
  importMethod: ImportMethod;
  guidedRawText: string;
  guidedUnmappedText: string;
  guidedWarnings: string[];
  guidedSuggestions: {
    name: string;
    description: string;
    behaviorNotes: string;
    starterPrompts: string[];
    knowledgeCandidates: KnowledgeSource[];
  };
  knowledgeIntakeText: string;

  name: string;
  description: string;
  category: string;
  icon: string;
  teamId: string;
  scope: "TEAM" | "GLOBAL";
  status: "DRAFT" | "PUBLISHED";

  systemInstructions: string;
  behaviorRules: string;
  toneGuidance: string;
  avoidRules: string;
  temperature: number;
  maxTokens: number;
  strictMode: boolean;

  knowledgeSources: KnowledgeSource[];

  outputMode: OutputMode;
  structuredSections: StructuredSection[];
  jsonSchema: SchemaField[];
  templateText: string;
  markdownRules: string;
  responseDepth: AgentResponseDepth;
  citationsPolicy: AgentCitationsPolicy;
  fallbackBehavior: string;

  starterPrompts: Array<{ id: string; text: string }>;
};

export type WizardStep =
  | "import-method"
  | "guided-extraction"
  | "knowledge-intake"
  | "identity"
  | "behavior"
  | "knowledge"
  | "output"
  | "starter-prompts"
  | "review";

export const WIZARD_STEPS: WizardStep[] = [
  "import-method",
  "guided-extraction",
  "knowledge-intake",
  "identity",
  "behavior",
  "knowledge",
  "output",
  "starter-prompts",
  "review",
];

export const STEP_LABELS: Record<WizardStep, string> = {
  "import-method": "Import Method",
  "guided-extraction": "Suggested Mapping",
  "knowledge-intake": "Knowledge Intake",
  identity: "Identity",
  behavior: "Behavior",
  knowledge: "Knowledge",
  output: "Output",
  "starter-prompts": "Starters",
  review: "Review & Publish",
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_DRAFT: AgentDraft = {
  importMethod: "manual",
  guidedRawText: "",
  guidedUnmappedText: "",
  guidedWarnings: [],
  guidedSuggestions: {
    name: "",
    description: "",
    behaviorNotes: "",
    starterPrompts: [],
    knowledgeCandidates: [],
  },
  knowledgeIntakeText: "",
  name: "",
  description: "",
  category: "",
  icon: "🤖",
  teamId: "",
  scope: "GLOBAL",
  status: "DRAFT",
  systemInstructions: "",
  behaviorRules: "",
  toneGuidance: "",
  avoidRules: "",
  temperature: 0.4,
  maxTokens: 800,
  strictMode: false,
  knowledgeSources: [],
  outputMode: "markdown",
  structuredSections: [],
  jsonSchema: [],
  templateText: "",
  markdownRules: "",
  responseDepth: "standard",
  citationsPolicy: "none",
  fallbackBehavior:
    "Provide a best-effort response in markdown when strict formatting cannot be satisfied.",
  starterPrompts: [],
};

/* ------------------------------------------------------------------ */
/*  Reducer                                                            */
/* ------------------------------------------------------------------ */

type WizardState = {
  step: WizardStep;
  draft: AgentDraft;
  isImportFlow: boolean;
  saving: boolean;
};

export type WizardAction =
  | { type: "SET_STEP"; step: WizardStep }
  | { type: "UPDATE_DRAFT"; payload: Partial<AgentDraft> }
  | { type: "SET_SAVING"; saving: boolean }
  | { type: "RESET"; isImportFlow: boolean }
  | { type: "ADD_KNOWLEDGE"; source: KnowledgeSource }
  | { type: "REMOVE_KNOWLEDGE"; id: string }
  | { type: "UPDATE_KNOWLEDGE"; id: string; patch: Partial<KnowledgeSource> }
  | { type: "ADD_SCHEMA_FIELD"; field: SchemaField }
  | { type: "REMOVE_SCHEMA_FIELD"; id: string }
  | { type: "UPDATE_SCHEMA_FIELD"; id: string; patch: Partial<SchemaField> }
  | { type: "ADD_SECTION"; section: StructuredSection }
  | { type: "REMOVE_SECTION"; id: string }
  | { type: "ADD_STARTER_PROMPT"; prompt: { id: string; text: string } }
  | { type: "REMOVE_STARTER_PROMPT"; id: string }
  | { type: "UPDATE_STARTER_PROMPT"; id: string; text: string };

function reducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "SET_STEP":
      return { ...state, step: action.step };

    case "UPDATE_DRAFT":
      return { ...state, draft: { ...state.draft, ...action.payload } };

    case "SET_SAVING":
      return { ...state, saving: action.saving };

    case "RESET":
      return initState(action.isImportFlow);

    case "ADD_KNOWLEDGE":
      return {
        ...state,
        draft: {
          ...state.draft,
          knowledgeSources: [...state.draft.knowledgeSources, action.source],
        },
      };
    case "REMOVE_KNOWLEDGE":
      return {
        ...state,
        draft: {
          ...state.draft,
          knowledgeSources: state.draft.knowledgeSources.filter(
            (k) => k.id !== action.id
          ),
        },
      };
    case "UPDATE_KNOWLEDGE":
      return {
        ...state,
        draft: {
          ...state.draft,
          knowledgeSources: state.draft.knowledgeSources.map((k) =>
            k.id === action.id ? { ...k, ...action.patch } : k
          ),
        },
      };

    case "ADD_SCHEMA_FIELD":
      return {
        ...state,
        draft: {
          ...state.draft,
          jsonSchema: [...state.draft.jsonSchema, action.field],
        },
      };
    case "REMOVE_SCHEMA_FIELD":
      return {
        ...state,
        draft: {
          ...state.draft,
          jsonSchema: state.draft.jsonSchema.filter((f) => f.id !== action.id),
        },
      };
    case "UPDATE_SCHEMA_FIELD":
      return {
        ...state,
        draft: {
          ...state.draft,
          jsonSchema: state.draft.jsonSchema.map((f) =>
            f.id === action.id ? { ...f, ...action.patch } : f
          ),
        },
      };

    case "ADD_SECTION":
      return {
        ...state,
        draft: {
          ...state.draft,
          structuredSections: [...state.draft.structuredSections, action.section],
        },
      };
    case "REMOVE_SECTION":
      return {
        ...state,
        draft: {
          ...state.draft,
          structuredSections: state.draft.structuredSections.filter(
            (s) => s.id !== action.id
          ),
        },
      };

    case "ADD_STARTER_PROMPT":
      return {
        ...state,
        draft: {
          ...state.draft,
          starterPrompts: [...state.draft.starterPrompts, action.prompt],
        },
      };
    case "REMOVE_STARTER_PROMPT":
      return {
        ...state,
        draft: {
          ...state.draft,
          starterPrompts: state.draft.starterPrompts.filter(
            (p) => p.id !== action.id
          ),
        },
      };
    case "UPDATE_STARTER_PROMPT":
      return {
        ...state,
        draft: {
          ...state.draft,
          starterPrompts: state.draft.starterPrompts.map((p) =>
            p.id === action.id ? { ...p, text: action.text } : p
          ),
        },
      };

    default:
      return state;
  }
}

function initState(isImportFlow: boolean): WizardState {
  return {
    step: isImportFlow ? "import-method" : "identity",
    draft: { ...DEFAULT_DRAFT },
    isImportFlow,
    saving: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Validation helpers                                                 */
/* ------------------------------------------------------------------ */

export function validateIdentity(d: AgentDraft): string[] {
  const errs: string[] = [];
  if (!d.name.trim()) errs.push("Agent name is required — users need a clear label.");
  if (d.scope === "TEAM" && !d.teamId) errs.push("Team assignment is required for team-scoped agents.");
  return errs;
}

export function validateBehavior(d: AgentDraft): string[] {
  const errs: string[] = [];
  if (!d.systemInstructions.trim()) errs.push("System instructions are empty — the agent has no core guidance.");
  return errs;
}

export function validateOutput(d: AgentDraft): string[] {
  const errs: string[] = [];
  if (!d.fallbackBehavior.trim()) {
    errs.push("Fallback behavior is empty — the agent has no uncertainty handling.");
  }
  if (d.outputMode === "json" && d.jsonSchema.length === 0) {
    errs.push("JSON mode requires at least one schema field.");
  }
  if (d.outputMode === "template" && !d.templateText.trim()) {
    errs.push("Template mode requires a template body.");
  }
  if (d.outputMode === "structured-markdown" && d.structuredSections.length === 0) {
    errs.push("Structured markdown requires at least one section.");
  }
  if (
    d.outputMode === "structured-markdown" &&
    d.structuredSections.some((section) => !section.title.trim())
  ) {
    errs.push("Every section needs a title — remove or name untitled sections.");
  }
  if (d.citationsPolicy === "required" && d.responseDepth === "brief") {
    errs.push("Required citations with brief depth may feel too compressed for clear sourcing.");
  }
  return errs;
}

export function validateKnowledge(d: AgentDraft): string[] {
  const errs: string[] = [];
  const badItem = d.knowledgeSources.find((item) => {
    const hasContent = Boolean(item.content && item.content.trim().length > 0);
    const hasFileRef = Boolean(item.fileRef?.fileName);
    return !item.title.trim() || (!hasContent && !hasFileRef);
  });
  if (badItem) {
    errs.push("A knowledge item is missing a title or content — fix or remove it.");
  }
  return errs;
}

export function canProceed(step: WizardStep, d: AgentDraft): boolean {
  switch (step) {
    case "import-method":
      return true;
    case "guided-extraction":
      return true;
    case "knowledge-intake":
      return true;
    case "identity":
      return validateIdentity(d).length === 0;
    case "behavior":
      return validateBehavior(d).length === 0;
    case "knowledge":
      return validateKnowledge(d).length === 0;
    case "output":
      return validateOutput(d).length === 0;
    case "starter-prompts":
      return true;
    case "review":
      return true;
    default:
      return true;
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useAgentWizard(isImportFlow: boolean) {
  const [state, dispatch] = useReducer(reducer, isImportFlow, initState);

  const steps: WizardStep[] = state.isImportFlow
    ? [
        "import-method",
        ...(state.draft.importMethod === "guided" ? (["guided-extraction"] as WizardStep[]) : []),
        ...(state.draft.importMethod === "knowledge-first"
          ? (["knowledge-intake"] as WizardStep[])
          : []),
        "identity",
        "behavior",
        "knowledge",
        "output",
        "starter-prompts",
        "review",
      ]
    : WIZARD_STEPS.filter(
        (s) => s !== "import-method" && s !== "guided-extraction" && s !== "knowledge-intake"
      );

  const stepIndex = steps.indexOf(state.step);

  const goNext = useCallback(() => {
    const i = steps.indexOf(state.step);
    if (i < steps.length - 1) dispatch({ type: "SET_STEP", step: steps[i + 1] });
  }, [state.step, steps]);

  const goPrev = useCallback(() => {
    const i = steps.indexOf(state.step);
    if (i > 0) dispatch({ type: "SET_STEP", step: steps[i - 1] });
  }, [state.step, steps]);

  const goTo = useCallback(
    (s: WizardStep) => dispatch({ type: "SET_STEP", step: s }),
    []
  );

  const updateDraft = useCallback(
    (payload: Partial<AgentDraft>) => dispatch({ type: "UPDATE_DRAFT", payload }),
    []
  );

  return {
    state,
    steps,
    stepIndex,
    dispatch,
    goNext,
    goPrev,
    goTo,
    updateDraft,
    canProceedCurrent: canProceed(state.step, state.draft),
  };
}
