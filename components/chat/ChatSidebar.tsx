"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { UiSession } from "@/lib/types";

type Props = {
  sessions: UiSession[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onShare: (id: string) => Promise<void>;
};

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
  onShare,
}: Props) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");
  const [menuSessionId, setMenuSessionId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

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
      if (!menuRef.current) return;
      if (menuRef.current.contains(event.target as Node)) return;
      setMenuSessionId(null);
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

  return (
    <aside className="w-72 border-r border-gray-200 bg-white p-3 text-gray-900">
      <button
        onClick={onNewChat}
        className="mb-3 w-full rounded-md bg-black px-3 py-2 text-sm text-white"
      >
        New Chat
      </button>
      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group relative w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 ${
              activeSessionId === session.id ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {editingSessionId === session.id ? (
              <input
                autoFocus
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={() => void submitRename(session.id)}
                onKeyDown={(e) => onInputKeyDown(e, session.id)}
                className="w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
              />
            ) : (
              <div className="flex items-center justify-between gap-2">
                <button className="truncate pr-2" onClick={() => onSelect(session.id)}>
                  {session.title}
                </button>
                <button
                  className={`rounded px-2 py-1 text-base leading-none text-gray-600 hover:bg-gray-300 hover:text-gray-900 ${
                    activeSessionId === session.id || menuSessionId === session.id
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  onClick={() => {
                    setMenuSessionId((prev) => (prev === session.id ? null : session.id));
                  }}
                  aria-label="Open chat actions"
                >
                  ...
                </button>
                {menuSessionId === session.id ? (
                  <div
                    ref={menuRef}
                    className="absolute right-2 top-10 z-20 min-w-[140px] rounded-md border border-gray-200 bg-white p-1 shadow-lg"
                  >
                    <button
                      className="block w-full rounded px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100"
                      onClick={() => {
                        setMenuSessionId(null);
                        setEditingSessionId(session.id);
                        setTitleDraft(session.title);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="block w-full rounded px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-100"
                      onClick={async () => {
                        setMenuSessionId(null);
                        await onShare(session.id);
                      }}
                    >
                      Share
                    </button>
                    <button
                      className="block w-full rounded px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        setMenuSessionId(null);
                        const confirmed = window.confirm("Delete this chat and all its messages?");
                        if (!confirmed) return;
                        await onDelete(session.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
