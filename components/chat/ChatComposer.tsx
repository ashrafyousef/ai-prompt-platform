"use client";

import { DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { AlertTriangle, ArrowUp, Plus, Square, WandSparkles, X } from "lucide-react";
import { ModelSelector } from "@/components/chat/ModelSelector";
import useSWR from "swr";
import type { UiAgent, UiModelsResponse } from "@/lib/types";
import { compactModelSelectorHint } from "@/lib/chatAgentModelGuidance";
import { modelFailsManualRouterForChat } from "@/lib/chatAgentModelRules";
import { computeChatModelCompatibilityIssues } from "@/lib/chatModelCompatibility";
import type { UiModelSummary } from "@/lib/types";
import type { ChatRouteMeta } from "@/components/chat/hooks/useChatStream";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);
const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Props = {
  onSend: (text: string, imageFiles?: File[]) => Promise<void>;
  disabled?: boolean;
  initialText?: string;
  modeLabel?: string;
  onCancelMode?: () => void;
  onCancelStream?: () => void;
  placeholderText?: string;
  activeAgent?: UiAgent;
  selectedModelId: string;
  onModelChange: (id: string) => void;
  modelRoutingMode?: "manual" | "auto" | "suggested";
  onModelRoutingModeChange?: (mode: "manual" | "auto" | "suggested") => void;
  lastRouteMeta?: ChatRouteMeta | null;
};

export function ChatComposer({
  onSend,
  disabled,
  initialText,
  modeLabel,
  onCancelMode,
  onCancelStream,
  placeholderText,
  activeAgent,
  selectedModelId,
  onModelChange,
  modelRoutingMode = "manual",
  onModelRoutingModeChange,
  lastRouteMeta,
}: Props) {
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { data: modelsData, isLoading: modelsLoading } = useSWR<UiModelsResponse>("/api/models", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setDragging(true);
    }
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) {
      setDragging(false);
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    dragCounter.current = 0;
    const files = Array.from(e.dataTransfer.files).filter((f) => ACCEPTED_IMAGE_TYPES.has(f.type));
    if (files.length > 0) {
      setImageFiles((prev) => [...prev, ...files]);
    }
  }

  const imagePreviews = useMemo(
    () => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [imageFiles]
  );
  // Stable empty-array reference when SWR has not loaded yet (avoids exhaustive-deps churn on `[] ?? []`).
  const models = useMemo(() => modelsData?.models ?? [], [modelsData?.models]);

  const compatibilityIssues = useMemo(
    () =>
      computeChatModelCompatibilityIssues({
        models,
        selectedModelId,
        activeAgent,
        imageAttachmentCount: imageFiles.length,
        textCharLength: text.length,
      }),
    [models, selectedModelId, activeAgent, imageFiles.length, text.length]
  );

  const blockingIssue = compatibilityIssues.find((issue) => issue.severity === "blocking");

  /** Avoid repeating guidance already shown in compatibility banners. */
  const modelSelectorHint = useMemo(() => {
    if (compatibilityIssues.length > 0) return null;
    return compactModelSelectorHint(activeAgent, models);
  }, [compatibilityIssues, activeAgent, models]);

  const agentModelIncompatible = useMemo(() => {
    if (!activeAgent) return undefined;
    return (m: UiModelSummary) =>
      modelFailsManualRouterForChat(m, activeAgent, {
        outputFormat: activeAgent.outputFormat,
        textCharLength: text.length,
        imageAttachmentCount: imageFiles.length,
      });
  }, [activeAgent, text.length, imageFiles.length]);

  useEffect(() => {
    if (!models.length) return;
    if (models.some((model) => model.id === selectedModelId && model.enabled)) return;
    const configuredDefaultId = modelsData?.defaults?.defaultModelId;
    const configuredFallbackId = modelsData?.defaults?.fallbackModelId;
    const fallback =
      models.find((model) => model.id === configuredDefaultId && model.enabled) ??
      models.find((model) => model.id === configuredFallbackId && model.enabled) ??
      models.find((model) => model.enabled && model.preferredFor.includes("default")) ??
      models.find((model) => model.enabled);
    if (fallback) {
      onModelChange(fallback.id);
    }
  }, [models, modelsData?.defaults?.defaultModelId, modelsData?.defaults?.fallbackModelId, selectedModelId, onModelChange]);

  useEffect(() => {
    return () => {
      imagePreviews.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [imagePreviews]);

  useEffect(() => {
    if (typeof initialText === "string") {
      setText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const scrollH = textarea.scrollHeight;
    const maxH = 180;
    const nextHeight = Math.min(scrollH, maxH);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = scrollH > maxH ? "auto" : "hidden";
  }, [text]);

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (disabled) return;
    if (!text.trim() || blockingIssue) return;
    await onSend(text.trim(), imageFiles);
    setText("");
    setImageFiles([]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void submit();
    }
  }

  return (
    <form
      onSubmit={submit}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative mx-auto w-full min-w-0 max-w-full overflow-hidden rounded-[30px] border p-1.5 shadow-[0_6px_24px_rgba(24,24,27,0.06)] transition-colors md:max-w-3xl md:p-2.5 ${
        dragging
          ? "border-violet-300 bg-violet-100 ring-2 ring-violet-400 dark:bg-violet-950/40 dark:ring-violet-500"
          : "border-zinc-200/90 bg-white dark:border-zinc-700 dark:bg-[#1e1e1e]"
      }`}
    >
      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[32px]">
          <span className="text-sm font-medium text-violet-600 dark:text-violet-300">
            Drop images here
          </span>
        </div>
      ) : null}
      {modeLabel ? (
        <div className="mb-2 flex items-center justify-between gap-2 rounded-2xl bg-amber-100/50 px-3.5 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <span className="min-w-0 leading-relaxed">{modeLabel}</span>
          {onCancelMode ? (
            <button type="button" onClick={onCancelMode} className="shrink-0 underline hover:no-underline">
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {compatibilityIssues.length > 0 ? (
        <div className="mb-2 space-y-1.5 px-1">
          {compatibilityIssues.map((issue) => (
            <div
              key={issue.id}
              className={`flex flex-wrap items-start justify-between gap-2 rounded-xl px-3 py-2 text-xs sm:flex-nowrap ${
                issue.severity === "blocking"
                  ? "bg-red-100/70 text-red-800 dark:bg-red-900/30 dark:text-red-200"
                  : "bg-amber-100/70 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p className="leading-relaxed">{issue.message}</p>
              </div>
              {issue.suggestedModelId ? (
                <button
                  type="button"
                  onClick={() => onModelChange(issue.suggestedModelId!)}
                  className="max-w-full shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] font-medium transition hover:opacity-80"
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <WandSparkles className="h-3 w-3" />
                    <span className="truncate">
                      Switch{issue.suggestedModelName ? ` to ${issue.suggestedModelName}` : ""}
                    </span>
                  </span>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
      {imagePreviews.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-2">
          {imagePreviews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`} className="group/thumb relative">
              <Image
                src={preview.url}
                alt={preview.file.name}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 rounded-xl border border-zinc-200 object-cover dark:border-zinc-700"
              />
              <button
                type="button"
                onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== index))}
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-white opacity-0 transition-opacity group-hover/thumb:opacity-100 hover:bg-zinc-600 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        className="mb-0.5 max-h-44 min-h-[42px] w-full min-w-0 max-w-full resize-none overflow-y-hidden bg-transparent px-3 py-1.5 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-600 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400 md:mb-1.5 md:min-h-[48px] md:px-4 md:py-2.5"
        placeholder={placeholderText ?? "Ask Assistant..."}
        disabled={disabled}
      />
      <div className="flex min-w-0 max-w-full items-end justify-between gap-2 px-1 pb-0 sm:px-1.5 md:gap-2.5 md:pb-1">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) {
              setImageFiles((prev) => [...prev, ...files]);
            }
            e.target.value = "";
          }}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center rounded-full p-2 text-zinc-700 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Attach file"
            aria-label="Attach image"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 pl-1">
          {onModelRoutingModeChange ? (
            <label className="flex items-center gap-1 text-[11px] text-zinc-600 dark:text-zinc-400">
              <span className="sr-only">Routing</span>
              <select
                value={modelRoutingMode}
                onChange={(e) =>
                  onModelRoutingModeChange(e.target.value as "manual" | "auto" | "suggested")
                }
                disabled={disabled}
                className="max-w-[124px] rounded-lg border border-zinc-300 bg-white px-1.5 py-1 text-[11px] text-zinc-900 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
              >
                <option value="manual">Manual</option>
                <option value="auto">Auto</option>
                <option value="suggested">Suggest</option>
              </select>
            </label>
          ) : null}
          {lastRouteMeta?.routerMode === "auto" && lastRouteMeta.routedModelId ? (
            <span className="max-w-[10rem] truncate text-[10px] text-zinc-600 dark:text-zinc-400" title={`Routed: ${models.find((m) => m.id === lastRouteMeta.routedModelId)?.displayName ?? lastRouteMeta.routedModelId}`}>
              Routed:{" "}
              {models.find((m) => m.id === lastRouteMeta.routedModelId)?.displayName ??
                lastRouteMeta.routedModelId}
            </span>
          ) : null}
          <ModelSelector
            selectedModelId={selectedModelId}
            onModelChange={onModelChange}
            models={models}
            loading={modelsLoading}
            budgetStatus={
              modelsData?.governance?.team?.status === "blocked" || modelsData?.governance?.user.status === "blocked"
                ? "blocked"
                : modelsData?.governance?.team?.status === "warning" || modelsData?.governance?.user.status === "warning"
                ? "warning"
                : "ok"
            }
            disabled={disabled}
            hasImages={imageFiles.length > 0}
            agentHint={modelSelectorHint}
            agentModelIncompatible={agentModelIncompatible}
          />

          {disabled && onCancelStream ? (
            <button
              type="button"
              onClick={onCancelStream}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500 text-white transition hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
              aria-label="Stop generating"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="submit"
              className={`flex h-10 w-10 items-center justify-center rounded-full transition ${
                text.trim() && !disabled
                  ? "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
                  : "bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
              }`}
              disabled={disabled || !text.trim() || Boolean(blockingIssue)}
              aria-label="Send message"
            >
              <ArrowUp className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
