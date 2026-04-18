"use client";

import { CheckCircle2, AlertTriangle, XCircle, Info } from "lucide-react";

export type HealthStatus = "pass" | "warn" | "fail";

export function StatusIcon({ status, size = "sm" }: { status: HealthStatus; size?: "sm" | "md" }) {
  const cls = size === "md" ? "h-4 w-4 shrink-0" : "h-3.5 w-3.5 shrink-0";
  if (status === "pass") return <CheckCircle2 className={`${cls} text-emerald-500`} />;
  if (status === "warn") return <AlertTriangle className={`${cls} text-amber-500`} />;
  return <XCircle className={`${cls} text-red-500`} />;
}

export function sectionStatus(errors: string[], hasWarning: boolean): HealthStatus {
  if (errors.length > 0) return "fail";
  if (hasWarning) return "warn";
  return "pass";
}

export type ReadinessItem = {
  message: string;
  fix?: string;
};

export function ValidationWarnings({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/20">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-3.5 w-3.5" />
        Configuration warnings
      </p>
      <ul className="space-y-0.5 text-[11px] text-amber-700 dark:text-amber-400">
        {errors.map((e) => (
          <li key={e}>• {e}</li>
        ))}
      </ul>
    </div>
  );
}

export function ReadinessBlock({
  level,
  title,
  items,
}: {
  level: "blocking" | "recommended" | "confidence";
  title: string;
  items: ReadinessItem[];
}) {
  if (items.length === 0) return null;

  const styles =
    level === "blocking"
      ? {
          border: "border-red-200 dark:border-red-900/60",
          bg: "bg-red-50 dark:bg-red-950/20",
          header: "text-red-700 dark:text-red-300",
          text: "text-red-600 dark:text-red-300",
          fix: "text-red-500 dark:text-red-400",
          icon: <XCircle className="h-3.5 w-3.5" />,
        }
      : level === "recommended"
      ? {
          border: "border-amber-200 dark:border-amber-900/60",
          bg: "bg-amber-50 dark:bg-amber-950/20",
          header: "text-amber-700 dark:text-amber-300",
          text: "text-amber-700 dark:text-amber-200",
          fix: "text-amber-600 dark:text-amber-400",
          icon: <AlertTriangle className="h-3.5 w-3.5" />,
        }
      : {
          border: "border-zinc-200 dark:border-zinc-700",
          bg: "bg-zinc-50 dark:bg-zinc-900/50",
          header: "text-zinc-600 dark:text-zinc-300",
          text: "text-zinc-500 dark:text-zinc-400",
          fix: "text-zinc-500 dark:text-zinc-500",
          icon: <Info className="h-3.5 w-3.5" />,
        };

  return (
    <div className={`rounded-xl border ${styles.border} ${styles.bg} p-4`}>
      <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide ${styles.header}`}>
        {styles.icon}
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.message}>
            <p className={`text-xs ${styles.text}`}>• {item.message}</p>
            {item.fix ? (
              <p className={`ml-3 mt-0.5 text-[11px] italic ${styles.fix}`}>
                Fix: {item.fix}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
