"use client";

import { useRef, useState, useCallback } from "react";
import {
  Plus,
  Upload,
  Trash2,
  FileText,
  File as FileIcon,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { AgentKnowledgeItem, AgentKnowledgeSourceType } from "@/lib/agentConfig";
import { knowledgeSourceTypeValues } from "@/lib/agentConfig";
import {
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_HELPERS,
  nextUid,
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_SIZE_LABEL,
} from "@/lib/agentConstants";
import {
  uploadKnowledgeDocument,
  validateDocumentFile,
  inferSourceType,
} from "@/lib/uploadDocument";

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100";

function nextId() {
  return nextUid("edit-k");
}

/* ------------------------------------------------------------------ */
/*  Knowledge item card — collapsible inline editor                    */
/* ------------------------------------------------------------------ */

function KnowledgeItemCard({
  item,
  onChange,
  onRemove,
}: {
  item: AgentKnowledgeItem;
  onChange: (patch: Partial<AgentKnowledgeItem>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tagsText = item.tags.join(", ");
  const hasFile = !!item.fileRef;
  const reviewedDate = item.lastReviewedAt ? item.lastReviewedAt.slice(0, 10) : "";
  const influenceLabel =
    item.priority >= 5
      ? "Highest influence"
      : item.priority >= 4
      ? "High influence"
      : item.priority >= 3
      ? "Standard influence"
      : "Low influence";

  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
          {hasFile ? <FileIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {item.title || "Untitled"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <span className="rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {SOURCE_TYPE_LABELS[item.sourceType] ?? item.sourceType}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                item.isActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"
                  : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300"
              }`}
            >
              {item.isActive ? "Active" : "Inactive"}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              P{item.priority} · {influenceLabel}
            </span>
            <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {hasFile ? "File-based" : "Text-based"}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {item.fileRef
              ? `${item.fileRef.fileName}${
                  item.fileRef.sizeBytes
                    ? ` (${(item.fileRef.sizeBytes / 1024).toFixed(1)} KB)`
                    : ""
                }`
              : item.content
              ? `${(item.content.length / 1000).toFixed(1)}k chars`
              : "No content yet"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-200 hover:text-red-600 dark:hover:bg-zinc-700 dark:hover:text-red-400"
            aria-label="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {expanded ? (
        <div className="space-y-3 border-t border-zinc-200 px-4 py-4 dark:border-zinc-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Title
              </label>
              <input
                type="text"
                value={item.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="Knowledge source title"
                className={inputCls}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Source type
              </label>
              <select
                value={item.sourceType}
                onChange={(e) =>
                  onChange({ sourceType: e.target.value as AgentKnowledgeSourceType })
                }
                className={inputCls}
              >
                {knowledgeSourceTypeValues.map((v) => (
                  <option key={v} value={v}>
                    {SOURCE_TYPE_LABELS[v]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-zinc-400">{SOURCE_TYPE_HELPERS[item.sourceType]}</p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Summary
            </label>
            <textarea
              rows={2}
              value={item.summary}
              onChange={(e) => onChange({ summary: e.target.value })}
              placeholder="Short description of what this source covers"
              className={inputCls}
            />
          </div>

          {item.fileRef ? (
            <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950">
              <div className="flex items-center gap-2">
                <FileIcon className="h-4 w-4 shrink-0 text-zinc-400" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-zinc-700 dark:text-zinc-200">
                    {item.fileRef.fileName}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {item.fileRef.mimeType ?? "unknown type"}
                    {item.fileRef.sizeBytes
                      ? ` · ${(item.fileRef.sizeBytes / 1024).toFixed(1)} KB`
                      : ""}
                  </p>
                </div>
                {item.fileRef.url ? (
                  <a
                    href={item.fileRef.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800"
                    aria-label="View uploaded file"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Text extraction for binary formats (PDF, DOCX) is not yet active. The file is stored and metadata is tracked for future processing.
              </p>
            </div>
          ) : null}

          {!item.fileRef || item.content ? (
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Content
              </label>
              <textarea
                rows={6}
                value={item.content ?? ""}
                onChange={(e) => onChange({ content: e.target.value })}
                placeholder="Source content"
                className={inputCls + " leading-relaxed"}
              />
            </div>
          ) : null}

          <div className="rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Metadata
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tags
              </label>
              <input
                type="text"
                value={tagsText}
                onChange={(e) =>
                  onChange({
                    tags: e.target.value
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="policy, brand, support"
                className={inputCls}
              />
            </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Last reviewed
                </label>
                <input
                  type="date"
                  value={reviewedDate}
                  onChange={(e) =>
                    onChange({
                      lastReviewedAt: e.target.value ? `${e.target.value}T00:00:00.000Z` : null,
                    })
                  }
                  className={inputCls}
                />
              </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Priority
              </label>
              <select
                value={item.priority}
                onChange={(e) => onChange({ priority: Number(e.target.value) })}
                className={inputCls}
              >
                <option value={1}>1 - Low influence</option>
                <option value={2}>2 - Light influence</option>
                <option value={3}>3 - Standard influence</option>
                <option value={4}>4 - High influence</option>
                <option value={5}>5 - Highest influence</option>
              </select>
            </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-6">
              <label className="inline-flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(e) => onChange({ isActive: e.target.checked })}
                  className="h-4 w-4 rounded accent-violet-600"
                />
                Active
              </label>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Owner note
              </label>
              <input
                type="text"
                value={item.ownerNote}
                onChange={(e) => onChange({ ownerNote: e.target.value })}
                placeholder="Internal note"
                className={inputCls}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Add form — manual text + document upload                           */
/* ------------------------------------------------------------------ */

function AddKnowledgeForm({
  onAdd,
}: {
  onAdd: (item: AgentKnowledgeItem) => void;
}) {
  const [sourceType, setSourceType] = useState<AgentKnowledgeSourceType>("manual_text");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [ownerNote, setOwnerNote] = useState("");
  const [lastReviewedAt, setLastReviewedAt] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function addManual() {
    if (!content.trim()) return;
    onAdd({
      id: nextId(),
      title: title.trim() || "Untitled source",
      sourceType,
      content: content.trim(),
      fileRef: null,
      summary: summary.trim(),
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      priority: 3,
      appliesTo: "all",
      isActive: true,
      ownerNote: ownerNote.trim(),
      lastReviewedAt: lastReviewedAt ? `${lastReviewedAt}T00:00:00.000Z` : null,
    });
    setTitle("");
    setContent("");
    setSummary("");
    setTags("");
    setOwnerNote("");
    setLastReviewedAt("");
  }

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError(null);

    for (const file of Array.from(files)) {
      const validationErr = validateDocumentFile(file);
      if (validationErr) {
        setUploadError(validationErr);
        continue;
      }

      setUploading(true);
      try {
        const result = await uploadKnowledgeDocument(file);
        onAdd({
          id: nextId(),
          title: title.trim() || file.name,
          sourceType: inferSourceType(file.name),
          content: null,
          fileRef: {
            fileName: result.fileName,
            mimeType: result.mimeType,
            sizeBytes: result.sizeBytes,
            url: result.url,
          },
          summary: summary.trim(),
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          priority: 3,
          appliesTo: "all",
          isActive: true,
          ownerNote: ownerNote.trim(),
          lastReviewedAt: lastReviewedAt ? `${lastReviewedAt}T00:00:00.000Z` : null,
        });
        setTitle("");
        setSummary("");
        setTags("");
        setOwnerNote("");
        setLastReviewedAt("");
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setUploading(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
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
            onChange={(e) => setSourceType(e.target.value as AgentKnowledgeSourceType)}
            className={inputCls}
          >
            {knowledgeSourceTypeValues.map((v) => (
              <option key={v} value={v}>
                {SOURCE_TYPE_LABELS[v]}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-zinc-400">{SOURCE_TYPE_HELPERS[sourceType]}</p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Source title"
            className={inputCls}
          />
        </div>
      </div>

      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="Summary (optional)"
        className={inputCls + " mt-3"}
      />
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma separated)"
          className={inputCls}
        />
        <input
          type="text"
          value={ownerNote}
          onChange={(e) => setOwnerNote(e.target.value)}
          placeholder="Owner note (optional)"
          className={inputCls}
        />
      </div>
      <div className="mt-3 max-w-xs">
        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Last reviewed
        </label>
        <input
          type="date"
          value={lastReviewedAt}
          onChange={(e) => setLastReviewedAt(e.target.value)}
          className={inputCls}
        />
      </div>

      <textarea
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste source content..."
        className={inputCls + " mt-3 leading-relaxed"}
      />

      {uploadError ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {uploadError}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={addManual}
          disabled={!content.trim()}
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
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
        Uploaded files are stored as managed sources. You can adjust priority and active state after upload.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Drop zone wrapper                                                  */
/* ------------------------------------------------------------------ */

function DropZone({
  onFiles,
  children,
}: {
  onFiles: (files: File[]) => void;
  children: React.ReactNode;
}) {
  const [dragging, setDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) onFiles(files);
    },
    [onFiles]
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`transition ${
        dragging ? "ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-zinc-950" : ""
      }`}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main exported editor                                               */
/* ------------------------------------------------------------------ */

export function KnowledgeEditor({
  items,
  onChange,
}: {
  items: AgentKnowledgeItem[];
  onChange: (next: AgentKnowledgeItem[]) => void;
}) {
  const [dropUploading, setDropUploading] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  function updateItem(id: string, patch: Partial<AgentKnowledgeItem>) {
    onChange(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id: string) {
    onChange(items.filter((item) => item.id !== id));
  }

  function addItem(item: AgentKnowledgeItem) {
    onChange([...items, item]);
  }

  async function handleDroppedFiles(files: File[]) {
    setDropError(null);
    for (const file of files) {
      const validationErr = validateDocumentFile(file);
      if (validationErr) {
        setDropError(validationErr);
        continue;
      }
      setDropUploading(true);
      try {
        const result = await uploadKnowledgeDocument(file);
        addItem({
          id: nextId(),
          title: file.name,
          sourceType: inferSourceType(file.name),
          content: null,
          fileRef: {
            fileName: result.fileName,
            mimeType: result.mimeType,
            sizeBytes: result.sizeBytes,
            url: result.url,
          },
          summary: "",
          tags: [],
          priority: 3,
          appliesTo: "all",
          isActive: true,
          ownerNote: "",
          lastReviewedAt: null,
        });
      } catch (err) {
        setDropError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setDropUploading(false);
      }
    }
  }

  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;
  const fileBasedCount = items.filter((item) => Boolean(item.fileRef?.fileName)).length;
  const highInfluenceCount = items.filter((item) => item.priority >= 4).length;

  return (
    <DropZone onFiles={handleDroppedFiles}>
      <div className="space-y-6">
        <AddKnowledgeForm onAdd={addItem} />

        {dropError ? (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {dropError}
          </div>
        ) : null}

        {dropUploading ? (
          <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
            Uploading dropped file…
          </div>
        ) : null}

        {items.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              {items.length} source{items.length !== 1 ? "s" : ""} · {activeCount} active
              {inactiveCount > 0 ? ` · ${inactiveCount} inactive` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {fileBasedCount} file-based
              </span>
              <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                {highInfluenceCount} high influence
              </span>
            </div>
            {items.map((item) => (
              <KnowledgeItemCard
                key={item.id}
                item={item}
                onChange={(patch) => updateItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 py-10 text-center dark:border-zinc-700">
            <FileText className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-400">No knowledge sources</p>
            <p className="mt-1 max-w-xs mx-auto text-xs text-zinc-400">
              Knowledge grounds the agent in real data. Paste text, upload documents, or add FAQs using the form above.
            </p>
            <p className="mt-2 text-[11px] text-zinc-400/80">
              Agents without knowledge rely entirely on their system prompt.
            </p>
          </div>
        )}
      </div>
    </DropZone>
  );
}
