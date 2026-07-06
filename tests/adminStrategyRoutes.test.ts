import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  strategy: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findFirst: vi.fn(),
  },
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
  return { ...actual, requireWorkspaceMemberManagerContext };
});

const workspaceId = "ws-1";
const projectId = "project-1";

function ownerContext() {
  return {
    userId: "owner-1",
    workspaceId,
    workspaceRole: "OWNER" as const,
    platformRole: "USER" as const,
    teamId: null,
  };
}

function approvedBriefProject(overrides: Partial<{ briefStatus: string; projectStatus: string }> = {}) {
  return {
    id: projectId,
    workspaceId,
    status: overrides.projectStatus ?? "ACTIVE",
    teamAssignments: [],
    brief: { id: "brief-1", status: overrides.briefStatus ?? "APPROVED", responsesJson: null },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
});

describe("POST /api/admin/projects/[projectId]/strategy", () => {
  it("rejects creation when the brief is not approved", async () => {
    db.project.findFirst.mockResolvedValue(approvedBriefProject({ briefStatus: "SUBMITTED" }));
    const { POST } = await import("@/app/api/admin/projects/[projectId]/strategy/route");
    const res = await POST(new Request("http://x"), { params: { projectId } });
    expect(res.status).toBe(400);
  });

  it("rejects creation when a strategy already exists", async () => {
    db.project.findFirst.mockResolvedValue(approvedBriefProject());
    db.strategy.findUnique.mockResolvedValue({ id: "strategy-1" });
    const { POST } = await import("@/app/api/admin/projects/[projectId]/strategy/route");
    const res = await POST(new Request("http://x"), { params: { projectId } });
    expect(res.status).toBe(409);
  });

  it("creates a DRAFT strategy with sourceBriefId derived from the project's brief, ignoring any client input", async () => {
    db.project.findFirst.mockResolvedValue(approvedBriefProject());
    db.strategy.findUnique.mockResolvedValue(null);
    db.strategy.create.mockResolvedValue({
      id: "strategy-1",
      projectId,
      sourceBriefId: "brief-1",
      status: "DRAFT",
      responsesJson: null,
      readyAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const { POST } = await import("@/app/api/admin/projects/[projectId]/strategy/route");
    const res = await POST(new Request("http://x"), { params: { projectId } });
    expect(res.status).toBe(200);
    expect(db.strategy.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ sourceBriefId: "brief-1", projectId, status: "DRAFT" }),
      })
    );
  });
});

describe("PATCH /api/admin/strategies/[strategyId]", () => {
  function strategyRecord(overrides: Partial<{ status: string; projectStatus: string }> = {}) {
    return {
      id: "strategy-1",
      projectId,
      sourceBriefId: "brief-1",
      status: overrides.status ?? "DRAFT",
      responsesJson: null,
      readyAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      project: { id: projectId, workspaceId, status: overrides.projectStatus ?? "ACTIVE", teamAssignments: [] },
    };
  }

  function patchRequest(body: Record<string, unknown>) {
    return new Request("http://x", { method: "PATCH", body: JSON.stringify(body) }) as any;
  }

  it("rejects marking ready when no field has content", async () => {
    db.strategy.findFirst.mockResolvedValue(strategyRecord());
    const { PATCH } = await import("@/app/api/admin/strategies/[strategyId]/route");
    const res = await PATCH(patchRequest({ status: "READY_FOR_CREATIVE" }), {
      params: { strategyId: "strategy-1" },
    });
    expect(res.status).toBe(400);
  });

  it("rejects edits when strategy is no longer DRAFT (via canEditStrategyResponses, not schema validation)", async () => {
    db.strategy.findFirst.mockResolvedValue(strategyRecord({ status: "READY_FOR_CREATIVE" }));
    const { PATCH } = await import("@/app/api/admin/strategies/[strategyId]/route");
    const res = await PATCH(
      patchRequest({ responsesJson: { fields: { strategicSummary: "x" } } }),
      { params: { strategyId: "strategy-1" } }
    );
    const payload = await res.json();
    expect(res.status).toBe(400);
    expect(payload.error).toBe("This strategy is no longer editable.");
  });

  it("saves a partial draft field while DRAFT (happy path)", async () => {
    db.strategy.findFirst.mockResolvedValue(strategyRecord());
    db.strategy.update.mockResolvedValue({
      ...strategyRecord(),
      responsesJson: { version: 1, fields: { strategicSummary: "Updated summary" } },
    });
    const { PATCH } = await import("@/app/api/admin/strategies/[strategyId]/route");
    const res = await PATCH(
      patchRequest({ responsesJson: { fields: { strategicSummary: "Updated summary" } } }),
      { params: { strategyId: "strategy-1" } }
    );
    expect(res.status).toBe(200);
    expect(db.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsesJson: expect.objectContaining({
            fields: expect.objectContaining({ strategicSummary: "Updated summary" }),
          }),
        }),
      })
    );
  });

  it("marks READY_FOR_CREATIVE and sets readyAt when content exists (happy path)", async () => {
    db.strategy.findFirst.mockResolvedValue({
      ...strategyRecord(),
      responsesJson: { version: 1, fields: { strategicSummary: "Has content" } },
    });
    db.strategy.update.mockResolvedValue({
      ...strategyRecord({ status: "READY_FOR_CREATIVE" }),
      readyAt: new Date(),
    });
    const { PATCH } = await import("@/app/api/admin/strategies/[strategyId]/route");
    const res = await PATCH(patchRequest({ status: "READY_FOR_CREATIVE" }), {
      params: { strategyId: "strategy-1" },
    });
    expect(res.status).toBe(200);
    expect(db.strategy.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "READY_FOR_CREATIVE", readyAt: expect.any(Date) }),
      })
    );
  });
});
