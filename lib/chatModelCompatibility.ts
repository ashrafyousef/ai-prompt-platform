/**
 * Barrel re-exports for chat UI — implementation and send-time twin live in `chatAgentModelRules.ts`.
 * `UiAgent` fields come from GET /api/agents after `normalizeAgentInputSchema` (`modelPreferences`).
 */

export type { ChatCompatibilityIssue } from "./chatAgentModelRules";

export {
  computeModelCompatibilityIssues as computeChatModelCompatibilityIssues,
  effectiveAgentRequiresStructuredCapability as agentRequiresStructuredCapability,
  estTokensFromChars,
} from "./chatAgentModelRules";
