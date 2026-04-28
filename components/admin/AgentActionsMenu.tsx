"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { AdminAgentListItem } from "@/lib/adminTypes";
import { useToast } from "@/components/ui/Toast";

export function AgentActionsMenu({
  agent,
  onChanged,
}: {
  agent: AdminAgentListItem;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/agents/${agent.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(typeof data.error === "string" ? data.error : "Update failed", "error");
      return;
    }
    toast("Agent updated");
    onChanged();
    setOpen(false);
  }

  async function duplicate() {
    const res = await fetch(`/api/admin/agents/${agent.id}/duplicate`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast(typeof data.error === "string" ? data.error : "Duplicate failed", "error");
      return;
    }
    toast("Duplicate created");
    onChanged();
    setOpen(false);
    if (data.agent?.id) {
      router.push(`/admin/agents/${data.agent.id}/edit`);
    }
  }

  const canPublish = agent.status !== "PUBLISHED";
  const canUnpublish = agent.status === "PUBLISHED";
  const canArchive = agent.status !== "ARCHIVED";
  const audienceLabel = agent.scope === "TEAM" ? agent.team?.name ?? "assigned team" : "workspace";

  function confirmHighImpactAction(message: string) {
    return window.confirm(message);
  }

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${agent.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 w-52 rounded-xl border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <Link
            role="menuitem"
            href={`/admin/agents/${agent.id}`}
            className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            View
          </Link>
          <Link
            role="menuitem"
            href={`/admin/agents/${agent.id}/edit`}
            className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            Edit
          </Link>
          <Link
            role="menuitem"
            href={`/admin/agents/${agent.id}/test`}
            className="block px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => setOpen(false)}
          >
            Test
          </Link>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
            onClick={() => {
              const confirmed = confirmHighImpactAction(
                `Duplicate "${agent.name}" with the same ${agent.scope === "TEAM" ? "team-scoped" : "workspace-wide"} visibility settings?`
              );
              if (!confirmed) return;
              void duplicate();
            }}
          >
            Duplicate (keep scope)
          </button>
          <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
          {canPublish ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                const confirmed = confirmHighImpactAction(
                  `Publish "${agent.name}" for ${audienceLabel} chat visibility?`
                );
                if (!confirmed) return;
                void patch({ status: "PUBLISHED", isEnabled: true });
              }}
              title={
                agent.scope === "TEAM"
                  ? `Make visible to ${agent.team?.name ?? "the assigned team"} in chat`
                  : "Make visible workspace-wide in chat"
              }
            >
              Publish ({agent.scope === "TEAM" ? "team chat visibility" : "workspace chat visibility"})
            </button>
          ) : null}
          {canUnpublish ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
              onClick={() => {
                const confirmed = confirmHighImpactAction(
                  `Unpublish "${agent.name}" and hide it from ${audienceLabel} chat?`
                );
                if (!confirmed) return;
                void patch({ status: "DRAFT", isEnabled: false });
              }}
            >
              Unpublish (hide from {agent.scope === "TEAM" ? "team chat" : "workspace chat"})
            </button>
          ) : null}
          {canArchive ? (
            <button
              type="button"
              className="block w-full px-3 py-2 text-left text-amber-800 hover:bg-amber-50 dark:text-amber-200 dark:hover:bg-amber-950/40"
              onClick={() => {
                const confirmed = confirmHighImpactAction(
                  `Archive "${agent.name}"? It will be hidden from chat until restored.`
                );
                if (!confirmed) return;
                void patch({ status: "ARCHIVED", isEnabled: false });
              }}
            >
              Archive (hide + freeze)
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="block w-full cursor-not-allowed px-3 py-2 text-left text-zinc-400"
              title="Already archived"
            >
              Archive
            </button>
          )}
          <div className="my-1 border-t border-zinc-100 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            Visibility context: {agent.scope === "TEAM" ? `team-scoped (${audienceLabel})` : "workspace-wide"}.
          </div>
        </div>
      ) : null}
    </div>
  );
}
