import Link from "next/link";

export function AdminPlaceholderPage({ title, body }: { title: string; body: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
      <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{body}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-4">
        <Link
          href="/admin/agents"
          className="text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
        >
          All agents
        </Link>
        <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800 dark:text-zinc-400">
          Overview
        </Link>
      </div>
    </div>
  );
}
