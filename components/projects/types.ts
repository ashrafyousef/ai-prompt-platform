import type { BriefDocumentV2 } from "@/lib/briefIntake";
import type { StrategyDocumentV1 } from "@/lib/strategyDocument";

export type ProjectStatus = "DRAFT" | "ACTIVE" | "ARCHIVED";
export type BriefStatus = "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";

export type BriefSummary = {
  id: string;
  projectId: string;
  title: string;
  status: string;
  responsesJson: BriefDocumentV2;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StrategySummary = {
  id: string;
  projectId: string;
  sourceBriefId: string;
  status: "DRAFT" | "READY_FOR_CREATIVE" | "ARCHIVED";
  responsesJson: StrategyDocumentV1;
  readyAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectChatSession = {
  id: string;
  title: string;
  updatedAt: string;
  summary: string | null;
};

export type ProjectDetail = {
  id: string;
  name: string;
  slug: string;
  status: ProjectStatus;
  clientId: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; slug: string } | null;
  teams: Array<{ id: string; name: string; slug: string }>;
  brief: BriefSummary | null;
  strategy: StrategySummary | null;
};

export function formatProjectDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatProjectDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatProjectTeams(teams: ProjectDetail["teams"]): string {
  if (teams.length === 0) return "—";
  return teams.map((team) => team.name).join(", ");
}
