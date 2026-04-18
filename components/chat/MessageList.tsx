"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { UiMessage, UiAgent } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { mutate } from "swr";
import { ArrowDown, Bookmark, Copy, Pencil, RotateCcw } from "lucide-react";
import { AgentStarterPrompts } from "@/components/chat/AgentStarterPrompts";

type Props = {
  messages: UiMessage[];
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
  onSuggestionClick?: (text: string) => void;
  loading?: boolean;
  activeAgent?: UiAgent;
};

type MessageBubbleProps = {
  message: UiMessage;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex, rehypeHighlight];

const MessageBubble = memo(function MessageBubble({ message, onRegenerate, onEdit }: MessageBubbleProps) {
  const { toast } = useToast();

  const savePrompt = useCallback(
    async (plainText: string) => {
      const trimmed = plainText.trim();
      if (!trimmed) {
        toast("Nothing to save", "error");
        return;
      }
      try {
        const res = await fetch("/api/prompts/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmed.slice(0, 60),
            promptText: trimmed,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        if (!res.ok) {
          toast(typeof data.error === "string" ? data.error : "Failed to save prompt", "error");
          return;
        }
        await mutate("/api/prompts/list");
        toast("Prompt saved");
      } catch {
        toast("Failed to save prompt", "error");
      }
    },
    [toast]
  );

  const codeComponents = useMemo(() => ({
    code(props: { className?: string; children?: React.ReactNode }) {
      const { className, children } = props;
      const isInline = !className;
      const label = className?.replace("language-", "") ?? "code";
      if (isInline) {
        return (
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200">
            {children}
          </code>
        );
      }
      return (
        <div className="my-3 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 text-[11px] uppercase tracking-wide text-zinc-300">
            <span>{label}</span>
            <button
              className="rounded px-2 py-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              onClick={() => { navigator.clipboard.writeText(String(children)); toast("Code copied"); }}
            >
              Copy
            </button>
          </div>
          <pre className="overflow-x-auto bg-zinc-950 px-4 py-3 text-xs text-zinc-100">
            <code>{children}</code>
          </pre>
        </div>
      );
    },
  }), [toast]);

  const images = message.imageUrls?.filter((u): u is string => typeof u === "string" && u.length > 0);

  return (
    <div className="group">
      <div
        className={`rounded-2xl p-4 text-sm leading-7 shadow-sm transition ${
          message.role === "user"
            ? "ml-auto max-w-2xl bg-violet-50 text-zinc-900 dark:bg-violet-950/40 dark:text-zinc-100"
            : "mr-auto max-w-3xl border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        }`}
      >
        {images && images.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Attached image ${i + 1}`}
                  className="h-32 w-auto max-w-[200px] rounded-xl object-cover border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:opacity-90 transition"
                />
              </a>
            ))}
          </div>
        ) : null}
        <ReactMarkdown
          remarkPlugins={remarkPlugins}
          rehypePlugins={rehypePlugins}
          components={codeComponents as never}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      <div
        className={`mt-2 flex items-center gap-1 text-zinc-500 transition-opacity dark:text-zinc-400 ${
          message.role === "user"
            ? "justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100"
            : "justify-start opacity-100 md:opacity-0 md:group-hover:opacity-100"
        }`}
      >
        <button
          className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          onClick={() => { navigator.clipboard.writeText(message.content); toast("Copied to clipboard"); }}
          title="Copy"
          aria-label="Copy message"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        {message.role === "user" ? (
          <>
            <button
              type="button"
              className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              onClick={() => void savePrompt(message.content)}
              title="Save prompt"
              aria-label="Save prompt"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            <button
              className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              onClick={() => onEdit(message.id, message.content)}
              title="Edit"
              aria-label="Edit message"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              onClick={() => void savePrompt(message.content)}
              title="Save to saved prompts"
              aria-label="Save response to saved prompts"
            >
              <Bookmark className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
              onClick={() => onRegenerate(message.id)}
              title="Regenerate"
              aria-label="Regenerate response"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export function MessageList({ messages, onRegenerate, onEdit, onSuggestionClick, loading, activeAgent }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const stableOnRegenerate = useCallback(onRegenerate, [onRegenerate]);
  const stableOnEdit = useCallback(onEdit, [onEdit]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const shouldStick = distanceFromBottom < 120;
    if (shouldStick) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 220);
  }

  const empty = useMemo(() => messages.length === 0 && !loading, [messages.length, loading]);

  const hasAgentStarters = Boolean(
    activeAgent?.starterPrompts?.some((prompt) => prompt.isActive !== false && prompt.prompt.trim().length > 0)
  );

  if (empty) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 pb-44 pt-8">
        <div className="mx-auto w-full max-w-3xl">
          {activeAgent ? (
            <div className="flex flex-col items-center">
              <span className="text-4xl">{activeAgent.icon || "🤖"}</span>
              <h2 className="mt-3 text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                {activeAgent.name}
              </h2>
              {activeAgent.description ? (
                <p className="mt-2 max-w-md text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {activeAgent.description}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <h2 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
                Welcome to your AI Workspace
              </h2>
              <p className="mt-2 text-center text-sm text-zinc-500">
                Start with a prompt or pick a suggestion to explore.
              </p>
            </>
          )}

          {hasAgentStarters ? (
            <AgentStarterPrompts
              agent={activeAgent}
              onPromptClick={(text) => onSuggestionClick?.(text)}
            />
          ) : (
            <p className="mt-6 text-center text-xs text-zinc-400 dark:text-zinc-500">
              {activeAgent
                ? `${activeAgent.name} has no starter prompts configured yet. Type a message below to get started.`
                : "Type a message below to get started."}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex h-full flex-col gap-4 overflow-auto px-6 pb-44 pt-6 text-zinc-900 dark:text-zinc-100"
      >
        {loading && messages.length === 0
          ? [1, 2, 3].map((skeleton) => (
              <div key={skeleton} className="h-20 w-full animate-pulse rounded-xl bg-zinc-200/60 dark:bg-zinc-700/60" />
            ))
          : null}
      {messages.map((message) => (
        <MessageBubble
          key={message.id}
          message={message}
          onRegenerate={stableOnRegenerate}
          onEdit={stableOnEdit}
        />
      ))}
      </div>
      {showScrollButton ? (
        <button
          className="absolute bottom-48 right-8 rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 shadow transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
