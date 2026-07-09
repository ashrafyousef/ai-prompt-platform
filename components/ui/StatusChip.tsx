import { cn } from "@/lib/ui/cn";

export type StatusChipStatus =
  | "active"
  | "inactive"
  | "archived"
  | "draft"
  | "submitted"
  | "in_review"
  | "needs_changes"
  | "approved"
  | "ready"
  | "pending"
  | "failed"
  | "revoked"
  | "expired"
  | "accepted"
  | "neutral";

export type StatusChipProps = {
  status: StatusChipStatus;
  label?: string;
  className?: string;
};

const statusClasses: Record<StatusChipStatus, string> = {
  active: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  inactive: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  archived: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  draft: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  submitted: "bg-sky-100/90 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300",
  in_review: "bg-amber-100/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  needs_changes: "bg-amber-100/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  approved: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  ready: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  pending: "bg-amber-100/90 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  failed: "bg-red-100/90 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  revoked: "bg-red-100/90 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  expired: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  accepted: "bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  neutral: "bg-zinc-100/90 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const defaultLabels: Record<StatusChipStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
  draft: "Draft",
  submitted: "Submitted",
  in_review: "In review",
  needs_changes: "Needs changes",
  approved: "Approved",
  ready: "Ready",
  pending: "Pending",
  failed: "Failed",
  revoked: "Revoked",
  expired: "Expired",
  accepted: "Accepted",
  neutral: "Neutral",
};

export function StatusChip({ status, label, className }: StatusChipProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        statusClasses[status],
        className
      )}
    >
      {label ?? defaultLabels[status]}
    </span>
  );
}

export function invitationStatusToChipStatus(status: string): StatusChipStatus {
  switch (status.toLowerCase()) {
    case "pending":
      return "pending";
    case "accepted":
      return "accepted";
    case "revoked":
      return "revoked";
    case "expired":
      return "expired";
    default:
      return "neutral";
  }
}
