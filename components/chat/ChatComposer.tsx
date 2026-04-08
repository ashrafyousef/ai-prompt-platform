"use client";

import { FormEvent, useEffect, useState } from "react";

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

  useEffect(() => {
    if (typeof initialText === "string") {
      setText(initialText);
    }
  }, [initialText]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSend(text.trim(), imageFiles);
    setText("");
    setImageFiles([]);
  }

  return (
    <form onSubmit={submit} className="border-t border-gray-200 bg-white p-4 text-gray-900">
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
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="mb-2 h-24 w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 placeholder:text-gray-500"
        placeholder="Send a prompt..."
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-3">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            setImageFiles(files);
          }}
          className="text-sm text-gray-900 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-gray-900 hover:file:bg-gray-200"
          disabled={disabled}
        />
        <button
          type="submit"
          className="rounded-md bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          disabled={disabled || !text.trim()}
        >
          Send
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
