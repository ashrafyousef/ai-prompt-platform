import Link from "next/link";
import { Button, Panel } from "@/components/ui";
import type { ProjectChatSession } from "./types";
import { formatProjectDateTime } from "./types";

export type ProjectChatsPanelProps = {
  sessions: ProjectChatSession[];
  loading: boolean;
  creating: boolean;
  onNewProjectChat: () => void;
};

export function ProjectChatsPanel({
  sessions,
  loading,
  creating,
  onNewProjectChat,
}: ProjectChatsPanelProps) {
  return (
    <Panel
      id="project-chats"
      title="Project Chats"
      description="Continue existing conversations or start a new project-linked chat."
      actions={
        <Button type="button" size="sm" onClick={onNewProjectChat} disabled={creating}>
          {creating ? "Creating..." : "New project chat"}
        </Button>
      }
      padding="md"
      className="scroll-mt-6"
    >
      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading chats...</p>
      ) : sessions.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No project-linked chats yet.
          </p>
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Start a project chat to keep conversations tied to this project. Chats remain private to you.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {sessions.map((chat) => (
            <div key={chat.id} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <Link
                  href={`/chat?sessionId=${encodeURIComponent(chat.id)}`}
                  className="text-sm font-medium text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-zinc-50"
                >
                  {chat.title}
                </Link>
                {chat.summary ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                    {chat.summary}
                  </p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-zinc-400">{formatProjectDateTime(chat.updatedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
