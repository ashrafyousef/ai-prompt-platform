"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import type { AdminAgentListItem } from "@/lib/adminTypes";
import { useToast } from "@/components/ui/Toast";

const MENU_WIDTH_PX = 208; // w-52
const MENU_GAP_PX = 4;

type MenuPosition = {
  top: number;
  left: number;
};

function computeMenuPosition(button: HTMLElement, menu: HTMLElement): MenuPosition {
  const buttonRect = button.getBoundingClientRect();
  const menuHeight = menu.offsetHeight;
  const viewportMargin = 8;

  let top = buttonRect.bottom + MENU_GAP_PX;
  if (top + menuHeight > window.innerHeight - viewportMargin) {
    const upwardTop = buttonRect.top - menuHeight - MENU_GAP_PX;
    top = upwardTop >= viewportMargin ? upwardTop : Math.max(viewportMargin, window.innerHeight - menuHeight - viewportMargin);
  }

  let left = buttonRect.right - MENU_WIDTH_PX;
  left = Math.max(viewportMargin, Math.min(left, window.innerWidth - MENU_WIDTH_PX - viewportMargin));

  return { top, left };
}

export function AgentActionsMenu({
  agent,
  onChanged,
}: {
  agent: AdminAgentListItem;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !menuRef.current) {
      setMenuPosition(null);
      return;
    }

    function updatePosition() {
      if (!buttonRef.current || !menuRef.current) return;
      setMenuPosition(computeMenuPosition(buttonRef.current, menuRef.current));
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    return () => window.removeEventListener("resize", updatePosition);
  }, [open, agent.id, agent.status]);

  useEffect(() => {
    if (!open) return;

    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onScroll() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

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

  const menu = open ? (
    <div
      ref={menuRef}
      role="menu"
      style={
        menuPosition
          ? { position: "fixed", top: menuPosition.top, left: menuPosition.left, width: MENU_WIDTH_PX }
          : { position: "fixed", top: -9999, left: -9999, width: MENU_WIDTH_PX, visibility: "hidden" as const }
      }
      className="z-50 rounded-xl border border-zinc-200 bg-white py-1 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
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
  ) : null;

  return (
    <div className="relative inline-block text-left">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${agent.name}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
