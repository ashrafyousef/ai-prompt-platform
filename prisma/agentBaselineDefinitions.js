/**
 * Beta 1.2 agent baseline definitions (Phase 2A).
 * Used by scripts/seed-beta-agent-baseline.js — placeholders and published Visual Director only.
 */

const VISUAL_DIRECTOR_SYSTEM_PROMPT = `You are Visual Director, an AI assistant for creative direction and visual prompt engineering.

Your role:
- Help users develop creative direction, prompt strategy, and copy-ready prompts for image generation systems.
- Analyze reference images when provided and ground your guidance in what you see.
- Adapt response structure to the task: use clear sections such as Creative direction, Prompt strategy, and Final prompt when the user asks for substantive creative work.
- For brief conversational turns (thanks, ok, short follow-ups), reply naturally without forcing section templates.

You do not generate images. If asked to create or render an image, explain that you help with creative direction and prompts, not image generation.

Stay practical, specific, and production-oriented. Do not add meta commentary about being an AI unless asked.`;

const NUR_CREATIVE_DIRECTOR_PLACEHOLDER_PROMPT =
  "You are Nur, Creative Director. This agent is a reserved placeholder for upcoming Beta 1.2 workflow features. Do not use for production creative tasks yet.";

function buildInputSchema({
  starterPrompts,
  category,
  modelPreferences,
  outputConfigOverrides = {},
}) {
  return {
    version: 2,
    starterPrompts,
    knowledgeItems: [],
    knowledge: [],
    outputConfig: {
      format: "markdown",
      requiredSections: [],
      responseDepth: "standard",
      citationsPolicy: "none",
      fallbackBehavior:
        "Provide a best-effort response in markdown when strict formatting cannot be satisfied.",
      template: null,
      schema: null,
      ...outputConfigOverrides,
    },
    modelPreferences: {
      preferredModelId: null,
      allowedModelIds: [],
      requiresStructuredOutput: null,
      requiredCapabilities: [],
      fallbackBehavior: "suggest_compatible",
      notes: "",
      ...modelPreferences,
    },
    examples: [],
    evaluationSeedPrompts: [],
    guardrails: [],
    modes: [],
    meta: {
      identity: { icon: null, category },
      behavior: {
        behaviorRules: "",
        toneGuidance: "",
        avoidRules: "",
        strictMode: false,
        importMethod: "beta-agent-baseline",
      },
    },
  };
}

const VISUAL_DIRECTOR_BASELINE = {
  slug: "visual-director",
  name: "Visual Director",
  description:
    "Creative direction and visual prompt specialist for image-generation workflows.",
  systemPrompt: VISUAL_DIRECTOR_SYSTEM_PROMPT,
  outputFormat: "markdown",
  temperature: 0.4,
  maxTokens: 900,
  status: "PUBLISHED",
  isEnabled: true,
  scope: "GLOBAL",
  teamId: null,
  inputSchema: buildInputSchema({
    category: "visual",
    starterPrompts: [
      "Who are you?",
      "Analyze this image and improve the creative direction",
      "Develop a visual prompt for a premium product hero shot",
      "Can you create the image?",
    ],
    modelPreferences: {
      preferredModelId: "openai-gpt-5.4-mini",
      requiredCapabilities: ["vision"],
      notes: "Beta 1.2 baseline — preserves prior visual-prompt assistant behavior under Visual Director.",
    },
  }),
};

const NUR_CREATIVE_DIRECTOR_BASELINE = {
  slug: "nur-creative-director",
  name: "Nur - Creative Director",
  description:
    "Reserved Creative Director identity for Beta 1.2 workflow work (placeholder; not active yet).",
  systemPrompt: NUR_CREATIVE_DIRECTOR_PLACEHOLDER_PROMPT,
  outputFormat: "markdown",
  temperature: 0.4,
  maxTokens: 800,
  status: "DRAFT",
  isEnabled: false,
  scope: "GLOBAL",
  teamId: null,
  inputSchema: buildInputSchema({
    category: "creative",
    starterPrompts: [],
    modelPreferences: {
      notes: "Placeholder agent — enable and replace system prompt when Nur workflow ships.",
    },
  }),
};

const BETA_AGENT_BASELINES = [VISUAL_DIRECTOR_BASELINE, NUR_CREATIVE_DIRECTOR_BASELINE];

module.exports = {
  BETA_AGENT_BASELINES,
  VISUAL_DIRECTOR_BASELINE,
  NUR_CREATIVE_DIRECTOR_BASELINE,
};
