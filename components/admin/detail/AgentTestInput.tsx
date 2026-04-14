"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";

export function AgentTestInput({
  onSubmit,
  loading,
  starterPrompts,
}: {
  onSubmit: (prompt: string) => void;
  loading: boolean;
  starterPrompts: string[];
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  function send() {
    const t = text.trim();
    if (!t || loading) return;
    onSubmit(t);
    setText("");
  }

  return (
    <div className="space-y-4">
      {starterPrompts.length > 0 ? (
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <Sparkles className="h-3 w-3" />
            Starter prompts
          </div>
          <div className="flex flex-wrap gap-2">
            {starterPrompts.map((p, i) => (
              <button
                key={i}
                type="button"
                disabled={loading}
                onClick={() => onSubmit(p)}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs text-zinc-600 transition hover:border-violet-300 hover:bg-violet-50 active:scale-[0.98] disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-violet-500 dark:hover:bg-violet-950/30"
              >
                {p.length > 60 ? p.slice(0, 57) + "…" : p}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-2">
        <textarea
          ref={ref}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Enter a test prompt…"
          className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={send}
          disabled={!text.trim() || loading}
          className="flex h-auto w-12 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm transition hover:bg-violet-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-40"
          aria-label="Run test"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
      <p className="text-[11px] text-zinc-400">
        Press <kbd className="rounded border border-zinc-200 px-1 py-0.5 text-[10px] font-medium dark:border-zinc-700">⌘ Enter</kbd> to send
      </p>
    </div>
  );
}
