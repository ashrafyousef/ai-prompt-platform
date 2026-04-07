"use client";

import { FormEvent, useEffect, useState } from "react";

type Props = {
  onSend: (text: string, imageFile?: File | null) => Promise<void>;
  disabled?: boolean;
  initialText?: string;
  modeLabel?: string;
  onCancelMode?: () => void;
};

export function ChatComposer({ onSend, disabled, initialText, modeLabel, onCancelMode }: Props) {
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  useEffect(() => {
    if (typeof initialText === "string") {
      setText(initialText);
    }
  }, [initialText]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await onSend(text.trim(), imageFile);
    setText("");
    setImageFile(null);
  }

  return (
    <form onSubmit={submit} className="border-t border-gray-200 p-4">
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
        className="mb-2 h-24 w-full rounded-md border border-gray-300 p-2"
        placeholder="Send a prompt..."
        disabled={disabled}
      />
      <div className="flex items-center justify-between gap-3">
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
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
      {imageFile ? <p className="mt-2 text-xs text-gray-500">Attached: {imageFile.name}</p> : null}
    </form>
  );
}
