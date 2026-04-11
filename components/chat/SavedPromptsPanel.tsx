"use client";

import useSWR, { mutate } from "swr";
import { BookmarkX, X } from "lucide-react";

type SavedPrompt = {
  id: string;
  title: string;
  promptText: string;
  outputText?: string;
  createdAt: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function SavedPromptsPanel({
  onUse,
  onClose,
}: {
  onUse: (text: string) => void;
  onClose: () => void;
}) {
  const { data, isLoading } = useSWR<{ prompts: SavedPrompt[] }>(
    "/api/prompts/list",
    fetcher
  );

  async function handleDelete(id: string) {
    await fetch(`/api/prompts/${id}`, { method: "DELETE" });
    await mutate("/api/prompts/list");
  }

  return (
    <aside className="flex h-full w-80 flex-col border-l border-zinc-200/70 bg-white/95 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <div className="flex items-center justify-between border-b border-zinc-200/70 px-4 py-3 dark:border-zinc-700">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Saved Prompts</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="Close saved prompts"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : !data?.prompts?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-sm text-zinc-500">
            <BookmarkX className="h-8 w-8 text-zinc-300" />
            <p>No saved prompts yet.</p>
            <p className="text-xs">
              Hover a message (on desktop) or use the bookmark under any message to save it here.
            </p>
          </div>
        ) : (
          data.prompts.map((prompt) => (
            <div
              key={prompt.id}
              className="group rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            >
              <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100 line-clamp-1">
                {prompt.title}
              </p>
              <p className="text-xs text-zinc-500 line-clamp-2">{prompt.promptText}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => { onUse(prompt.promptText); onClose(); }}
                  className="rounded-md bg-zinc-900 px-2 py-1 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Use
                </button>
                <button
                  onClick={() => handleDelete(prompt.id)}
                  className="rounded-md px-2 py-1 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
