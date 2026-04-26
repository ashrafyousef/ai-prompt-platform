import type { AgentScope } from "@prisma/client";

const styles: Record<AgentScope, string> = {
  TEAM:
    "bg-violet-50 text-violet-800 dark:bg-violet-950/40 dark:text-violet-200 border-violet-200 dark:border-violet-800",
  GLOBAL:
    "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200 border-sky-200 dark:border-sky-800",
};

const labels: Record<AgentScope, string> = {
  GLOBAL: "Workspace-wide",
  TEAM: "Team-scoped",
};

export function AgentScopeBadge({ scope }: { scope: AgentScope }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[scope]}`}
      title={scope === "TEAM" ? "Visible to assigned team members only" : "Visible across workspace teams"}
    >
      {labels[scope]}
    </span>
  );
}
