"use client";

import Link from "next/link";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Ellipsis, Plus, Share2, Trash2, Zap } from "lucide-react";
import { AccountMenu } from "@/components/chat/AccountMenu";
import { UiSession } from "@/lib/types";
import { useSession } from "next-auth/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  sessions: UiSession[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShare: (id: string) => Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSearch: (query: string) => Promise<void>;
};

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onShare,
  collapsed,
  onToggleCollapse,
  onSearch,
}: Props) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: session } = useSession();
  const { data: usageData } = useSWR("/api/usage", fetcher, { refreshInterval: 30000 });

  useEffect(() => {
    if (!editingSessionId) return;
    const current = sessions.find((session) => session.id === editingSessionId);
    if (current) setTitleDraft(current.title);
  }, [editingSessionId, sessions]);

  async function submitRename(sessionId: string) {
    const next = titleDraft.trim();
    if (!next) return;
    await onRename(sessionId, next);
    setEditingSessionId(null);
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLInputElement>, sessionId: string) {
    if (event.key === "Enter") {
      event.preventDefault();
      void submitRename(sessionId);
    } else if (event.key === "Escape") {
      setEditingSessionId(null);
    }
  }

  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuSessionId(null);
      }
    }
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuSessionId(null);
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      void onSearch(search.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, onSearch]);

  const groupedSessions = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(todayStart.getDate() - 1);
    const last7Start = new Date(todayStart);
    last7Start.setDate(todayStart.getDate() - 7);

    const buckets: Record<string, UiSession[]> = {
      Today: [],
      Yesterday: [],
      "Last 7 Days": [],
      Older: [],
    };

    for (const session of sessions) {
      const updated = new Date(session.updatedAt);
      if (updated >= todayStart) buckets.Today.push(session);
      else if (updated >= yesterdayStart) buckets.Yesterday.push(session);
      else if (updated >= last7Start) buckets["Last 7 Days"].push(session);
      else buckets.Older.push(session);
    }
    return buckets;
  }, [sessions]);

  return (
    <aside
      className={`flex h-screen flex-col border-r border-zinc-200/70 bg-white/85 p-2.5 text-zinc-900 backdrop-blur transition-all duration-200 dark:border-zinc-700/70 dark:bg-zinc-900/80 dark:text-zinc-100 ${
        collapsed ? "w-16" : "w-72"
      }`}
    >
      <div className="mb-2.5 flex flex-col gap-2">
        {collapsed ? (
          <>
            <button
              onClick={onNewChat}
              className="flex w-full items-center justify-center rounded-md bg-zinc-900 p-2 text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              title="New Chat"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={onToggleCollapse}
              className="flex w-full items-center justify-center rounded-md bg-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <button
              onClick={onNewChat}
              className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              title="New Chat"
            >
              New Chat
            </button>
            <button
              onClick={onToggleCollapse}
              className="flex-shrink-0 rounded-md bg-zinc-200 p-2 text-zinc-700 transition hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-600"
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {!collapsed ? (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-2.5 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-400"
        />
      ) : null}

      <div className="flex-1 space-y-3.5 overflow-auto pr-0.5">
        {Object.entries(groupedSessions).map(([group, items]) =>
          items.length === 0 ? null : (
            <div key={group}>
              {!collapsed ? (
                <h3 className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  {group}
                </h3>
              ) : null}
              <div className="space-y-1.5">
                {items.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative w-full rounded-lg px-2.5 py-2 text-left text-sm text-zinc-900 transition dark:text-zinc-100 ${
                      activeSessionId === session.id
                        ? "bg-zinc-200/90 ring-1 ring-zinc-300/80 dark:bg-zinc-700/90 dark:ring-zinc-600"
                        : "bg-zinc-100/60 hover:bg-zinc-200/65 dark:bg-zinc-800/70 dark:hover:bg-zinc-700/70"
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => void submitRename(session.id)}
                        onKeyDown={(e) => onInputKeyDown(e, session.id)}
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          className={`${
                            collapsed ? "w-6 truncate text-center" : "flex-1 truncate pr-1.5"
                          } text-left ${activeSessionId === session.id ? "font-medium text-zinc-900 dark:text-zinc-100" : "text-zinc-700 dark:text-zinc-200"}`}
                          onClick={() => onSelect(session.id)}
                          title={session.title}
                        >
                          {collapsed ? session.title.slice(0, 1).toUpperCase() : session.title}
                        </button>
                        <button
                          className={`rounded p-1 text-zinc-500 transition hover:bg-zinc-300 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-600 dark:hover:text-zinc-100 ${
                            activeSessionId === session.id || menuSessionId === session.id
                              ? "opacity-100"
                              : "opacity-0 group-hover:opacity-100"
                          }`}
                          onClick={() => {
                            setMenuSessionId((prev) => (prev === session.id ? null : session.id));
                          }}
                          aria-label="Open chat actions"
                        >
                          <Ellipsis className="h-4 w-4" />
                        </button>
                        {menuSessionId === session.id ? (
                          <div
                            ref={menuRef}
                            className="absolute right-2 top-10 z-20 min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800"
                          >
                            <button
                              className="block w-full rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              onClick={() => {
                                setMenuSessionId(null);
                                setEditingSessionId(session.id);
                                setTitleDraft(session.title);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
                              onClick={async () => {
                                setMenuSessionId(null);
                                await onShare(session.id);
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Share
                            </button>
                            <button
                              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                              onClick={async () => {
                                setMenuSessionId(null);
                                const confirmed = window.confirm("Delete this chat and all its messages?");
                                if (!confirmed) return;
                                await onDelete(session.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      <div className="relative mt-2.5 border-t border-zinc-200/80 pt-2.5 dark:border-zinc-700/80">
        {!collapsed && usageData ? (
          <div className="mb-2 flex items-center gap-1.5 rounded-md bg-zinc-100/80 px-3 py-1.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            <Zap className="h-3 w-3 text-amber-500" />
            <span>{(usageData.totalTokens ?? 0).toLocaleString()} tokens used</span>
          </div>
        ) : null}
        <AccountMenu
          open={profileOpen}
          collapsed={collapsed}
          userName={session?.user?.name}
          userEmail={session?.user?.email}
          isAdmin={
            session?.user?.role === "ADMIN" ||
            session?.user?.workspaceRole === "OWNER" ||
            session?.user?.workspaceRole === "ADMIN"
          }
          onToggle={() => setProfileOpen((prev) => !prev)}
          onClose={() => setProfileOpen(false)}
        />
      </div>
    </aside>
  );
}
