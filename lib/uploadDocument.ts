const ALLOWED_EXTENSIONS = new Set(["pdf", "docx", "txt", "md", "csv", "json"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024;

export type DocumentUploadResult = {
  url: string;
  fileName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  ext: string;
  uploadedAt: string;
  processingStatus: "pending" | "ready" | "failed";
};

export function validateDocumentFile(file: File): string | null {
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return `Unsupported file type ".${ext}". Allowed: ${Array.from(ALLOWED_EXTENSIONS).join(", ")}.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE / 1024 / 1024} MB.`;
  }
  return null;
}

export function inferSourceType(
  fileName: string
): "pdf" | "docx" | "txt" {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "docx") return "docx";
  return "txt";
}

export async function uploadKnowledgeDocument(
  file: File
): Promise<DocumentUploadResult> {
  const validationError = validateDocumentFile(file);
  if (validationError) throw new Error(validationError);

  const form = new FormData();
  form.append("file", file);

  const res = await fetch("/api/upload/document", {
    method: "POST",
    body: form,
  });

  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || "Upload failed.");
  }
  return json as DocumentUploadResult;
}
