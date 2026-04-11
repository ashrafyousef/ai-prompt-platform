"use client";

import { DragEvent, FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, ArrowUp, ChevronDown, Square, X } from "lucide-react";

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"]);

type Props = {
  onSend: (text: string, imageFiles?: File[]) => Promise<void>;
  disabled?: boolean;
  initialText?: string;
  modeLabel?: string;
  onCancelMode?: () => void;
  onCancelStream?: () => void;
  activeAgentName: string;
  modelVersion: string;
  onModelVersionChange: (v: string) => void;
};

export function ChatComposer({
  onSend,
  disabled,
  initialText,
  modeLabel,
  onCancelMode,
  onCancelStream,
  activeAgentName,
  modelVersion,
  onModelVersionChange,
}: Props) {
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    if (!text.trim()) return;
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
      className={`relative mx-auto w-full max-w-3xl rounded-[32px] p-3 shadow-none transition-colors ${
        dragging
          ? "bg-violet-100 ring-2 ring-violet-400 dark:bg-violet-950/40 dark:ring-violet-500"
          : "bg-zinc-100 dark:bg-[#1e1e1e]"
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
        <div className="mb-2 flex items-center justify-between rounded-2xl bg-amber-100/50 px-4 py-2 text-xs text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
          <span>{modeLabel}</span>
          {onCancelMode ? (
            <button type="button" onClick={onCancelMode} className="underline hover:no-underline">
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      {imagePreviews.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2 px-2">
          {imagePreviews.map((preview, index) => (
            <div key={`${preview.file.name}-${index}`} className="group/thumb relative">
              <img
                src={preview.url}
                alt={preview.file.name}
                className="h-16 w-16 rounded-xl object-cover border border-zinc-200 dark:border-zinc-700"
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
        className="mb-2 max-h-44 min-h-[48px] w-full resize-none overflow-y-hidden bg-transparent px-4 py-3 text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-500 focus:outline-none dark:text-zinc-100 dark:placeholder:text-zinc-400"
        placeholder={`Ask ${activeAgentName || "Assistant"}...`}
        disabled={disabled}
      />
      <div className="flex items-center justify-between px-2 pb-1">
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
            className="flex items-center justify-center rounded-full p-2.5 text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            title="Attach file"
            aria-label="Attach image"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              disabled={disabled}
              value={modelVersion}
              onChange={(e) => onModelVersionChange(e.target.value)}
              aria-label="Select model"
              className="appearance-none rounded-full bg-transparent py-2 pl-3 pr-8 text-sm font-medium text-zinc-600 transition hover:bg-zinc-200 focus:outline-none dark:text-zinc-400 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <option value="v1.0" className="dark:bg-[#1e1e1e]">Fast</option>
              <option value="v2.0" className="dark:bg-[#1e1e1e]">Powerful</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" />
          </div>

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
              disabled={disabled || !text.trim()}
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
