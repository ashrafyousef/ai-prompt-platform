import { describe, expect, it } from "vitest";
import { validateImageUploadBatch } from "@/components/chat/hooks/useChatStream";

function fakeFile(size: number): File {
  return { size } as File;
}

describe("validateImageUploadBatch", () => {
  it("allows up to 4 images within limits", () => {
    const files = [fakeFile(1_000_000), fakeFile(2_000_000), fakeFile(3_000_000), fakeFile(4_000_000)];
    expect(validateImageUploadBatch(files)).toBeNull();
  });

  it("rejects more than 4 images", () => {
    const files = [fakeFile(1), fakeFile(1), fakeFile(1), fakeFile(1), fakeFile(1)];
    expect(validateImageUploadBatch(files)).toBe("You can attach up to 4 images per message.");
  });

  it("rejects per-file size above 10MB", () => {
    const files = [fakeFile(10 * 1024 * 1024 + 1)];
    expect(validateImageUploadBatch(files)).toBe("Each image must be 10 MB or smaller.");
  });

  it("rejects total size above 25MB", () => {
    const files = [fakeFile(9 * 1024 * 1024), fakeFile(9 * 1024 * 1024), fakeFile(8 * 1024 * 1024)];
    expect(validateImageUploadBatch(files)).toBe("Total image size must be 25 MB or smaller.");
  });
});
