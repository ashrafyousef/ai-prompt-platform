import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  INVALID_IMAGE_REFERENCE_MESSAGE,
  InvalidImageReferenceError,
  detectImageTypeFromBytes,
  getBlobStoreHost,
  normalizeClaimedImageMime,
  resolveValidatedLocalUploadPath,
  validateChatImageReference,
  validateChatImageReferences,
} from "@/lib/imageStorage";

const userId = "11111111-1111-4111-8111-111111111111";
const validUuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";

function localPath(ext: string): string {
  return `/uploads/${validUuid}.${ext}`;
}

function blobUrl(user: string = userId, ext = "png"): string {
  const host = getBlobStoreHost();
  if (!host) throw new Error("Blob host not configured in test");
  return `https://${host}/chat/${user}/${validUuid}.${ext}`;
}

describe("validateChatImageReference local uploads", () => {
  it("accepts valid local png/jpg/jpeg/gif/webp paths", () => {
    for (const ext of ["png", "jpg", "jpeg", "gif", "webp"]) {
      expect(() => validateChatImageReference(localPath(ext), userId)).not.toThrow();
    }
  });

  it("rejects traversal and path tricks", () => {
    const rejected = [
      "../package.json",
      "/uploads/../../.env",
      "/uploads/../../../../../../etc/passwd",
      "/uploads/%2e%2e/package.json",
      String.raw`/uploads\..\..\package.json`,
      "/uploads//../../package.json",
      "/uploads/abc.png?cache=1",
      "/uploads/abc.png#frag",
      "/etc/passwd",
      "uploads/abc.png",
      "/uploads/not-a-uuid.png",
      "/uploads/aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee.svg",
    ];
    for (const url of rejected) {
      expect(() => validateChatImageReference(url, userId)).toThrow(InvalidImageReferenceError);
    }
  });

  it("resolves validated local paths inside public/uploads", () => {
    const resolved = resolveValidatedLocalUploadPath(localPath("png"));
    expect(resolved.endsWith(`${validUuid}.png`)).toBe(true);
    expect(resolved.includes(`${pathSep()}public${pathSep()}uploads${pathSep()}`)).toBe(true);
  });
});

describe("validateChatImageReference blob uploads", () => {
  beforeEach(() => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_teststore_suffix");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts configured blob URLs for the current user", () => {
    expect(() => validateChatImageReference(blobUrl(), userId)).not.toThrow();
  });

  it("rejects wrong blob host, user path, and insecure schemes", () => {
    const host = getBlobStoreHost()!;
    const rejected = [
      `http://${host}/chat/${userId}/${validUuid}.png`,
      `https://evil.public.blob.vercel-storage.com/chat/${userId}/${validUuid}.png`,
      `https://${host}/chat/other-user/${validUuid}.png`,
      `https://${host}/chat/${userId}/${validUuid}.png?sig=1`,
      `https://${host}/chat/${userId}/${validUuid}.png#x`,
      "data:image/png;base64,abc",
      "file:///etc/passwd",
      "ftp://example.com/image.png",
      "javascript:alert(1)",
      "https://example.com/image.png",
    ];
    for (const url of rejected) {
      expect(() => validateChatImageReference(url, userId)).toThrow(InvalidImageReferenceError);
    }
  });
});

describe("validateChatImageReferences batch", () => {
  it("rejects mixed valid and invalid references", () => {
    expect(() =>
      validateChatImageReferences([localPath("png"), "../package.json"], userId)
    ).toThrow(InvalidImageReferenceError);
  });

  it("uses a safe user-facing error message", () => {
    expect(INVALID_IMAGE_REFERENCE_MESSAGE).toContain("invalid");
  });
});

describe("detectImageTypeFromBytes", () => {
  it("detects JPEG, PNG, GIF, and WebP magic bytes", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const gif = Buffer.from("GIF89a", "ascii");
    const webp = Buffer.alloc(12);
    webp.write("RIFF", 0, "ascii");
    webp.write("WEBP", 8, "ascii");

    expect(detectImageTypeFromBytes(jpeg)).toEqual({ mime: "image/jpeg", ext: "jpg" });
    expect(detectImageTypeFromBytes(png)).toEqual({ mime: "image/png", ext: "png" });
    expect(detectImageTypeFromBytes(gif)).toEqual({ mime: "image/gif", ext: "gif" });
    expect(detectImageTypeFromBytes(webp)).toEqual({ mime: "image/webp", ext: "webp" });
  });

  it("returns null for unsupported content", () => {
    expect(detectImageTypeFromBytes(Buffer.from("not-an-image"))).toBeNull();
  });
});

describe("normalizeClaimedImageMime", () => {
  it("normalizes image/jpg to image/jpeg", () => {
    expect(normalizeClaimedImageMime("image/jpg")).toBe("image/jpeg");
  });
});

function pathSep(): string {
  return process.platform === "win32" ? "\\" : "/";
}
