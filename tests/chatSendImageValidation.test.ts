import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();
const checkRateLimit = vi.fn();
const readFile = vi.fn();
const prepareOrchestrator = vi.fn();
const getGovernedModelsForUser = vi.fn();

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

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

vi.mock("fs/promises", () => ({
  readFile,
}));

vi.mock("@/lib/usage", () => ({
  getGovernedModelsForUser,
  assertUserWithinSoftTokenLimit: vi.fn(),
  assertModelAccessForRole: vi.fn(),
}));

vi.mock("@/lib/agentModelGovernance", () => ({
  assertGovernedModelSessionAccessible: vi.fn(),
}));

vi.mock("@/lib/orchestration/chatOrchestrator", () => ({
  applyFirstTurnTitleFallback: vi.fn(),
  charEstimateFromMessages: vi.fn(() => 42),
  finalizeAssistantMessage: vi.fn(),
  prepareOrchestrator,
}));

vi.mock("@/lib/db", () => ({
  db: {
    message: {
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logJson: vi.fn(),
}));

vi.mock("@/lib/sentry", () => ({
  captureError: vi.fn(),
}));

const userId = "11111111-1111-4111-8111-111111111111";
const validUuid = "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee";
const validLocal = `/uploads/${validUuid}.png`;
const productionBlobUrl =
  "https://iudfi1f90ecnygej.public.blob.vercel-storage.com/chat/cmofhx9vf00018zjke53igowg/18ee2653-7fc3-4d3d-8f24-bc9b401e0024.jpg";

describe("chat send route image validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_teststore_suffix");
    getServerSession.mockResolvedValue({
      user: { id: userId, role: "USER", teamId: null },
    });
    checkRateLimit.mockResolvedValue({ allowed: true });
    getGovernedModelsForUser.mockRejectedValue(new Error("STOP_AFTER_IMAGE_VALIDATION"));
  });

  async function post(imageUrls?: string[]) {
    const { POST } = await import("../app/api/chat/send/route");
    const req = {
      json: async () => ({
        sessionId: "session-1",
        agentId: "agent-1",
        text: "hello",
        imageUrls,
      }),
      signal: { aborted: false, addEventListener: vi.fn() },
    };
    return POST(req as any);
  }

  it("returns 400 for invalid image references before orchestration or filesystem reads", async () => {
    const res = await post(["../package.json"]);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("invalid");
    expect(prepareOrchestrator).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects mixed valid and invalid image references", async () => {
    const res = await post([validLocal, "/uploads/../../.env"]);
    expect(res.status).toBe(400);
    expect(prepareOrchestrator).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects unsupported remote schemes", async () => {
    for (const url of [
      "data:image/png;base64,abc",
      "file:///etc/passwd",
      "ftp://example.com/a.png",
      "javascript:alert(1)",
    ]) {
      const res = await post([url]);
      expect(res.status).toBe(400);
    }
    expect(prepareOrchestrator).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("rejects wrong blob host before orchestration", async () => {
    const res = await post([
      "https://evil.public.blob.vercel-storage.com/chat/user/uuid.png",
    ]);
    expect(res.status).toBe(400);
    expect(prepareOrchestrator).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });

  it("accepts the production Blob URL shape and advances past image validation", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "cmofhx9vf00018zjke53igowg", role: "USER", teamId: null },
    });

    await post([productionBlobUrl]);

    expect(getGovernedModelsForUser).toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
});
