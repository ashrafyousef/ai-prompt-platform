import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export const IMAGE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Image upload storage is not configured. Add a Vercel Blob store and BLOB_READ_WRITE_TOKEN.";

const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";

/** Local public/uploads when true; otherwise use Vercel Blob when configured. */
export function shouldUseLocalImageStorage(): boolean {
  if (process.env.IMAGE_UPLOAD_LOCAL === "1") return true;
  if (process.env.VERCEL === "1") return false;
  return process.env.NODE_ENV !== "production";
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

function parseStoreIdFromReadWriteToken(token: string): string {
  const [, , , storeId = ""] = token.split("_");
  return storeId;
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
