"use client";

import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Ellipsis, LogOut, Plus, Settings, Share2, Trash2 } from "lucide-react";
import { UiSession } from "@/lib/types";

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
  const profileRef = useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = useState("");

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
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }
    function onDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") setMenuSessionId(null);
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
      className={`flex h-screen flex-col border-r border-zinc-200/70 bg-white/80 p-3 text-zinc-900 backdrop-blur transition-all duration-200 ${
        collapsed ? "w-16" : "w-72"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          onClick={onNewChat}
          className={`rounded-md bg-zinc-900 px-3 py-2 text-sm text-white transition hover:bg-zinc-700 ${
            collapsed ? "w-full px-0" : "w-full"
          }`}
          title="New Chat"
        >
          {collapsed ? <Plus className="mx-auto h-4 w-4" /> : "New Chat"}
        </button>
        <button
          onClick={onToggleCollapse}
          className="rounded-md p-2 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
      {!collapsed ? (
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search chats..."
          className="mb-3 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500"
        />
      ) : null}

      <div className="flex-1 space-y-4 overflow-auto">
        {Object.entries(groupedSessions).map(([group, items]) =>
          items.length === 0 ? null : (
            <div key={group}>
              {!collapsed ? (
                <h3 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {group}
                </h3>
              ) : null}
              <div className="space-y-2">
                {items.map((session) => (
                  <div
                    key={session.id}
                    className={`group relative w-full rounded-md px-3 py-2 text-left text-sm text-zinc-900 transition ${
                      activeSessionId === session.id
                        ? "bg-zinc-200"
                        : "bg-zinc-100/80 hover:bg-zinc-200/70"
                    }`}
                  >
                    {editingSessionId === session.id ? (
                      <input
                        autoFocus
                        value={titleDraft}
                        onChange={(e) => setTitleDraft(e.target.value)}
                        onBlur={() => void submitRename(session.id)}
                        onKeyDown={(e) => onInputKeyDown(e, session.id)}
                        className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900"
                      />
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <button
                          className={`${collapsed ? "w-6 truncate text-center" : "truncate pr-2"} text-left`}
                          onClick={() => onSelect(session.id)}
                          title={session.title}
                        >
                          {collapsed ? session.title.slice(0, 1).toUpperCase() : session.title}
                        </button>
                        <button
                          className={`rounded p-1 text-zinc-600 hover:bg-zinc-300 hover:text-zinc-900 ${
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
                            className="absolute right-2 top-10 z-20 min-w-[160px] rounded-md border border-zinc-200 bg-white p-1 shadow-lg"
                          >
                            <button
                              className="block w-full rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                              onClick={() => {
                                setMenuSessionId(null);
                                setEditingSessionId(session.id);
                                setTitleDraft(session.title);
                              }}
                            >
                              Rename
                            </button>
                            <button
                              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100"
                              onClick={async () => {
                                setMenuSessionId(null);
                                await onShare(session.id);
                              }}
                            >
                              <Share2 className="h-3.5 w-3.5" />
                              Share
                            </button>
                            <button
                              className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
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

      <div ref={profileRef} className="relative mt-3">
        <button
          className="flex w-full items-center justify-between rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 hover:bg-zinc-200"
          onClick={() => setProfileOpen((prev) => !prev)}
        >
          {collapsed ? "•••" : "Profile & Settings"}
          {!collapsed ? <Ellipsis className="h-4 w-4" /> : null}
        </button>
        {profileOpen ? (
          <div className="absolute bottom-11 left-0 right-0 z-20 rounded-md border border-zinc-200 bg-white p-1 shadow-lg">
            <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100">
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs text-zinc-700 hover:bg-zinc-100">
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
