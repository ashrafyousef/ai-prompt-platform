import { AgentConfig } from "@prisma/client";

export function requiresJsonOutput(agent: Pick<AgentConfig, "outputSchema">): boolean {
  return Boolean(agent.outputSchema);
}

export function getOutputMode(agent: Pick<AgentConfig, "outputSchema" | "outputFormat">):
  | "json"
  | "markdown"
  | "template" {
  return requiresJsonOutput(agent) ? "json" : agent.outputFormat;
}
