import { MODEL_CAPABILITY_LABELS } from "@/lib/modelUiLabels";
import type { UiAgent, UiModelCapability, UiModelSummary } from "@/lib/types";

function capLabel(cap: string): string {
  return cap in MODEL_CAPABILITY_LABELS
    ? MODEL_CAPABILITY_LABELS[cap as UiModelCapability]
    : cap;
}

/**
 * User-facing copy for agent model expectations. Inputs: `UiAgent` from GET /api/agents (normalized `modelPreferences`)
 * and the current user’s governed `models` from GET /api/models. Copy-only — enforcement stays in
 * `chatAgentModelRules` + chat send route.
 */

function modelLabel(models: UiModelSummary[], id: string): string {
  return models.find((m) => m.id === id)?.displayName ?? id;
}

/** Short bullets for drawer / empty state (plain language). */
export function buildAgentModelExpectationLines(
  agent: UiAgent | undefined,
  models: UiModelSummary[]
): string[] {
  if (!agent) return [];
  const lines: string[] = [];

  if (agent.preferredModelId) {
    const m = models.find((x) => x.id === agent.preferredModelId);
    if (m?.enabled) {
      lines.push(
        `Prefers ${m.displayName} — a recommendation; your account or limits may still hide it, and you can choose another allowed model.`
      );
    } else {
      lines.push(
        `Publisher chose a preferred model${m ? ` (${m.displayName})` : ""} — it may be unavailable for your account or governance.`
      );
    }
  }

  const allowed = agent.allowedModelIds ?? [];
  if (allowed.length > 0) {
    const visibleIds = allowed.filter((id) => models.some((m) => m.id === id));
    const names = visibleIds.map((id) => modelLabel(models, id));
    const shown = names.slice(0, 5).join(", ");
    const extra = visibleIds.length > 5 ? ` (+${visibleIds.length - 5} more)` : "";
    if (names.length > 0) {
      lines.push(`Only these models can be used with this assistant: ${shown}${extra}.`);
    }
    if (visibleIds.length < allowed.length) {
      lines.push(
        `Some publisher-approved models are not in your current model list (role, budget, or workspace policy). Pick from your available models.`
      );
    }
  }

  const caps = agent.requiredCapabilities ?? [];
  if (caps.length > 0) {
    const labels = caps.map((c) => capLabel(c));
    lines.push(`Your selected model must support: ${labels.join(", ")}.`);
  }

  return lines;
}

/** One line for empty state / compact chrome (max ~140 chars). */
export function compactAgentModelSummaryLine(
  agent: UiAgent | undefined,
  models: UiModelSummary[]
): string | null {
  if (!agent) return null;
  const parts: string[] = [];

  if (agent.preferredModelId) {
    const m = models.find((x) => x.id === agent.preferredModelId && x.enabled);
    parts.push(m ? `Prefers ${m.displayName}` : "Has a preferred model");
  }
  const allowed = agent.allowedModelIds ?? [];
  if (allowed.length > 0) {
    parts.push(allowed.length === 1 ? "One allowed model" : `${allowed.length} allowed models`);
  }
  const caps = agent.requiredCapabilities ?? [];
  if (caps.length > 0) {
    parts.push(
      `Needs ${caps.map((c) => capLabel(c)).join(", ")}`
    );
  }

  if (parts.length === 0) return null;
  let s = parts.join(" · ");
  if (s.length > 140) s = `${s.slice(0, 137)}…`;
  return s;
}

/**
 * Single-line hint next to the model control when there are no compatibility banners
 * (avoids repeating the same story).
 */
export function compactModelSelectorHint(
  agent: UiAgent | undefined,
  models: UiModelSummary[]
): string | null {
  return compactAgentModelSummaryLine(agent, models);
}
