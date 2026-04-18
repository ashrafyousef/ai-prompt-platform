"use client";

import { useRef, useState, type Dispatch } from "react";
import { Plus, Upload, Loader2, AlertCircle } from "lucide-react";
import type { AgentDraft, KnowledgeSource, WizardAction } from "@/hooks/useAgentWizard";
import type { AgentKnowledgeSourceType } from "@/lib/agentConfig";
import {
  nextUid,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_SIZE_LABEL,
  SOURCE_TYPE_HELPERS,
} from "@/lib/agentConstants";
import { KnowledgeSourceCard } from "./KnowledgeSourceCard";
import {
  uploadKnowledgeDocument,
  validateDocumentFile,
  inferSourceType,
} from "@/lib/uploadDocument";

export function AgentKnowledgeStep({
  draft,
  dispatch,
}: {
  draft: AgentDraft;
  dispatch: Dispatch<WizardAction>;
}) {
  const [sourceType, setSourceType] = useState<AgentKnowledgeSourceType>("manual_text");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [lastReviewedAt, setLastReviewedAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const activeCount = draft.knowledgeSources.filter((s) => s.isActive).length;
  const fileBackedCount = draft.knowledgeSources.filter((s) => Boolean(s.fileRef?.fileName)).length;
  const uploadingCount = draft.knowledgeSources.filter((s) => s.status === "uploading").length;
  const failedCount = draft.knowledgeSources.filter((s) => s.status === "error").length;

  function addTextKnowledge() {
    if (!textContent.trim()) return;
    const src: KnowledgeSource = {
      id: nextUid("k"),
      sourceType,
      title: textTitle.trim() || `Knowledge block ${draft.knowledgeSources.length + 1}`,
      content: textContent.trim(),
      fileRef: null,
      summary: summary.trim(),
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      priority: 3,
      appliesTo: "all",
      isActive: true,
      ownerNote: ownerNote.trim(),
      lastReviewedAt: lastReviewedAt ? `${lastReviewedAt}T00:00:00.000Z` : null,
      status: "ready",
    };
    dispatch({ type: "ADD_KNOWLEDGE", source: src });
    setTextTitle("");
    setTextContent("");
    setSummary("");
    setTags("");
    setOwnerNote("");
    setLastReviewedAt("");
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

      const id = nextUid("k");
      const placeholderSrc: KnowledgeSource = {
        id,
        sourceType: inferSourceType(file.name),
        title: textTitle.trim() || file.name,
        content: null,
        fileRef: { fileName: file.name, mimeType: file.type || undefined, sizeBytes: file.size },
        summary: summary.trim(),
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        priority: 3,
        appliesTo: "all",
        isActive: true,
        ownerNote: ownerNote.trim(),
        lastReviewedAt: null,
        status: "uploading",
      };
      dispatch({ type: "ADD_KNOWLEDGE", source: placeholderSrc });
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
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Knowledge</h2>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Add reference material the agent can draw on — FAQs, policies, glossaries, or documents. Each source is versioned and auditable.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {activeCount} active
        </span>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {draft.knowledgeSources.length} total
        </span>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {fileBackedCount} file-based
        </span>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Add knowledge item
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Source type
            </label>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as AgentKnowledgeSourceType)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              <option value="manual_text">Manual text</option>
              <option value="faq">FAQ</option>
              <option value="glossary">Glossary</option>
              <option value="rules">Rules</option>
              <option value="examples">Examples</option>
              <option value="txt">TXT document</option>
              <option value="pdf">PDF document</option>
              <option value="docx">DOCX document</option>
            </select>
            <p className="mt-1 text-[11px] text-zinc-400">{SOURCE_TYPE_HELPERS[sourceType]}</p>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Title
            </label>
            <input
              type="text"
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="Source title"
              className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Summary"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags (comma separated)"
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        <textarea
          rows={5}
          value={textContent}
          onChange={(e) => setTextContent(e.target.value)}
          placeholder="Paste knowledge content here — brand guidelines, terminology, reference data…"
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-relaxed dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <p className="mt-1 text-[11px] text-zinc-400">
          Focused, topic-specific entries are easier to maintain and produce better results.
        </p>

        <input
          type="text"
          value={ownerNote}
          onChange={(e) => setOwnerNote(e.target.value)}
          placeholder="Owner note (optional)"
          className="mt-3 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
        />
        <div className="mt-3 max-w-xs">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Last reviewed
          </label>
          <input
            type="date"
            value={lastReviewedAt}
            onChange={(e) => setLastReviewedAt(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {uploadError ? (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {uploadError}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addTextKnowledge}
            disabled={!textContent.trim()}
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            <Plus className="h-4 w-4" />
            Add text block
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={DOCUMENT_ACCEPT}
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload document
          </button>
        </div>
        <p className="mt-2 text-[11px] text-zinc-400">
          Supported: {DOCUMENT_MAX_SIZE_LABEL}
        </p>
        <p className="mt-1 text-[11px] text-zinc-400">
          Files are stored with metadata and can be reviewed or replaced later.
        </p>
        {(uploadingCount > 0 || failedCount > 0) ? (
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            {uploadingCount > 0 ? `${uploadingCount} uploading` : null}
            {uploadingCount > 0 && failedCount > 0 ? " · " : null}
            {failedCount > 0 ? `${failedCount} failed` : null}
          </p>
        ) : null}
      </div>

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
              onChange={(patch) => dispatch({ type: "UPDATE_KNOWLEDGE", id: s.id, patch })}
              onRemove={() => dispatch({ type: "REMOVE_KNOWLEDGE", id: s.id })}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-10 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-400">No knowledge sources yet.</p>
          <p className="mt-1 text-xs text-zinc-400">
            Add a text entry or upload a document above. You can set priority and active/inactive state afterward.
          </p>
        </div>
      )}
    </div>
  );
}
