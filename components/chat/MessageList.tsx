"use client";

import {
  Children,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import useSWR from "swr";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { compactAgentModelSummaryLine } from "@/lib/chatAgentModelGuidance";
import { UiMessage, UiAgent, UiModelsResponse } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { mutate } from "swr";
import { ArrowDown, Bookmark, Copy, Pencil, RotateCcw, WandSparkles } from "lucide-react";
import { AgentStarterPrompts } from "@/components/chat/AgentStarterPrompts";

type Props = {
  messages: UiMessage[];
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
  /** Retry the failed assistant turn (same user message, new attempt). */
  onRetryTurn?: (turnId: string) => void;
  onSuggestionClick?: (text: string) => void;
  loading?: boolean;
  /** When false, empty state waits for default agent resolution (avoids generic copy flash). */
  agentSelectionReady?: boolean;
  activeAgent?: UiAgent;
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
  composerBottomInset?: number;
};

type MessageBubbleProps = {
  message: UiMessage;
  onRegenerate: (messageId: string) => void;
  onEdit: (messageId: string, currentText: string) => void;
  onRetryTurn?: (turnId: string) => void;
  selectedModelId?: string;
  onModelChange?: (id: string) => void;
  models?: UiModelsResponse["models"];
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex, rehypeHighlight];

const modelsFetcher = (url: string) => fetch(url).then((r) => r.json());

type MarkdownChildProps = {
  className?: string;
  children?: ReactNode;
};

function languageFromClassName(className?: string): string | null {
  const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? "");
  return match?.[1]?.toLowerCase() ?? null;
}

function isPromptLikeFence(language: string): boolean {
  const normalized = language.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "text" ||
    normalized === "txt" ||
    normalized === "prompt" ||
    normalized === "markdown" ||
    normalized === "md" ||
    normalized === "plaintext" ||
    normalized === "output"
  );
}

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (isValidElement<MarkdownChildProps>(node)) return textFromNode(node.props.children);
  return "";
}

const MessageBubble = memo(function MessageBubble({
  message,
  onRegenerate,
  onEdit,
  onRetryTurn,
  selectedModelId,
  onModelChange,
  models = [],
}: MessageBubbleProps) {
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

  const markdownComponents = useMemo(() => ({
    h1(props: { children?: ReactNode }) {
      return (
        <h1 className="mb-3 mt-4 min-w-0 max-w-full break-words text-xl font-semibold leading-tight [overflow-wrap:anywhere]">
          {props.children}
        </h1>
      );
    },
    h2(props: { children?: ReactNode }) {
      return (
        <h2 className="mb-2.5 mt-4 min-w-0 max-w-full break-words text-lg font-semibold leading-tight [overflow-wrap:anywhere]">
          {props.children}
        </h2>
      );
    },
    h3(props: { children?: ReactNode }) {
      return (
        <h3 className="mb-2 mt-3.5 min-w-0 max-w-full break-words text-base font-semibold leading-snug [overflow-wrap:anywhere]">
          {props.children}
        </h3>
      );
    },
    h4(props: { children?: ReactNode }) {
      return (
        <h4 className="mb-2 mt-3 min-w-0 max-w-full break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
          {props.children}
        </h4>
      );
    },
    h5(props: { children?: ReactNode }) {
      return (
        <h5 className="mb-2 mt-3 min-w-0 max-w-full break-words text-sm font-semibold leading-snug [overflow-wrap:anywhere]">
          {props.children}
        </h5>
      );
    },
    h6(props: { children?: ReactNode }) {
      return (
        <h6 className="mb-2 mt-3 min-w-0 max-w-full break-words text-xs font-semibold uppercase leading-snug tracking-wide [overflow-wrap:anywhere]">
          {props.children}
        </h6>
      );
    },
    p(props: { children?: ReactNode }) {
      return (
        <p className="my-2 min-w-0 max-w-full break-words leading-7 [overflow-wrap:anywhere]">
          {props.children}
        </p>
      );
    },
    ul(props: { children?: ReactNode }) {
      return <ul className="my-2 min-w-0 max-w-full list-disc space-y-1 pl-5">{props.children}</ul>;
    },
    ol(props: { children?: ReactNode }) {
      return <ol className="my-2 min-w-0 max-w-full list-decimal space-y-1 pl-5">{props.children}</ol>;
    },
    li(props: { children?: ReactNode }) {
      return (
        <li className="min-w-0 max-w-full break-words pl-1 leading-7 [overflow-wrap:anywhere]">
          {props.children}
        </li>
      );
    },
    a(props: { href?: string; children?: ReactNode }) {
      return (
        <a
          href={props.href}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-violet-700 underline decoration-violet-300 underline-offset-2 [overflow-wrap:anywhere] hover:text-violet-800 dark:text-violet-300 dark:decoration-violet-700 dark:hover:text-violet-200"
        >
          {props.children}
        </a>
      );
    },
    blockquote(props: { children?: ReactNode }) {
      return (
        <blockquote className="my-3 min-w-0 max-w-full border-l-2 border-zinc-400 pl-3 text-zinc-700 dark:border-zinc-600 dark:text-zinc-300">
          {props.children}
        </blockquote>
      );
    },
    table(props: { children?: ReactNode }) {
      return (
          <div className="my-3 max-w-full overflow-x-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
          <table className="min-w-max border-collapse text-left text-xs">{props.children}</table>
        </div>
      );
    },
    th(props: { children?: ReactNode }) {
      return (
        <th className="border-b border-zinc-300 bg-zinc-100 px-3 py-2 font-semibold text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
          {props.children}
        </th>
      );
    },
    td(props: { children?: ReactNode }) {
      return (
        <td className="border-b border-zinc-200 px-3 py-2 align-top text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          {props.children}
        </td>
      );
    },
    hr() {
      return <hr className="my-4 border-zinc-200 dark:border-zinc-700" />;
    },
    pre(props: { children?: ReactNode }) {
      const child = Children.toArray(props.children).find((item) => isValidElement<MarkdownChildProps>(item));
      const codeProps = isValidElement<MarkdownChildProps>(child) ? child.props : {};
      const codeChildren = codeProps.children ?? props.children;
      const language = languageFromClassName(codeProps.className);
      const label = language ?? "text";
      const promptLike = !language || isPromptLikeFence(language);
      const copyText = textFromNode(codeChildren);

      if (promptLike) {
        return (
          <div className="my-3 max-w-full overflow-hidden rounded-lg border border-zinc-200 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] uppercase tracking-wide text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <span className="min-w-0 truncate">{label}</span>
              <button
                className="shrink-0 rounded px-2 py-0.5 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
                onClick={() => { navigator.clipboard.writeText(copyText); toast("Code copied"); }}
              >
                Copy
              </button>
            </div>
            <pre className="max-w-full bg-zinc-50/70 px-4 py-3 text-xs leading-6 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
              <code className="block max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere] bg-transparent p-0 text-inherit">
                {codeChildren}
              </code>
            </pre>
          </div>
        );
      }

      return (
        <div className="my-3 max-w-full overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
          <div className="flex min-w-0 items-center justify-between gap-2 bg-zinc-900 px-3 py-1.5 text-[11px] uppercase tracking-wide text-zinc-300">
            <span className="min-w-0 truncate">{label}</span>
            <button
              className="shrink-0 rounded px-2 py-0.5 text-zinc-300 hover:bg-zinc-700 hover:text-white"
              onClick={() => { navigator.clipboard.writeText(copyText); toast("Code copied"); }}
            >
              Copy
            </button>
          </div>
          <pre className="max-w-full overflow-x-auto bg-zinc-950 px-4 py-3 text-xs leading-5 text-zinc-100">
            <code className={`block min-w-max whitespace-pre ${codeProps.className ?? ""}`}>{codeChildren}</code>
          </pre>
        </div>
      );
    },
    code(props: { className?: string; children?: ReactNode }) {
      const { className, children } = props;
      const isInline = !className;
      if (isInline) {
        return (
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-xs text-zinc-800 break-words [overflow-wrap:anywhere] dark:bg-zinc-700 dark:text-zinc-200">
            {children}
          </code>
        );
      }
      return <code className={className}>{children}</code>;
    },
  }), [toast]);

  const images = message.imageUrls?.filter((u): u is string => typeof u === "string" && u.length > 0);

  const gen = message.generation;
  const isAssistantFailed = message.role === "assistant" && gen?.status === "failed";
  const isAssistantStreaming = message.role === "assistant" && gen?.status === "streaming";

  const visionAlt = useMemo(() => {
    if (!isAssistantFailed || gen?.status !== "failed" || gen.code !== "vision_required") return null;
    return models.find((m) => m.enabled && m.visionCapable && m.id !== selectedModelId) ?? null;
  }, [isAssistantFailed, gen, models, selectedModelId]);

  const failedGen = gen?.status === "failed" ? gen : null;
  const alignment = message.role === "user" ? "justify-end" : "justify-start";

  return (
    <div className="group w-full min-w-0 max-w-full md:mx-auto md:max-w-3xl">
      <div className={`flex w-full min-w-0 max-w-full ${alignment}`}>
        <div
          className={`w-full min-w-0 max-w-full overflow-hidden rounded-2xl p-4 text-sm leading-7 transition ${
            message.role === "user"
              ? "bg-violet-50/85 text-zinc-900 ring-1 ring-violet-200/60 shadow-sm dark:bg-violet-950/40 dark:text-zinc-100 md:max-w-xl"
              : "border border-zinc-200/70 bg-white/90 text-zinc-900 shadow-[0_1px_1px_rgba(24,24,27,0.03)] dark:border-zinc-700 dark:bg-zinc-800/85 dark:text-zinc-100 md:max-w-[49rem]"
          }`}
        >
        {images && images.length > 0 ? (
          <div className="mb-3 flex min-w-0 max-w-full flex-wrap gap-2">
            {images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <Image
                  src={url}
                  alt={`Attached image ${i + 1}`}
                  width={200}
                  height={128}
                  unoptimized
                  className="h-32 w-auto max-w-full cursor-pointer rounded-xl border border-zinc-200 object-cover transition hover:opacity-90 dark:border-zinc-700 sm:max-w-[200px]"
                />
              </a>
            ))}
          </div>
        ) : null}
        {message.role === "assistant" && isAssistantFailed && failedGen ? (
          <>
            <div className="mb-3 rounded-xl border border-amber-200/90 bg-amber-50/85 px-3.5 py-3 dark:border-amber-900/60 dark:bg-amber-950/25">
              <p className="text-sm font-semibold leading-5 text-amber-950 dark:text-amber-100">{failedGen.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-900/95 dark:text-amber-100/90">{failedGen.detail}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {message.turnId && onRetryTurn ? (
                  <button
                    type="button"
                    className="rounded-full bg-zinc-900 px-3.5 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                    onClick={() => onRetryTurn(message.turnId!)}
                  >
                    Retry
                  </button>
                ) : null}
                {visionAlt && onModelChange ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/80 px-2.5 py-1 text-[11px] font-medium text-amber-950/95 hover:bg-amber-100/80 dark:border-amber-700 dark:text-amber-100 dark:hover:bg-amber-900/40"
                    onClick={() => onModelChange(visionAlt.id)}
                  >
                    <WandSparkles className="h-3 w-3" />
                    Switch to {visionAlt.displayName}
                  </button>
                ) : null}
              </div>
            </div>
            {message.content.trim().length > 0 ? (
              <div className="mt-1 min-w-0 max-w-full overflow-hidden rounded-lg border border-zinc-300/80 bg-zinc-50/90 px-3 py-2.5 text-xs text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/30 dark:text-zinc-400">
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                  Partial response
                </p>
                <ReactMarkdown
                  remarkPlugins={remarkPlugins}
                  rehypePlugins={rehypePlugins}
                  components={markdownComponents as never}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            ) : null}
          </>
        ) : message.role === "assistant" && isAssistantStreaming && !message.content.trim() ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-violet-500" />
              Generating…
            </span>
          </p>
        ) : (
          <div className="min-w-0 max-w-full break-words [overflow-wrap:anywhere]">
            <ReactMarkdown
              remarkPlugins={remarkPlugins}
              rehypePlugins={rehypePlugins}
              components={markdownComponents as never}
            >
              {message.content || (isAssistantStreaming ? "\u00a0" : "")}
            </ReactMarkdown>
            {isAssistantStreaming && message.content.trim().length > 0 ? (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-violet-500 align-middle" aria-hidden />
            ) : null}
          </div>
        )}
        </div>
      </div>
      <div
        className={`mt-2 flex w-full min-w-0 max-w-full items-center gap-1 text-zinc-600 transition-opacity dark:text-zinc-400 ${
          message.role === "user"
            ? "justify-end opacity-100 md:opacity-0 md:group-hover:opacity-100"
            : "justify-start opacity-100 md:opacity-0 md:group-hover:opacity-100"
        }`}
      >
        <button
          className="rounded p-1.5 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
          onClick={() => {
            const t = isAssistantFailed && failedGen ? failedGen.detail : message.content;
            navigator.clipboard.writeText(t);
            toast("Copied to clipboard");
          }}
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
        ) : isAssistantFailed ? null : (
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

export function MessageList({
  messages,
  onRegenerate,
  onEdit,
  onRetryTurn,
  onSuggestionClick,
  loading,
  agentSelectionReady = true,
  activeAgent,
  selectedModelId,
  onModelChange,
  composerBottomInset = 260,
}: Props) {
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

  const { data: modelsData } = useSWR<UiModelsResponse>("/api/models", modelsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const modelsForBubbles = useMemo(() => modelsData?.models ?? [], [modelsData?.models]);
  const emptyStateModelLine = useMemo(
    () => compactAgentModelSummaryLine(activeAgent, modelsForBubbles),
    [activeAgent, modelsForBubbles]
  );
  const composerInsetStyle = useMemo(
    () =>
      ({
        "--composer-bottom-inset": `${Math.max(160, composerBottomInset)}px`,
      } as CSSProperties),
    [composerBottomInset]
  );

  if (empty) {
    if (!agentSelectionReady) {
      return (
        <div
          style={composerInsetStyle}
          className="flex min-h-0 min-w-0 max-w-full flex-1 items-start justify-center overflow-y-auto overflow-x-hidden px-4 pb-[calc(var(--composer-bottom-inset)+1.5rem)] pt-8 md:items-center md:px-6 md:pb-40"
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Loading assistant…</p>
        </div>
      );
    }

    return (
      <div
        style={composerInsetStyle}
        className="flex min-h-0 min-w-0 max-w-full flex-1 items-start justify-center overflow-y-auto overflow-x-hidden px-4 pb-[calc(var(--composer-bottom-inset)+1.5rem)] pt-6 sm:px-6 md:items-center md:pb-40 md:pt-8"
      >
        <div className="mx-auto w-full min-w-0 max-w-full md:max-w-3xl">
          {activeAgent ? (
            <div className="flex flex-col items-center">
              <span className="text-3xl">{activeAgent.icon || "🤖"}</span>
              <h2 className="mt-2 text-center text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {activeAgent.name}
              </h2>
              {activeAgent.description ? (
                <p className="mt-1.5 max-w-md text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {activeAgent.description}
                </p>
              ) : null}
              {emptyStateModelLine ? (
                <p className="mt-2.5 max-w-lg text-center text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-500">
                  {emptyStateModelLine}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="text-center">
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                No assistant available
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                There are no published agents for your account yet. Check back after an admin publishes one.
              </p>
            </div>
          )}

          {activeAgent && hasAgentStarters ? (
            <AgentStarterPrompts
              key={activeAgent.id}
              agent={activeAgent}
              onPromptClick={(text) => onSuggestionClick?.(text)}
            />
          ) : activeAgent ? (
            <p className="mt-5 text-center text-xs text-zinc-500 dark:text-zinc-500">
              {`${activeAgent.name} has no starter prompts configured yet. Type a message below to get started.`}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div style={composerInsetStyle} className="relative min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="flex h-full w-full min-w-0 max-w-full flex-col gap-3 overflow-y-auto overflow-x-hidden px-4 pb-[calc(var(--composer-bottom-inset)+1rem)] pt-5 text-zinc-900 dark:text-zinc-100 sm:px-6 sm:pt-6"
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
            onRetryTurn={onRetryTurn}
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            models={modelsForBubbles}
          />
        ))}
      </div>
      {showScrollButton ? (
        <button
          className="absolute bottom-[calc(var(--composer-bottom-inset)+0.75rem)] right-4 rounded-full border border-zinc-200 bg-white p-2 text-zinc-700 shadow transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700 sm:right-8"
          onClick={() => containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: "smooth" })}
          aria-label="Scroll to bottom"
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
