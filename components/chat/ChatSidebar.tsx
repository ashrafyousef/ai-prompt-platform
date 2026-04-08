"use client";

import { UiSession } from "@/lib/types";

type Props = {
  sessions: UiSession[];
  activeSessionId?: string;
  onSelect: (id: string) => void;
  onNewChat: () => void;
};

export function ChatSidebar({ sessions, activeSessionId, onSelect, onNewChat }: Props) {
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
          <button
            key={session.id}
            onClick={() => onSelect(session.id)}
            className={`w-full rounded-md px-3 py-2 text-left text-sm text-gray-900 ${
              activeSessionId === session.id ? "bg-gray-200" : "bg-gray-100 hover:bg-gray-200"
            }`}
          >
            {session.title}
          </button>
        ))}
      </div>
    </aside>
  );
}
