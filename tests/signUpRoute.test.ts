import { beforeEach, describe, expect, it, vi } from "vitest";

const checkRateLimit = vi.fn();
const allowInitialSignUp = vi.fn();
const hashPassword = vi.fn();

const tx = {
  user: { create: vi.fn() },
  workspace: { create: vi.fn() },
  workspaceMember: { create: vi.fn() },
};

const db = {
  user: { findUnique: vi.fn() },
  $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
};

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

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit,
}));

vi.mock("@/lib/authBootstrap", () => ({
  allowInitialSignUp,
}));

vi.mock("@/lib/password", () => ({
  hashPassword,
}));

vi.mock("@/lib/db", () => ({
  db,
}));

function signUpRequest(body: Record<string, string>) {
  return new Request("http://localhost/api/auth/sign-up", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/sign-up platform role", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true, retryAfterSec: 0 });
    allowInitialSignUp.mockResolvedValue(true);
    hashPassword.mockResolvedValue("hashed-password");
    db.user.findUnique.mockResolvedValue(null);
    tx.user.create.mockResolvedValue({ id: "user-1" });
    tx.workspace.create.mockResolvedValue({ id: "ws-1" });
    tx.workspaceMember.create.mockResolvedValue({ id: "member-1" });
  });

  it("creates workspace OWNER membership without elevating platform role to ADMIN", async () => {
    const { POST } = await import("@/app/api/auth/sign-up/route");

    const res = await POST(
      signUpRequest({
        email: "owner@example.com",
        password: "password123",
        name: "Owner User",
        workspaceName: "Acme Workspace",
      }) as never
    );

    expect(res.status).toBe(200);
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        email: "owner@example.com",
        name: "Owner User",
        passwordHash: "hashed-password",
      },
    });
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        workspaceId: "ws-1",
        role: "OWNER",
      },
    });
  });
});
