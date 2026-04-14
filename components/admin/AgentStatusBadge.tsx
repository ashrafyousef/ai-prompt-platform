import type { AgentStatus } from "@prisma/client";

const styles: Record<AgentStatus, string> = {
  DRAFT:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600",
  PUBLISHED:
    "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  ARCHIVED:
    "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200 border-amber-200 dark:border-amber-800",
};

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}
