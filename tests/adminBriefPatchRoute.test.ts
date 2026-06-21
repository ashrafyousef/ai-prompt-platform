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

function request(body: Record<string, unknown>) {
  return {
    method: "PATCH",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
  };
}

function sampleResponses() {
  return {
    version: 1 as const,
    fields: {
      objective: "Launch summer campaign",
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
  };
}

function briefRow(overrides: {
  workspaceId?: string;
  projectStatus?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  briefStatus?: "DRAFT" | "SUBMITTED" | "IN_REVIEW" | "APPROVED" | "ARCHIVED";
  teamIds?: string[];
  responsesJson?: unknown;
  submittedAt?: Date | null;
} = {}) {
  return {
    id: briefId,
    projectId,
    title: "Brief",
    status: overrides.briefStatus ?? "DRAFT",
    responsesJson: overrides.responsesJson ?? null,
    submittedAt: overrides.submittedAt ?? null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    project: {
      id: projectId,
      workspaceId: overrides.workspaceId ?? workspaceId,
      status: overrides.projectStatus ?? "ACTIVE",
      teamAssignments: (overrides.teamIds ?? [teamA]).map((teamId) => ({ teamId })),
    },
  };
}

describe("admin brief PATCH route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for missing brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for foreign workspace brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ workspaceId: otherWorkspaceId }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for team-scoped ADMIN without visibility", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ teamIds: [teamB] }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for archived project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ projectStatus: "ARCHIVED" }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/archived project/i);
  });

  it("returns 400 for archived brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ briefStatus: "ARCHIVED" }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/archived brief/i);
  });

  it("returns 400 when editing responses outside DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ briefStatus: "SUBMITTED" }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: sampleResponses() }) as any, {
      params: { briefId },
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/DRAFT status/i);
  });

  it("saves draft responses for OWNER", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow();
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      responsesJson: sampleResponses(),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const responsesJson = sampleResponses();
    const res = await PATCH(request({ responsesJson }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.responsesJson.fields.objective).toBe("Launch summer campaign");
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: briefId },
        data: { responsesJson },
      })
    );
  });

  it("submits brief and sets submittedAt", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({ responsesJson: sampleResponses() });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "SUBMITTED",
      submittedAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(
      request({ responsesJson: sampleResponses(), status: "SUBMITTED" }) as any,
      { params: { briefId } }
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.status).toBe("SUBMITTED");
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
          submittedAt: expect.any(Date),
        }),
      })
    );
  });

  it("rejects submit without saved responses", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ responsesJson: null }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "SUBMITTED" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/at least one intake field/i);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("allows submit with existing saved responses only", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({ responsesJson: sampleResponses() });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "SUBMITTED",
      submittedAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "SUBMITTED" }) as any, { params: { briefId } });

    expect(res.status).toBe(200);
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SUBMITTED" }),
      })
    );
  });
});
