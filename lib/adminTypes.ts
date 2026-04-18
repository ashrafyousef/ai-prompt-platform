import type { AgentScope, AgentStatus, OutputFormat } from "@prisma/client";
import type { AgentBuilderInputSchema, AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";

export type AdminAgentListItem = {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  status: AgentStatus;
  scope: AgentScope;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  team: { id: string; name: string; slug: string } | null;
};

export type AdminAgentDetail = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  inputSchema: AgentBuilderInputSchema | Record<string, unknown> | null;
  outputFormat: OutputFormat;
  outputSchema: Record<string, unknown> | null;
  knowledgeItems?: AgentKnowledgeItem[];
  outputConfig?: AgentOutputConfig;
  temperature: number;
  maxTokens: number;
  isEnabled: boolean;
  status: AgentStatus;
  scope: AgentScope;
  teamId: string | null;
  team: { id: string; name: string; slug: string } | null;
  createdAt: string;
  updatedAt: string;
  _count: { messages: number };
};

export type AdminOverviewStats = {
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
  };
  byTeam: Array<{ teamId: string | null; teamName: string; count: number }>;
  recent: Array<{
    id: string;
    name: string;
    teamName: string | null;
    status: AgentStatus;
    updatedAt: string;
  }>;
};
