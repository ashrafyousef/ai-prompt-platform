"use client";

type StrategyStatus = "DRAFT" | "READY_FOR_CREATIVE" | "ARCHIVED";

function toneClasses(tone: "done" | "active" | "locked"): string {
  if (tone === "done") {
    return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
  if (tone === "active") {
    return "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300";
  }
  return "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400";
}

function StagePill({ label, tone }: { label: string; tone: "done" | "active" | "locked" }) {
  return (
    <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${toneClasses(tone)}`}>
      {label}
    </div>
  );
}

/** Rendered only on approved-brief project pages. */
export function StrategyWorkflowSpine({
  strategyStatus,
}: {
  strategyStatus: StrategyStatus | null;
}) {
  const strategyReady = strategyStatus === "READY_FOR_CREATIVE";
  const strategyTone = strategyReady ? "done" : "active";
  const readyTone = strategyReady ? "done" : "locked";

  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Workflow</h2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StagePill label="Brief Approved" tone="done" />
        <span className="text-zinc-400">→</span>
        <StagePill label="Strategy Direction" tone={strategyTone} />
        <span className="text-zinc-400">→</span>
        <StagePill label="Ready for Creative" tone={readyTone} />
      </div>
    </section>
  );
}
