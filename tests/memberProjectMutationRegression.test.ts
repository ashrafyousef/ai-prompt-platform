import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  project: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  brief: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  strategy: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  chatSession: { findMany: vi.fn(), create: vi.fn() },
  team: { findMany: vi.fn() },
  $transaction: vi.fn(),
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

vi.mock("@/lib/db", () => ({ db }));

vi.mock("@/lib/adminAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/adminAuth")>();
  return {
    ...actual,
    requireWorkspaceMemberManagerContext,
  };
});

/**
 * Matching-team MEMBER may read via /api/projects but must still fail manager gates.
 */
describe("MEMBER mutation regression (manager-only project APIs)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
  });

  it("denies MEMBER project creation", async () => {
    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST({
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      nextUrl: new URL("http://localhost/api/admin/projects"),
      json: async () => ({ name: "X", teamIds: ["team-a"] }),
    } as any);
    expect(res.status).toBe(403);
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it("denies MEMBER project assignment PATCH", async () => {
    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(
      {
        method: "PATCH",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ teamIds: ["team-a"] }),
      } as any,
      { params: { projectId: "project-1" } }
    );
    expect(res.status).toBe(403);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("denies MEMBER brief list/create paths", async () => {
    const { GET, POST } = await import("@/app/api/admin/briefs/route");
    const getRes = await GET({
      nextUrl: new URL("http://localhost/api/admin/briefs"),
    } as any);
    const postRes = await POST({
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      nextUrl: new URL("http://localhost/api/admin/briefs"),
      json: async () => ({ projectId: "project-1", title: "Brief" }),
    } as any);
    expect(getRes.status).toBe(403);
    expect(postRes.status).toBe(403);
    expect(db.brief.create).not.toHaveBeenCalled();
  });

  it("denies MEMBER brief PATCH", async () => {
    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(
      {
        method: "PATCH",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ status: "SUBMITTED" }),
      } as any,
      { params: { briefId: "brief-1" } }
    );
    expect(res.status).toBe(403);
    expect(db.brief.findFirst).not.toHaveBeenCalled();
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("denies MEMBER brief analysis", async () => {
    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(
      {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ rawText: "Analyze this brief" }),
      } as any,
      { params: { briefId: "brief-1" } }
    );
    expect(res.status).toBe(403);
    expect(db.brief.findFirst).not.toHaveBeenCalled();
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("denies MEMBER strategy mutation paths", async () => {
    const projectStrategy = await import(
      "@/app/api/admin/projects/[projectId]/strategy/route"
    );
    const strategyById = await import("@/app/api/admin/strategies/[strategyId]/route");

    const getRes = await projectStrategy.GET({} as any, {
      params: { projectId: "project-1" },
    });
    const postRes = await projectStrategy.POST(
      {
        method: "POST",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ title: "Strategy" }),
      } as any,
      { params: { projectId: "project-1" } }
    );
    const patchRes = await strategyById.PATCH(
      {
        method: "PATCH",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => ({ title: "Updated" }),
      } as any,
      { params: { strategyId: "strategy-1" } }
    );

    expect(getRes.status).toBe(403);
    expect(postRes.status).toBe(403);
    expect(patchRes.status).toBe(403);
    expect(db.strategy.create).not.toHaveBeenCalled();
    expect(db.strategy.update).not.toHaveBeenCalled();
  });

  it("denies MEMBER project chat list", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId: "project-1" } });
    expect(res.status).toBe(403);
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("denies MEMBER project-linked chat creation via POST /api/chat/new", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST({
      method: "POST",
      headers: new Headers({ "Content-Type": "application/json" }),
      text: async () => JSON.stringify({ projectId: "project-1" }),
    } as any);
    expect(res.status).toBe(403);
    expect(db.chatSession.create).not.toHaveBeenCalled();
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });

  it("denies MEMBER admin project detail GET (brief/strategy payload)", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId: "project-1" } });
    expect(res.status).toBe(403);
    expect(db.project.findFirst).not.toHaveBeenCalled();
  });
});
