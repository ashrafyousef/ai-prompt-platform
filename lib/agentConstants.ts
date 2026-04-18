import type { AgentKnowledgeSourceType, AgentOutputConfig, AgentResponseDepth, AgentCitationsPolicy } from "./agentConfig";

export const SOURCE_TYPE_LABELS: Record<AgentKnowledgeSourceType, string> = {
  manual_text: "Manual text",
  faq: "FAQ",
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  glossary: "Glossary",
  rules: "Rules",
  examples: "Examples",
};

export const SOURCE_TYPE_HELPERS: Record<AgentKnowledgeSourceType, string> = {
  manual_text: "General reference text maintained directly in the builder.",
  faq: "Question-answer pairs for common user asks and repetitive support cases.",
  pdf: "Uploaded document source tracked by file metadata.",
  docx: "Uploaded Word document source tracked by file metadata.",
  txt: "Uploaded plain-text source for lightweight references.",
  glossary: "Term definitions and canonical vocabulary.",
  rules: "Policies, constraints, and non-negotiable instructions.",
  examples: "High-quality exemplars that demonstrate expected responses.",
};

export const DEPTH_OPTIONS: Array<{ value: AgentResponseDepth; label: string; hint: string }> = [
  { value: "brief", label: "Brief", hint: "Short, direct answers. Fewer than ~150 words." },
  { value: "standard", label: "Standard", hint: "Balanced responses. Typical conversational depth." },
  { value: "detailed", label: "Detailed", hint: "Thorough, comprehensive answers with supporting detail." },
];

export const CITATIONS_OPTIONS: Array<{ value: AgentCitationsPolicy; label: string; hint: string }> = [
  { value: "none", label: "None", hint: "Agent does not cite sources." },
  { value: "optional", label: "Optional", hint: "Agent may cite sources when relevant." },
  { value: "required", label: "Required", hint: "Agent must cite sources for every claim. Best for knowledge-backed agents." },
];

export const FALLBACK_SUGGESTIONS = [
  "State when information is missing",
  "Ask a clarifying question first",
  "Provide best-effort answer with limitations noted",
] as const;

export const REQUIRED_SECTION_PRESETS = [
  "Summary",
  "Key recommendations",
  "Risks",
  "Next steps",
  "Citations",
] as const;

/* ------------------------------------------------------------------ */
/*  Agent presets                                                      */
/* ------------------------------------------------------------------ */

export type AgentPreset = {
  id: string;
  label: string;
  icon: string;
  description: string;
  category: string;
  defaults: {
    systemInstructions: string;
    toneGuidance: string;
    outputMode: "markdown" | "structured-markdown" | "json" | "template";
    responseDepth: AgentResponseDepth;
    citationsPolicy: AgentCitationsPolicy;
    fallbackBehavior: string;
    temperature: number;
    maxTokens: number;
    structuredSections: Array<{ id: string; title: string; required: boolean }>;
    starterPrompts: Array<{ id: string; text: string }>;
  };
};

let _presetUid = 0;
function pid(prefix = "pre") {
  return `${prefix}-${++_presetUid}`;
}

export const AGENT_PRESETS: AgentPreset[] = [
  {
    id: "simple",
    label: "Simple Assistant",
    icon: "💬",
    description: "A general-purpose conversational agent with sensible defaults.",
    category: "",
    defaults: {
      systemInstructions: "You are a helpful, professional assistant. Answer user questions clearly and concisely.",
      toneGuidance: "Professional but approachable. Use plain language.",
      outputMode: "markdown",
      responseDepth: "standard",
      citationsPolicy: "none",
      fallbackBehavior: "If you're unsure, say so and suggest how the user can rephrase or find the answer.",
      temperature: 0.4,
      maxTokens: 800,
      structuredSections: [],
      starterPrompts: [
        { id: pid("sp"), text: "Help me summarize this document" },
        { id: pid("sp"), text: "What are the key points in this topic?" },
      ],
    },
  },
  {
    id: "knowledge",
    label: "Knowledge-Backed Assistant",
    icon: "📚",
    description: "Grounded in reference material. Best when paired with uploaded sources.",
    category: "Research & Analysis",
    defaults: {
      systemInstructions: "You are a knowledge-backed assistant. Use attached sources to answer questions accurately. When sources don't cover a topic, say so explicitly.",
      toneGuidance: "Precise and informative. Cite sources when possible.",
      outputMode: "structured-markdown",
      responseDepth: "detailed",
      citationsPolicy: "required",
      fallbackBehavior: "State clearly what information is missing and which sources were checked.",
      temperature: 0.3,
      maxTokens: 1200,
      structuredSections: [
        { id: pid("sec"), title: "Answer", required: true },
        { id: pid("sec"), title: "Sources", required: true },
      ],
      starterPrompts: [
        { id: pid("sp"), text: "What does the policy say about…" },
        { id: pid("sp"), text: "Find references related to…" },
      ],
    },
  },
  {
    id: "structured",
    label: "Structured Report Agent",
    icon: "📊",
    description: "Delivers responses with consistent, scannable sections.",
    category: "Research & Analysis",
    defaults: {
      systemInstructions: "You are an analyst that provides structured, well-organized reports. Always use the required sections in your responses.",
      toneGuidance: "Analytical and neutral. Avoid speculation.",
      outputMode: "structured-markdown",
      responseDepth: "detailed",
      citationsPolicy: "optional",
      fallbackBehavior: "Provide available analysis and clearly flag gaps or assumptions.",
      temperature: 0.3,
      maxTokens: 1500,
      structuredSections: [
        { id: pid("sec"), title: "Summary", required: true },
        { id: pid("sec"), title: "Key findings", required: true },
        { id: pid("sec"), title: "Risks", required: false },
        { id: pid("sec"), title: "Next steps", required: true },
      ],
      starterPrompts: [
        { id: pid("sp"), text: "Analyze the pros and cons of…" },
        { id: pid("sp"), text: "Compare these two approaches…" },
      ],
    },
  },
  {
    id: "policy",
    label: "Policy & Process Agent",
    icon: "📋",
    description: "Enforces rules and processes. Ideal for compliance or internal support.",
    category: "Strategy & Planning",
    defaults: {
      systemInstructions: "You are a policy and process assistant. Answer only based on documented policies and procedures. Do not speculate or improvise answers.",
      toneGuidance: "Authoritative, clear, and precise. No hedging on known rules.",
      outputMode: "structured-markdown",
      responseDepth: "standard",
      citationsPolicy: "required",
      fallbackBehavior: "State that the question is not covered by current documentation and suggest contacting the relevant team.",
      temperature: 0.2,
      maxTokens: 1000,
      structuredSections: [
        { id: pid("sec"), title: "Policy reference", required: true },
        { id: pid("sec"), title: "Action required", required: false },
      ],
      starterPrompts: [
        { id: pid("sp"), text: "What is the policy on…" },
        { id: pid("sp"), text: "What steps do I follow for…" },
      ],
    },
  },
  {
    id: "writer",
    label: "Writing Assistant",
    icon: "✍️",
    description: "Helps draft and edit content — emails, copy, documentation.",
    category: "Content & Copy",
    defaults: {
      systemInstructions: "You are a skilled writing assistant. Help users draft, edit, and improve written content. Offer multiple variations when asked.",
      toneGuidance: "Adaptable to the user's requested style. Default to professional and clear.",
      outputMode: "markdown",
      responseDepth: "standard",
      citationsPolicy: "none",
      fallbackBehavior: "Ask the user for more context about audience, tone, or purpose before proceeding.",
      temperature: 0.6,
      maxTokens: 1200,
      structuredSections: [],
      starterPrompts: [
        { id: pid("sp"), text: "Draft a professional email about…" },
        { id: pid("sp"), text: "Rewrite this paragraph to be more concise" },
        { id: pid("sp"), text: "Suggest 3 headline options for…" },
      ],
    },
  },
  {
    id: "analysis",
    label: "Analysis Assistant",
    icon: "🔬",
    description: "Breaks down complex topics with structured reasoning.",
    category: "Research & Analysis",
    defaults: {
      systemInstructions: "You are an analytical assistant. Break down complex questions with structured reasoning, evidence, and clear conclusions.",
      toneGuidance: "Thoughtful and methodical. Support claims with reasoning.",
      outputMode: "structured-markdown",
      responseDepth: "detailed",
      citationsPolicy: "optional",
      fallbackBehavior: "Acknowledge limitations in available data and present the strongest analysis possible.",
      temperature: 0.35,
      maxTokens: 1500,
      structuredSections: [
        { id: pid("sec"), title: "Summary", required: true },
        { id: pid("sec"), title: "Analysis", required: true },
        { id: pid("sec"), title: "Conclusion", required: true },
      ],
      starterPrompts: [
        { id: pid("sp"), text: "Break down the key factors in…" },
        { id: pid("sp"), text: "What are the implications of…" },
      ],
    },
  },
];

export const DOCUMENT_ACCEPT = ".pdf,.docx,.txt,.md,.csv,.json";
export const DOCUMENT_MAX_SIZE_LABEL = "PDF, DOCX, TXT, MD, CSV, JSON · Max 20 MB";

let _uid = 0;
export function nextUid(prefix = "u") {
  return `${prefix}-${++_uid}-${Date.now()}`;
}

export function validateOutputConfig(config: AgentOutputConfig): string[] {
  const errors: string[] = [];
  if (config.citationsPolicy === "required" && config.responseDepth === "brief") {
    errors.push("Citations required + brief depth may produce responses too short for useful sourcing. Increase depth or relax citations.");
  }
  if (config.format === "template" && !config.template?.trim()) {
    errors.push("Template format is selected but the template body is empty. Add template text or switch to markdown.");
  }
  if (config.requiredSections.length > 0 && config.format === "json") {
    errors.push("Required sections only apply to markdown responses. For JSON output, define fields in the schema instead.");
  }
  return errors;
}

type DraftOutputFields = {
  outputMode: string;
  structuredSections: Array<{ title: string; required: boolean }>;
  jsonSchema: Array<{ name: string; type: string; description: string; required: boolean }>;
  templateText: string;
  responseDepth: AgentResponseDepth;
  citationsPolicy: AgentCitationsPolicy;
  fallbackBehavior: string;
};

export function buildOutputConfigFromDraft(d: DraftOutputFields): AgentOutputConfig {
  return {
    format:
      d.outputMode === "json"
        ? "json"
        : d.outputMode === "template"
        ? "template"
        : "markdown",
    requiredSections: d.structuredSections
      .map((s) => s.title.trim())
      .filter(Boolean),
    responseDepth: d.responseDepth,
    citationsPolicy: d.citationsPolicy,
    fallbackBehavior: d.fallbackBehavior,
    template: d.templateText.trim() || null,
    schema:
      d.outputMode === "json"
        ? {
            type: "object",
            properties: Object.fromEntries(
              d.jsonSchema.map((f) => [
                f.name || "field",
                { type: f.type, description: f.description },
              ])
            ),
            required: d.jsonSchema
              .filter((f) => f.required)
              .map((f) => f.name),
          }
        : null,
  };
}

type KnowledgeSourceLike = {
  id: string;
  title: string;
  sourceType: AgentKnowledgeSourceType;
  content: string | null;
  fileRef?: { fileName: string; mimeType?: string; sizeBytes?: number; url?: string } | null;
  summary: string;
  tags: string[];
  priority: number;
  appliesTo: "all" | string;
  isActive: boolean;
  ownerNote: string;
  lastReviewedAt?: string | null;
};

export function buildKnowledgePayload(sources: KnowledgeSourceLike[]) {
  return sources.map((k) => ({
    id: k.id,
    title: k.title,
    sourceType: k.sourceType,
    content: k.content,
    fileRef: k.fileRef ?? null,
    summary: k.summary,
    tags: k.tags,
    priority: k.priority,
    appliesTo: k.appliesTo,
    isActive: k.isActive,
    ownerNote: k.ownerNote,
    lastReviewedAt: k.lastReviewedAt ?? null,
  }));
}
