"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Paperclip, Send } from "lucide-react";

type Props = {
  onSend: (text: string, imageFiles?: File[]) => Promise<void>;
  disabled?: boolean;
  initialText?: string;
  modeLabel?: string;
  onCancelMode?: () => void;
};

export function ChatComposer({ onSend, disabled, initialText, modeLabel, onCancelMode }: Props) {
  const [text, setText] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (typeof initialText === "string") {
      setText(initialText);
    }
  }, [initialText]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${nextHeight}px`;
  }, [text]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSend(text.trim(), imageFiles);
    setText("");
    setImageFiles([]);
  }

  return (
    <form
      onSubmit={submit}
      className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200/80 bg-white/90 p-3 text-zinc-900 shadow-lg backdrop-blur"
    >
      {modeLabel ? (
        <div className="mb-2 flex items-center justify-between rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <span>{modeLabel}</span>
          {onCancelMode ? (
            <button type="button" onClick={onCancelMode} className="underline">
              Cancel
            </button>
          ) : null}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mb-2 max-h-44 min-h-[48px] w-full resize-none rounded-xl border border-zinc-200 bg-white px-3 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-violet-300 focus:outline-none"
        placeholder="Message your assistant..."
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setImageFiles(files);
          }}
          className="hidden"
          disabled={disabled}
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            title="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            title="Voice"
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm text-white transition hover:bg-zinc-700 disabled:opacity-50"
          disabled={disabled || !text.trim()}
        >
          {disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {disabled ? "Thinking..." : "Send"}
        </button>
      </div>
      {imageFiles.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {imageFiles.map((file, index) => (
            <button
              key={`${file.name}-${index}`}
              type="button"
              className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700 hover:bg-gray-200"
              onClick={() =>
                setImageFiles((prev) => prev.filter((_, currentIndex) => currentIndex !== index))
              }
            >
              {file.name} ×
            </button>
          ))}
        </div>
      ) : null}
    </form>
  );
}
