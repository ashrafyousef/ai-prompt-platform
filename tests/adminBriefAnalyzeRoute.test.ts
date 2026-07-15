import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  brief: {
    findFirst: vi.fn(),
    update: vi.fn(),
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
  return {
    ...actual,
    requireWorkspaceMemberManagerContext,
  };
});

const workspaceId = "ws-1";
const otherWorkspaceId = "ws-2";
const teamA = "team-a";
const teamB = "team-b";
const projectId = "project-1";
const briefId = "brief-1";

function ownerContext() {
  return {
    userId: "owner-1",
    workspaceId,
    workspaceRole: "OWNER" as const,
    platformRole: "USER" as const,
    teamId: null,
  };
}

function teamAdminContext() {
  return {
    userId: "admin-1",
    workspaceId,
    workspaceRole: "ADMIN" as const,
    platformRole: "USER" as const,
    teamId: teamA,
  };
}

function request(body: Record<string, unknown> = {}) {
  return {
    method: "POST",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
  };
}

function sampleDocument() {
  return {
    version: 2 as const,
    fields: {
      objective: "",
      clientBackground: "",
      campaignType: "",
      targetAudience: "",
      keyMessage: "",
      deliverables: "",
      channels: "",
      timeline: "",
      brandRestrictions: "",
      mandatoryContent: "",
      referenceNotes: "",
      openQuestions: "",
    },
    source: {
      rawText: "Objective: Launch a summer campaign\nTarget audience: Young adults",
      savedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

function briefRow(overrides: {
  workspaceId?: string;
  projectStatus?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  briefStatus?: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
  teamIds?: string[];
  responsesJson?: unknown;
} = {}) {
  return {
    id: briefId,
    projectId,
    title: "Brief",
    status: overrides.briefStatus ?? "DRAFT",
    responsesJson: overrides.responsesJson ?? sampleDocument(),
    submittedAt: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    project: {
      id: projectId,
      workspaceId: overrides.workspaceId ?? workspaceId,
      status: overrides.projectStatus ?? "ACTIVE",
      teamAssignments: (overrides.teamIds ?? [teamA]).map((teamId) => ({
      teamId,
      team: { id: teamId, workspaceId, isArchived: false },
    })),
    },
  };
}

describe("admin brief analyze route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    expect(res.status).toBe(401);
  });

  it("returns 404 for missing brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    expect(res.status).toBe(404);
  });

  it("returns 403 for team-scoped ADMIN without visibility", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ teamIds: [teamB] }));

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    expect(res.status).toBe(403);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("returns 403 and skips analysis when assignment Team metadata is missing", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    const existing = briefRow({ teamIds: [teamA] });
    db.brief.findFirst.mockResolvedValue({
      ...existing,
      project: {
        ...existing.project,
        teamAssignments: [{ teamId: teamA, team: null }],
      },
    });

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    expect(res.status).toBe(403);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("returns 400 when brief is not DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ briefStatus: "SUBMITTED" }));

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/DRAFT status/i);
  });

  it("returns 400 when no raw brief is available", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(
      briefRow({
        responsesJson: {
          version: 2,
          fields: sampleDocument().fields,
        },
      })
    );

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/save a raw client brief/i);
  });

  it("persists analysis without mutating saved fields", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({
      responsesJson: {
        ...sampleDocument(),
        fields: {
          ...sampleDocument().fields,
          objective: "Existing master objective",
        },
      },
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockImplementation(async ({ data }) => ({
      ...existing,
      responsesJson: data.responsesJson,
    }));

    const { POST } = await import("@/app/api/admin/briefs/[briefId]/analyze/route");
    const res = await POST(request() as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.issues.length).toBeGreaterThan(0);
    expect(body.proposedFields.objective).toBeTruthy();
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          responsesJson: expect.objectContaining({
            fields: expect.objectContaining({
              objective: "Existing master objective",
            }),
            analysis: expect.objectContaining({
              mode: "deterministic",
            }),
          }),
        }),
      })
    );
  });
});
