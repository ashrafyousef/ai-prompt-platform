type Props = {
  total: number;
  published: number;
  draft: number;
  archived: number;
};

export function AdminSummaryCards({ total, published, draft, archived }: Props) {
  const cards = [
    { label: "Total agents", value: total, tone: "from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950" },
    { label: "Published", value: published, tone: "from-emerald-50 to-emerald-100/80 dark:from-emerald-950/30 dark:to-emerald-900/20" },
    { label: "Draft", value: draft, tone: "from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950" },
    { label: "Archived", value: archived, tone: "from-amber-50 to-amber-100/80 dark:from-amber-950/30 dark:to-amber-900/20" },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-2xl border border-zinc-200/80 bg-gradient-to-br p-5 shadow-sm dark:border-zinc-700/80 ${c.tone}`}
        >
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{c.label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
