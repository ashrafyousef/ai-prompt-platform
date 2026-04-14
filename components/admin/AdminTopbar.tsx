"use client";

import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  "/admin": "Overview",
  "/admin/agents": "Agents",
  "/admin/agents/new": "Create Agent",
  "/admin/agents/import": "Import Agent",
};

function titleFromPath(path: string): string {
  if (titles[path]) return titles[path];
  const m = path.match(/^\/admin\/agents\/([^/]+)(?:\/(edit|test))?$/);
  if (m) {
    if (m[2] === "edit") return "Edit agent";
    if (m[2] === "test") return "Test agent";
    return "Agent detail";
  }
  return "Admin";
}

export function AdminTopbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname();
  const title = titleFromPath(pathname);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/80 bg-white/80 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="flex min-w-0 items-center gap-3">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="rounded-lg p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 md:hidden"
            aria-label="Open menu"
          >
            <span className="sr-only">Menu</span>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        ) : null}
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">Control panel</p>
          <h1 className="truncate text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h1>
        </div>
      </div>
    </header>
  );
}
