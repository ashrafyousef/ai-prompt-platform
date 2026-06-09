import { describe, expect, it, vi } from "vitest";
import {
  prepareImageForUpload,
  resolveImageUploadErrorMessage,
  validateImageUploadBatch,
} from "@/components/chat/hooks/useChatStream";
import {
  IMAGE_TOO_LARGE_MESSAGE,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_FILE_SIZE_BYTES,
  MAX_TOTAL_IMAGE_SIZE_BYTES,
} from "@/lib/imageUploadLimits";

function fakeFile(size: number): File {
  return { size } as File;
}

describe("validateImageUploadBatch", () => {
  it("allows up to 4 images within limits", () => {
    const files = [
      fakeFile(4 * 1024 * 1024),
      fakeFile(4 * 1024 * 1024),
      fakeFile(4 * 1024 * 1024),
      fakeFile(4 * 1024 * 1024),
    ];
    expect(validateImageUploadBatch(files)).toBeNull();
  });

  it("rejects more than 4 images", () => {
    const files = [fakeFile(1), fakeFile(1), fakeFile(1), fakeFile(1), fakeFile(1)];
    expect(validateImageUploadBatch(files)).toBe("You can attach up to 4 images per message.");
  });

  it("rejects per-file size above 4MB", () => {
    const files = [fakeFile(4 * 1024 * 1024 + 1)];
    expect(validateImageUploadBatch(files)).toBe("Each image must be 4 MB or smaller.");
  });

  it("caps total selected image size at 16MB", () => {
    expect(MAX_TOTAL_IMAGE_SIZE_BYTES).toBe(
      MAX_IMAGES_PER_MESSAGE * MAX_IMAGE_FILE_SIZE_BYTES
    );
  });
});

describe("image upload preparation", () => {
  it("rejects an oversized compressed file before fetch", async () => {
    const compress = vi.fn().mockResolvedValue(fakeFile(4 * 1024 * 1024 + 1));

    await expect(
      prepareImageForUpload(fakeFile(3 * 1024 * 1024), compress)
    ).rejects.toThrow(IMAGE_TOO_LARGE_MESSAGE);
  });

  it("maps Vercel payload rejection to stable friendly copy", () => {
    expect(
      resolveImageUploadErrorMessage(413, "FUNCTION_PAYLOAD_TOO_LARGE")
    ).toBe(IMAGE_TOO_LARGE_MESSAGE);
  });
});
