import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

export const IMAGE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Image upload storage is not configured. Add a Vercel Blob store and BLOB_READ_WRITE_TOKEN.";

export const INVALID_IMAGE_REFERENCE_MESSAGE =
  "One or more attached images are invalid. Re-upload and try again.";

const LOCAL_UPLOAD_PATH_REGEX =
  /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;
const UPLOAD_FILENAME_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;
const VERCEL_PUBLIC_BLOB_HOST_REGEX =
  /^[a-z0-9]{16}\.public\.blob\.vercel-storage\.com$/;

export class InvalidImageReferenceError extends Error {
  constructor(message: string = INVALID_IMAGE_REFERENCE_MESSAGE) {
    super(message);
    this.name = "InvalidImageReferenceError";
  }
}

export type BlobUploadDiagnostics = {
  status?: number;
  responseBody?: string;
  hasReadWriteToken: boolean;
  hasStoreId: boolean;
  contentType: string;
  byteLength: number;
};

export class BlobUploadError extends Error {
  readonly diagnostics: BlobUploadDiagnostics;

  constructor(message: string, diagnostics: BlobUploadDiagnostics) {
    super(message);
    this.name = "BlobUploadError";
    this.diagnostics = diagnostics;
  }
}

export function getBlobAuthDiagnostics(): Pick<
  BlobUploadDiagnostics,
  "hasReadWriteToken" | "hasStoreId"
> {
  return {
    hasReadWriteToken: Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim()),
    hasStoreId: Boolean(process.env.BLOB_STORE_ID?.trim()),
  };
}

export type DetectedImageType = {
  mime: string;
  ext: string;
};

/** Local public/uploads when true; otherwise use Vercel Blob when configured. */
export function shouldUseLocalImageStorage(): boolean {
  if (process.env.IMAGE_UPLOAD_LOCAL === "1") return true;
  if (process.env.VERCEL === "1") return false;
  return process.env.NODE_ENV !== "production";
}

export function isBlobStorageConfigured(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (process.env.BLOB_STORE_ID?.trim()) return true;
  return false;
}

function rejectUnsafeImageReferenceShape(url: string): void {
  if (
    url.includes("\\") ||
    url.includes("?") ||
    url.includes("#") ||
    url.includes("%") ||
    url.includes("..")
  ) {
    throw new InvalidImageReferenceError();
  }
}

function validateLocalUploadReference(url: string): void {
  rejectUnsafeImageReferenceShape(url);
  if (!LOCAL_UPLOAD_PATH_REGEX.test(url)) {
    throw new InvalidImageReferenceError();
  }
  const segments = url.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[0] !== "uploads") {
    throw new InvalidImageReferenceError();
  }
}

function validateBlobImageReference(url: string, userId: string): void {
  rejectUnsafeImageReferenceShape(url);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidImageReferenceError();
  }

  if (parsed.protocol !== "https:") {
    throw new InvalidImageReferenceError();
  }
  if (parsed.username || parsed.password || parsed.port) {
    throw new InvalidImageReferenceError();
  }
  if (!VERCEL_PUBLIC_BLOB_HOST_REGEX.test(parsed.hostname)) {
    throw new InvalidImageReferenceError();
  }
  if (parsed.search || parsed.hash) {
    throw new InvalidImageReferenceError();
  }

  const expectedPrefix = `/chat/${userId}/`;
  if (!parsed.pathname.startsWith(expectedPrefix)) {
    throw new InvalidImageReferenceError();
  }

  const filename = parsed.pathname.slice(expectedPrefix.length);
  if (!UPLOAD_FILENAME_REGEX.test(filename)) {
    throw new InvalidImageReferenceError();
  }
}

export function validateChatImageReference(url: string, userId: string): void {
  if (url.startsWith("/uploads/")) {
    validateLocalUploadReference(url);
    return;
  }
  if (url.startsWith("https://")) {
    validateBlobImageReference(url, userId);
    return;
  }
  throw new InvalidImageReferenceError();
}

export function validateChatImageReferences(urls: string[], userId: string): void {
  for (const url of urls) {
    validateChatImageReference(url, userId);
  }
}

export function isBlobImageReference(url: string): boolean {
  return url.startsWith("https://");
}

export function resolveValidatedLocalUploadPath(url: string): string {
  validateLocalUploadReference(url);
  const uploadsDir = path.resolve(path.join(process.cwd(), "public", "uploads"));
  const filename = path.basename(url);
  if (!UPLOAD_FILENAME_REGEX.test(filename)) {
    throw new InvalidImageReferenceError();
  }
  const absolutePath = path.resolve(uploadsDir, filename);
  const relative = path.relative(uploadsDir, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new InvalidImageReferenceError();
  }
  return absolutePath;
}

export function detectImageTypeFromBytes(bytes: Buffer): DetectedImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: "image/png", ext: "png" };
  }
  const header = bytes.subarray(0, 6).toString("ascii");
  if (bytes.length >= 6 && (header === "GIF87a" || header === "GIF89a")) {
    return { mime: "image/gif", ext: "gif" };
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return null;
}

export function normalizeClaimedImageMime(mime: string): string | null {
  const normalized = mime.trim().toLowerCase();
  if (normalized === "image/jpg") return "image/jpeg";
  if (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(normalized)) {
    return normalized;
  }
  return null;
}

function safeBlobErrorBody(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as {
    message?: unknown;
    cause?: unknown;
    status?: unknown;
    statusCode?: unknown;
  };
  const parts: string[] = [];
  if (typeof candidate.message === "string" && candidate.message.trim()) {
    parts.push(candidate.message.trim());
  }
  if (candidate.cause && typeof candidate.cause === "object") {
    const cause = candidate.cause as { message?: unknown };
    if (typeof cause.message === "string" && cause.message.trim()) {
      parts.push(cause.message.trim());
    }
  }
  if (!parts.length) return undefined;
  return parts.join(" | ").slice(0, 300);
}

function blobErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === "number") return candidate.status;
  if (typeof candidate.statusCode === "number") return candidate.statusCode;
  return undefined;
}

async function putBlobViaSdk({
  pathname,
  bytes,
  contentType,
  userId,
}: {
  pathname: string;
  bytes: Buffer;
  contentType: string;
  userId: string;
}): Promise<{ url: string }> {
  const diagnostics: BlobUploadDiagnostics = {
    ...getBlobAuthDiagnostics(),
    contentType,
    byteLength: bytes.byteLength,
  };

  try {
    const blob = await put(pathname, bytes, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });

    if (!blob.url) {
      throw new BlobUploadError("BLOB_UPLOAD_FAILED", {
        ...diagnostics,
        responseBody: "Blob SDK returned no url",
      });
    }

    validateBlobImageReference(blob.url, userId);
    return { url: blob.url };
  } catch (error) {
    if (error instanceof BlobUploadError) throw error;
    if (error instanceof InvalidImageReferenceError) throw error;

    throw new BlobUploadError(
      error instanceof Error ? error.message : "BLOB_UPLOAD_FAILED",
      {
        ...diagnostics,
        status: blobErrorStatus(error),
        responseBody: safeBlobErrorBody(error),
      }
    );
  }
}

export async function saveChatImage({
  bytes,
  ext,
  contentType,
  userId,
}: {
  bytes: Buffer;
  ext: string;
  contentType: string;
  userId: string;
}): Promise<{ url: string }> {
  const fileName = `${randomUUID()}.${ext}`;

  if (shouldUseLocalImageStorage()) {
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });
    const absolutePath = path.join(uploadsDir, fileName);
    await writeFile(absolutePath, bytes);
    return { url: `/uploads/${fileName}` };
  }

  if (!isBlobStorageConfigured()) {
    throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  }

  return putBlobViaSdk({
    pathname: `chat/${userId}/${fileName}`,
    bytes,
    contentType,
    userId,
  });
}
