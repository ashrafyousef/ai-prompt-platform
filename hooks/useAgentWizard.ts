"use client";

import { useCallback, useReducer } from "react";

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
  type: "text" | "file";
  title: string;
  content: string;
  fileName?: string;
  status: "ready" | "uploading" | "error";
};

export type AgentDraft = {
  importMethod: ImportMethod;

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

  starterPrompts: Array<{ id: string; text: string }>;
};

export type WizardStep =
  | "import-method"
  | "identity"
  | "behavior"
  | "knowledge"
  | "output"
  | "starter-prompts"
  | "review";

export const WIZARD_STEPS: WizardStep[] = [
  "import-method",
  "identity",
  "behavior",
  "knowledge",
  "output",
  "starter-prompts",
  "review",
];

export const STEP_LABELS: Record<WizardStep, string> = {
  "import-method": "Import Method",
  identity: "Identity",
  behavior: "Behavior & Instructions",
  knowledge: "Knowledge",
  output: "Output Rules",
  "starter-prompts": "Starter Prompts",
  review: "Review",
};

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

export const DEFAULT_DRAFT: AgentDraft = {
  importMethod: "manual",
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
  if (!d.name.trim()) errs.push("Agent name is required.");
  if (d.scope === "TEAM" && !d.teamId) errs.push("Team is required when scope is TEAM.");
  return errs;
}

export function validateBehavior(d: AgentDraft): string[] {
  const errs: string[] = [];
  if (!d.systemInstructions.trim()) errs.push("System instructions cannot be empty.");
  return errs;
}

export function validateOutput(d: AgentDraft): string[] {
  const errs: string[] = [];
  if (d.outputMode === "json" && d.jsonSchema.length === 0) {
    errs.push("Add at least one schema field for JSON output.");
  }
  if (d.outputMode === "template" && !d.templateText.trim()) {
    errs.push("Template text is required.");
  }
  if (d.outputMode === "structured-markdown" && d.structuredSections.length === 0) {
    errs.push("Add at least one section for structured markdown.");
  }
  return errs;
}

export function canProceed(step: WizardStep, d: AgentDraft): boolean {
  switch (step) {
    case "import-method":
      return true;
    case "identity":
      return validateIdentity(d).length === 0;
    case "behavior":
      return validateBehavior(d).length === 0;
    case "knowledge":
      return true;
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

  const steps = state.isImportFlow
    ? WIZARD_STEPS
    : WIZARD_STEPS.filter((s) => s !== "import-method");

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
