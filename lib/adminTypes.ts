import type { AgentScope, AgentStatus, OutputFormat } from "@prisma/client";
import type { AgentKnowledgeItem, AgentOutputConfig } from "@/lib/agentConfig";
import type { AgentModelPreferences } from "@/lib/agentModelPolicy";
import type { UiStarterPrompt } from "@/lib/types";

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
  inputSchema: Record<string, unknown> | null;
  outputFormat: OutputFormat;
  outputSchema: Record<string, unknown> | null;
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
  effectiveConfig?: {
    knowledgeItems: AgentKnowledgeItem[];
    outputConfig: AgentOutputConfig;
    starterPrompts: UiStarterPrompt[];
    modelPreferences: AgentModelPreferences;
    requiresStructuredOutput: boolean;
    behaviorMeta: {
      behaviorRules: string;
      toneGuidance: string;
      avoidRules: string;
      strictMode: boolean;
      importMethod: string | null;
    };
    identityMeta: {
      icon: string | null;
      category: string | null;
    };
  };
};

export type AdminOverviewStats = {
  counts: {
    total: number;
    published: number;
    draft: number;
    archived: number;
    workspaceWide: number;
    teamScoped: number;
    members: number;
    activeMembers: number;
    teams: number;
    archivedTeams: number;
    knowledgeTotal: number;
    knowledgeActive: number;
    knowledgeInactive: number;
  };
  recommendations: Array<{
    id: string;
    label: string;
    href: string;
  }>;
  attention: {
    draftAgents: Array<{
      id: string;
      name: string;
      teamName: string | null;
      updatedAt: string;
    }>;
    archivedAgents: Array<{
      id: string;
      name: string;
      teamName: string | null;
      updatedAt: string;
    }>;
    teamsWithoutAgents: Array<{
      id: string;
      name: string;
      isArchived: boolean;
    }>;
    inactiveKnowledgeByAgent: Array<{
      agentId: string;
      agentName: string;
      teamName: string | null;
      inactiveCount: number;
    }>;
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
