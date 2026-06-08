import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const IMAGE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Image upload storage is not configured. Add a Vercel Blob store and BLOB_READ_WRITE_TOKEN.";

export const INVALID_IMAGE_REFERENCE_MESSAGE =
  "One or more attached images are invalid. Re-upload and try again.";

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";

const LOCAL_UPLOAD_PATH_REGEX =
  /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;
const UPLOAD_FILENAME_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|gif|webp)$/i;

export class InvalidImageReferenceError extends Error {
  constructor(message: string = INVALID_IMAGE_REFERENCE_MESSAGE) {
    super(message);
    this.name = "InvalidImageReferenceError";
  }
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
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

export function parseStoreIdFromReadWriteToken(token: string): string {
  const [, , , storeId = ""] = token.split("_");
  return storeId;
}

export function getBlobStoreHost(): string | null {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return null;
  const storeId = parseStoreIdFromReadWriteToken(token);
  if (!storeId) return null;
  return `${storeId}.public.blob.vercel-storage.com`;
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
  const expectedHost = getBlobStoreHost();
  if (!expectedHost) {
    throw new InvalidImageReferenceError();
  }

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
  if (parsed.hostname !== expectedHost) {
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

async function putBlobViaFetch({
  pathname,
  bytes,
  contentType,
  token,
}: {
  pathname: string;
  bytes: Buffer;
  contentType: string;
  token: string;
}): Promise<{ url: string }> {
  const storeId = parseStoreIdFromReadWriteToken(token);
  const params = new URLSearchParams({ pathname });

  const response = await fetch(`${BLOB_API_URL}/?${params.toString()}`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "x-api-version": BLOB_API_VERSION,
      "x-vercel-blob-store-id": storeId,
      "x-vercel-blob-access": "public",
      "x-content-type": contentType,
      "x-add-random-suffix": "0",
      "x-content-length": String(bytes.byteLength),
    },
    body: new Uint8Array(bytes),
  });

  if (!response.ok) {
    throw new Error("BLOB_UPLOAD_FAILED");
  }

  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("BLOB_UPLOAD_FAILED");
  }

  return { url: data.url };
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

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new Error("BLOB_STORAGE_NOT_CONFIGURED");
  }

  return putBlobViaFetch({
    pathname: `chat/${userId}/${fileName}`,
    bytes,
    contentType,
    token,
  });
}
