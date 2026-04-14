"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Play, Copy, Archive, Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { AdminAgentDetail } from "@/lib/adminTypes";
import { AgentStatusBadge } from "@/components/admin/AgentStatusBadge";
import { AgentScopeBadge } from "@/components/admin/AgentScopeBadge";
import { useToast } from "@/components/ui/Toast";

const btnOutline =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800";

export function AgentDetailHeader({
  agent,
  onPatch,
  onDuplicate,
}: {
  agent: AdminAgentDetail;
  onPatch: (body: Record<string, unknown>) => Promise<unknown>;
  onDuplicate: () => Promise<{ id: string; name?: string }>;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"archive" | "unpublish" | null>(null);

  async function act(key: string, body: Record<string, unknown>, msg: string) {
    setBusy(key);
    try {
      await onPatch(body);
      toast(msg);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Action failed", "error");
    } finally {
      setBusy(null);
    }
  }

  async function handleDuplicate() {
    setBusy("dup");
    try {
      const result = await onDuplicate();
      toast("Agent duplicated — opening copy…");
      router.push(`/admin/agents/${result.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Duplicate failed", "error");
    } finally {
      setBusy(null);
    }
  }

  const isPublished = agent.status === "PUBLISHED";
  const isArchived = agent.status === "ARCHIVED";
  const isDraft = agent.status === "DRAFT";

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-2xl">
            {agent.name}
          </h1>
          {agent.description ? (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{agent.description}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AgentStatusBadge status={agent.status} />
            <AgentScopeBadge scope={agent.scope} />
            {agent.team ? (
              <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                {agent.team.name}
              </span>
            ) : null}
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
              {agent.slug}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 shrink-0">
          <Link href={`/admin/agents/${agent.id}/edit`} className={btnOutline}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
          <Link
            href={`/admin/agents/${agent.id}/test`}
            className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            <Play className="h-3.5 w-3.5" /> Test
          </Link>

          {isDraft ? (
            <button
              onClick={() => void act("pub", { status: "PUBLISHED" }, "Agent published")}
              disabled={!!busy}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
            >
              {busy === "pub" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              Publish
            </button>
          ) : null}

          {isArchived ? (
            <button
              onClick={() => void act("restore", { status: "DRAFT" }, "Agent restored to draft")}
              disabled={!!busy}
              className={btnOutline}
            >
              {busy === "restore" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              Restore
            </button>
          ) : null}

          {isPublished ? (
            <button onClick={() => setConfirm("unpublish")} disabled={!!busy} className={btnOutline}>
              <EyeOff className="h-3.5 w-3.5" /> Unpublish
            </button>
          ) : null}

          {!isArchived ? (
            <button onClick={() => setConfirm("archive")} disabled={!!busy} className={btnOutline}>
              <Archive className="h-3.5 w-3.5" /> Archive
            </button>
          ) : null}

          <button onClick={handleDuplicate} disabled={!!busy} className={btnOutline}>
            {busy === "dup" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
            Duplicate
          </button>
        </div>
      </div>

      {/* Confirmation dialog */}
      {confirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirm(null)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {confirm === "archive" ? "Archive this agent?" : "Unpublish this agent?"}
            </h3>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              {confirm === "archive"
                ? "Archived agents are hidden from all users. You can restore it later from this page."
                : "This agent will revert to draft status and won't be available to users until republished."}
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const body = confirm === "archive" ? { status: "ARCHIVED" } : { status: "DRAFT" };
                  void act(confirm, body, confirm === "archive" ? "Agent archived" : "Agent unpublished");
                  setConfirm(null);
                }}
                className={`rounded-full px-4 py-2 text-sm font-medium text-white transition ${
                  confirm === "archive"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {confirm === "archive" ? "Archive" : "Unpublish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
