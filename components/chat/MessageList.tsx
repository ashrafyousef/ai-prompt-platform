"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { UiMessage } from "@/lib/types";
import { ArrowDown, Copy, Pencil, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";

type Props = {
  messages: UiMessage[];
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
  loading?: boolean;
};

export function MessageList({ messages, onRegenerate, onEdit, loading }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);

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

  if (empty) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 pb-44 pt-8">
        <div className="mx-auto w-full max-w-3xl">
          <h2 className="text-center text-2xl font-semibold text-zinc-900">Welcome to your AI Workspace</h2>
          <p className="mt-2 text-center text-sm text-zinc-500">
            Start with a prompt or pick a suggestion to explore.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {[
              "Design a launch strategy for a new AI product in MENA.",
              "Rewrite this prompt to be clearer and outcome-focused.",
              "Generate a brand voice guide with examples and tone rules.",
              "Turn these notes into a project plan with milestones.",
            ].map((card) => (
              <div key={card} className="rounded-xl border border-zinc-200 bg-white/70 p-4 text-sm text-zinc-700">
                {card}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-1">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex h-full flex-col gap-4 overflow-auto px-6 pb-44 pt-6 text-zinc-900"
      >
        {loading && messages.length === 0
          ? [1, 2, 3].map((skeleton) => (
              <div key={skeleton} className="h-20 w-full animate-pulse rounded-xl bg-zinc-200/60" />
            ))
          : null}
      {messages.map((message) => (
        <div key={message.id} className="group">
          <div
            className={`rounded-2xl p-4 text-sm leading-7 shadow-sm transition ${
              message.role === "user"
                ? "ml-auto max-w-2xl bg-violet-50 text-zinc-900"
                : "mr-auto max-w-3xl border border-zinc-200 bg-white text-zinc-900"
            }`}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeKatex, rehypeHighlight]}
              components={{
                code(props) {
                  const { className, children } = props;
                  const isInline = !className;
                  const label = className?.replace("language-", "") ?? "code";
                  if (isInline) {
                    return (
                      <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800">
                        {children}
                      </code>
                    );
                  }
                  return (
                    <div className="my-3 overflow-hidden rounded-lg border border-zinc-200">
                      <div className="flex items-center justify-between bg-zinc-900 px-3 py-1.5 text-[11px] uppercase tracking-wide text-zinc-300">
                        <span>{label}</span>
                        <button
                          className="rounded px-2 py-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-white"
                          onClick={() => navigator.clipboard.writeText(String(children))}
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
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
          <div
            className={`mt-2 flex items-center gap-1 text-zinc-500 transition-opacity ${
              message.role === "user"
                ? "justify-end opacity-0 group-hover:opacity-100"
                : "justify-start opacity-0 group-hover:opacity-100"
            }`}
          >
            <button
              className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900"
              onClick={() => navigator.clipboard.writeText(message.content)}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            {message.role === "user" ? (
              <button
                className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900"
                onClick={() => onEdit(message.id, message.content)}
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            ) : (
              <>
                <button
                  className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900"
                  onClick={() => onRegenerate(message.id)}
                  title="Regenerate"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900" title="Helpful">
                  <ThumbsUp className="h-3.5 w-3.5" />
                </button>
                <button className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900" title="Not helpful">
                  <ThumbsDown className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      ))}
      </div>
      {showScrollButton ? (
        <button
          className="absolute bottom-48 right-8 rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 shadow transition hover:bg-zinc-100"
          onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
