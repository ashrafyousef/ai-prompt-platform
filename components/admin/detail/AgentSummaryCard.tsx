"use client";

export function AgentSummaryCard({
  title,
  children,
  actions,
}: {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</h2>
        {actions ?? null}
      </div>
      <div className="p-5 text-sm text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </section>
  );
}
