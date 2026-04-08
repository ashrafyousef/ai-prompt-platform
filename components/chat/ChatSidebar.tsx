"use client";

import { KeyboardEvent, useEffect, useState } from "react";
import { UiSession } from "@/lib/types";

type Props = {
  sessions: UiSession[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onRename: (id: string, title: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ChatSidebar({ sessions, activeSessionId, onSelect, onNewChat, onRename, onDelete }: Props) {
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState("");

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
            className={`w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 ${
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
                <button className="truncate" onClick={() => onSelect(session.id)}>
                  {session.title}
                </button>
                <button
                  className="text-xs font-medium text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    setEditingSessionId(session.id);
                    setTitleDraft(session.title);
                  }}
                >
                  Rename
                </button>
                <button
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                  onClick={async () => {
                    const confirmed = window.confirm("Delete this chat and all its messages?");
                    if (!confirmed) return;
                    await onDelete(session.id);
                  }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}
