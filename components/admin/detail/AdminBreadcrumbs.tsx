"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

type Crumb = { label: string; href?: string };

export function AdminBreadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 ? <ChevronRight className="h-3 w-3" /> : null}
          {c.href ? (
            <Link href={c.href} className="hover:text-zinc-800 dark:hover:text-zinc-200 transition">
              {c.label}
            </Link>
          ) : (
            <span className="text-zinc-800 font-medium dark:text-zinc-200">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
