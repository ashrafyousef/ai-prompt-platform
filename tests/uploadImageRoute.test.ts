import { beforeEach, describe, expect, it, vi } from "vitest";

const requireUserIdWithWorkspace = vi.fn();
const checkRateLimit = vi.fn();
const saveChatImage = vi.fn();

vi.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      async json() {
        return body;
      },
    }),
  },
}));

vi.mock("@/lib/auth", () => ({
  requireUserIdWithWorkspace,
  authErrorStatus: vi.fn((_error: unknown, fallback: number) => fallback),
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

vi.mock("@/lib/imageStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/imageStorage")>();
  return {
    ...actual,
    saveChatImage,
    shouldUseLocalImageStorage: () => true,
    isBlobStorageConfigured: () => false,
  };
});

function jpegBytes(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
}

function pngBytes(): Buffer {
  return Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
}

function gifBytes(): Buffer {
  return Buffer.from("GIF89a", "ascii");
}

function webpBytes(): Buffer {
  const bytes = Buffer.alloc(12);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  return bytes;
}

function makeFile(params: { type: string; bytes: Buffer; name?: string }): File {
  return {
    type: params.type,
    size: params.bytes.length,
    name: params.name ?? "image.bin",
    async arrayBuffer() {
      return params.bytes.buffer.slice(
        params.bytes.byteOffset,
        params.bytes.byteOffset + params.bytes.byteLength
      );
    },
  } as File;
}

describe("upload image route magic-byte validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserIdWithWorkspace.mockResolvedValue({ userId: "user-1" });
    checkRateLimit.mockResolvedValue({ allowed: true });
    saveChatImage.mockResolvedValue({ url: "/uploads/test.png" });
  });

  async function upload(file: File) {
    const { POST } = await import("../app/api/upload/image/route");
    const formData = {
      get: (key: string) => (key === "image" ? file : null),
    };
    const req = {
      formData: async () => formData,
    };
    return POST(req as any);
  }

  it("accepts JPEG, PNG, GIF, and WebP based on magic bytes", async () => {
    const cases = [
      { type: "image/jpeg", bytes: jpegBytes() },
      { type: "image/png", bytes: pngBytes() },
      { type: "image/gif", bytes: gifBytes() },
      { type: "image/webp", bytes: webpBytes() },
    ];

    for (const sample of cases) {
      const res = await upload(makeFile(sample));
      expect(res.status).toBe(200);
    }
    expect(saveChatImage).toHaveBeenCalledTimes(4);
  });

  it("rejects spoofed MIME/content mismatches", async () => {
    const res = await upload(
      makeFile({
        type: "image/png",
        bytes: jpegBytes(),
      })
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid file type");
    expect(saveChatImage).not.toHaveBeenCalled();
  });

  it("rejects unsupported binary content", async () => {
    const res = await upload(
      makeFile({
        type: "image/png",
        bytes: Buffer.from("plain-text"),
      })
    );
    expect(res.status).toBe(400);
    expect(saveChatImage).not.toHaveBeenCalled();
  });
});
