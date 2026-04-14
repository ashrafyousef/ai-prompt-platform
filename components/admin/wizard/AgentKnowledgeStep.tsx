"use client";

import { useRef, useState, type Dispatch } from "react";
import { Plus, Upload } from "lucide-react";
import type { AgentDraft, KnowledgeSource, WizardAction } from "@/hooks/useAgentWizard";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";

let _kid = 0;
function nextKid() {
  return `k-${++_kid}-${Date.now()}`;
}

export function AgentKnowledgeStep({
  draft,
  dispatch,
}: {
  draft: AgentDraft;
  dispatch: Dispatch<WizardAction>;
}) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function addTextKnowledge() {
    if (!textContent.trim()) return;
    const src: KnowledgeSource = {
      id: nextKid(),
      type: "text",
      title: textTitle.trim() || `Knowledge block ${draft.knowledgeSources.length + 1}`,
      content: textContent.trim(),
      status: "ready",
    };
    dispatch({ type: "ADD_KNOWLEDGE", source: src });
    setTextTitle("");
    setTextContent("");
  }

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const id = nextKid();
      const src: KnowledgeSource = {
        id,
        type: "file",
        title: file.name,
        content: "",
        fileName: file.name,
        status: "uploading",
      };
      dispatch({ type: "ADD_KNOWLEDGE", source: src });

      const reader = new FileReader();
      reader.onload = () => {
        dispatch({
          type: "UPDATE_KNOWLEDGE",
          id,
          patch: { content: reader.result as string, status: "ready" },
        });
      };
      reader.onerror = () => {
        dispatch({ type: "UPDATE_KNOWLEDGE", id, patch: { status: "error" } });
      };
      reader.readAsText(file);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Knowledge</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Provide reference material the agent should know. This is optional — you can add knowledge later.
        </p>
      </div>

      {/* Mode switch */}
      <div className="flex gap-2">
        {(["text", "file"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === m
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            }`}
          >
            {m === "text" ? "Inline Text" : "File Upload"}
          </button>
        ))}
      </div>

      {/* Inline text */}
      {mode === "text" ? (
        <div className="space-y-3">
          <input
            type="text"
            value={textTitle}
            onChange={(e) => setTextTitle(e.target.value)}
            placeholder="Source title (optional)"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <textarea
            rows={6}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste knowledge content here — brand guidelines, terminology, reference data…"
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="button"
            onClick={addTextKnowledge}
            disabled={!textContent.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-4 w-4" />
            Add knowledge block
          </button>
        </div>
      ) : null}

      {/* File upload */}
      {mode === "file" ? (
        <div>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-sm font-medium text-zinc-600 transition hover:border-violet-400 hover:bg-violet-50/40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-violet-500"
          >
            <Upload className="h-5 w-5" />
            Upload text files (.txt, .md, .csv, .json)
          </button>
          <p className="mt-2 text-center text-xs text-zinc-400">
            Files are read as text. Full RAG ingestion will be supported in a future release.
          </p>
        </div>
      ) : null}

      {/* Sources list */}
      {draft.knowledgeSources.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Knowledge sources ({draft.knowledgeSources.length})
          </p>
          {draft.knowledgeSources.map((s) => (
            <KnowledgeSourceCard
              key={s.id}
              source={s}
              onRemove={() => dispatch({ type: "REMOVE_KNOWLEDGE", id: s.id })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
