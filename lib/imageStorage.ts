import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { put } from "@vercel/blob";

export const IMAGE_UPLOAD_UNAVAILABLE_MESSAGE =
  "Image upload storage is not configured. Add a Vercel Blob store and BLOB_READ_WRITE_TOKEN.";

/** Local public/uploads when true; otherwise use Vercel Blob when configured. */
export function shouldUseLocalImageStorage(): boolean {
  if (process.env.IMAGE_UPLOAD_LOCAL === "1") return true;
  if (process.env.VERCEL === "1") return false;
  return process.env.NODE_ENV !== "production";
}

export function isBlobStorageConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
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

  const blob = await put(`chat/${userId}/${fileName}`, bytes, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });

  return { url: blob.url };
}
