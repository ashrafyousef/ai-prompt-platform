"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, AlertCircle } from "lucide-react";
import type { AgentDraft, KnowledgeSource, WizardAction } from "@/hooks/useAgentWizard";
import type { Dispatch } from "react";
import {
  nextUid,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_SIZE_LABEL,
  SOURCE_TYPE_LABELS,
} from "@/lib/agentConstants";
import {
  uploadKnowledgeDocument,
  validateDocumentFile,
  inferSourceType,
} from "@/lib/uploadDocument";

export function KnowledgeIntakeStep({
  draft,
  updateDraft,
  dispatch,
}: {
  draft: AgentDraft;
  updateDraft: (p: Partial<AgentDraft>) => void;
  dispatch: Dispatch<WizardAction>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadingCount = draft.knowledgeSources.filter((s) => s.status === "uploading").length;
  const failedCount = draft.knowledgeSources.filter((s) => s.status === "error").length;

  function addTextAsKnowledge() {
    if (!draft.knowledgeIntakeText.trim()) return;
    const source: KnowledgeSource = {
      id: nextUid("intake"),
      sourceType: "manual_text",
      title: `Imported source ${draft.knowledgeSources.length + 1}`,
      content: draft.knowledgeIntakeText.trim(),
      fileRef: null,
      summary: "Imported from Knowledge-First intake",
      tags: ["imported"],
      priority: 3,
      appliesTo: "all",
      isActive: true,
      ownerNote: "Source added during import intake",
      lastReviewedAt: null,
      status: "ready",
    };
    dispatch({ type: "ADD_KNOWLEDGE", source });
    updateDraft({ knowledgeIntakeText: "" });
  }

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    setUploadError(null);

    for (const file of Array.from(files)) {
      const validationErr = validateDocumentFile(file);
      if (validationErr) {
        setUploadError(validationErr);
        continue;
      }

      const id = nextUid("intake");
      const placeholderSource: KnowledgeSource = {
        id,
        sourceType: inferSourceType(file.name),
        title: file.name,
        content: null,
        fileRef: { fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size },
        summary: "Imported from Knowledge-First intake",
        tags: ["imported"],
        priority: 3,
        appliesTo: "all",
        isActive: true,
        ownerNote: "Source file added during import intake",
        lastReviewedAt: null,
        status: "uploading",
      };
      dispatch({ type: "ADD_KNOWLEDGE", source: placeholderSource });
      setUploading(true);

      try {
        const result = await uploadKnowledgeDocument(file);
        dispatch({
          type: "UPDATE_KNOWLEDGE",
          id,
          patch: {
            status: "ready",
            fileRef: {
              fileName: result.fileName,
              mimeType: result.mimeType,
              sizeBytes: result.sizeBytes,
              url: result.url,
            },
          },
        });
      } catch (err) {
        dispatch({ type: "UPDATE_KNOWLEDGE", id, patch: { status: "error" } });
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Knowledge Intake
        </h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add reference material upfront. These become knowledge sources you can refine in later steps.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
        <p><strong>You provide:</strong> reference text or source files.</p>
        <p className="mt-1"><strong>System creates:</strong> knowledge sources you can edit in the Knowledge step.</p>
        <p className="mt-1"><strong>You verify:</strong> source type, priority, and relevance before publishing.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Paste reference text
        </label>
        <textarea
          rows={8}
          value={draft.knowledgeIntakeText}
          onChange={(event) => updateDraft({ knowledgeIntakeText: event.target.value })}
          placeholder="Paste policy docs, glossary, process notes, or FAQ text..."
          className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          onClick={addTextAsKnowledge}
          disabled={!draft.knowledgeIntakeText.trim()}
          className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add as knowledge source
        </button>
        <p className="mt-2 text-[11px] text-zinc-400">
          Creates a text-based source. Title, tags, and priority can be refined in the Knowledge step.
        </p>
      </div>

      <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-900">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={DOCUMENT_ACCEPT}
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Upload source files
        </button>
        <p className="mt-2 text-[11px] text-zinc-400">
          Supported: {DOCUMENT_MAX_SIZE_LABEL}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          Files are stored with metadata. Text extraction for binary formats will be available in a future update.
        </p>
      </div>

      {uploadError ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {uploadError}
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Seeded sources ({draft.knowledgeSources.length})
        </p>
        {(uploadingCount > 0 || failedCount > 0) ? (
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {uploadingCount > 0 ? `${uploadingCount} uploading` : null}
            {uploadingCount > 0 && failedCount > 0 ? " · " : null}
            {failedCount > 0 ? `${failedCount} failed` : null}
          </p>
        ) : null}
        {draft.knowledgeSources.length === 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            No sources added yet. Paste text or upload a file above, then continue to Identity.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {draft.knowledgeSources.map((source) => (
              <div
                key={source.id}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">
                      {source.title}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                        {SOURCE_TYPE_LABELS[source.sourceType]}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        P{source.priority}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                        {source.fileRef?.fileName ? "File-based" : "Text-based"}
                      </span>
                      {!source.isActive ? (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
                          Inactive
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-[11px] text-zinc-500">
                    {source.status === "uploading" ? "Uploading..." : null}
                    {source.status === "error" ? "Upload failed" : null}
                    {source.status === "ready" ? "Ready" : null}
                  </div>
                </div>
                {source.fileRef?.url ? (
                  <a
                    href={source.fileRef.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-[11px] text-violet-600 hover:underline dark:text-violet-400"
                  >
                    View uploaded file
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
