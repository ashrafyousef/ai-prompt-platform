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

function sampleFields() {
  return {
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
  };
}

function sampleDocument() {
  return {
    version: 2 as const,
    fields: sampleFields(),
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
      teamAssignments: (overrides.teamIds ?? [teamA]).map((teamId) => ({
      teamId,
      team: { id: teamId, workspaceId, isArchived: false },
    })),
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
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 for missing brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 for foreign workspace brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ workspaceId: otherWorkspaceId }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for team-scoped ADMIN without visibility", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ teamIds: [teamB] }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(403);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("returns 403 and skips update when assignment Team metadata is invalid", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    const existing = briefRow({ teamIds: [teamA] });
    db.brief.findFirst.mockResolvedValue({
      ...existing,
      project: {
        ...existing.project,
        teamAssignments: [
          {
            teamId: teamA,
            team: { id: teamA, workspaceId: "ws-other", isArchived: false },
          },
        ],
      },
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    expect(res.status).toBe(403);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("returns 400 for archived project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ projectStatus: "ARCHIVED" }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
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
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
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
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
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
      responsesJson: sampleDocument(),
      updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.responsesJson.version).toBe(2);
    expect(body.brief.responsesJson.fields.objective).toBe("Launch summer campaign");
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: briefId },
        data: {
          responsesJson: expect.objectContaining({
            version: 2,
            fields: expect.objectContaining({ objective: "Launch summer campaign" }),
          }),
        },
      })
    );
  });

  it("merges raw source when patching fields only", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({
      responsesJson: {
        ...sampleDocument(),
        source: { rawText: "Client pasted brief" },
      },
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      responsesJson: {
        ...sampleDocument(),
        source: { rawText: "Client pasted brief" },
      },
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(
      request({ responsesJson: { fields: sampleFields() } }) as any,
      { params: { briefId } }
    );

    expect(res.status).toBe(200);
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          responsesJson: expect.objectContaining({
            source: { rawText: "Client pasted brief" },
          }),
        },
      })
    );
  });

  it("submits brief and sets submittedAt", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({ responsesJson: sampleDocument() });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "SUBMITTED",
      submittedAt: new Date("2026-01-04T00:00:00.000Z"),
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(
      request({ responsesJson: { fields: sampleFields() }, status: "SUBMITTED" }) as any,
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
    const existing = briefRow({ responsesJson: sampleDocument() });
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

  it("reopens SUBMITTED brief to DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const submittedAt = new Date("2026-01-04T00:00:00.000Z");
    const existing = briefRow({
      briefStatus: "SUBMITTED",
      responsesJson: sampleDocument(),
      submittedAt,
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "DRAFT",
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "DRAFT" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.status).toBe("DRAFT");
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DRAFT" },
      })
    );
  });

  it("reopens IN_REVIEW brief to DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({
      briefStatus: "IN_REVIEW",
      responsesJson: sampleDocument(),
      submittedAt: new Date("2026-01-04T00:00:00.000Z"),
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "DRAFT",
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "DRAFT" }) as any, { params: { briefId } });

    expect(res.status).toBe(200);
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DRAFT" },
      })
    );
  });

  it("rejects reopen from APPROVED", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(
      briefRow({
        briefStatus: "APPROVED",
        responsesJson: sampleDocument(),
        submittedAt: new Date("2026-01-04T00:00:00.000Z"),
      })
    );

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "DRAFT" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/cannot be reopened/i);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("approves SUBMITTED brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const submittedAt = new Date("2026-01-04T00:00:00.000Z");
    const existing = briefRow({
      briefStatus: "SUBMITTED",
      responsesJson: sampleDocument(),
      submittedAt,
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "APPROVED",
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "APPROVED" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.status).toBe("APPROVED");
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPROVED" },
      })
    );
  });

  it("approves IN_REVIEW brief", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const existing = briefRow({
      briefStatus: "IN_REVIEW",
      responsesJson: sampleDocument(),
      submittedAt: new Date("2026-01-04T00:00:00.000Z"),
    });
    db.brief.findFirst.mockResolvedValue(existing);
    db.brief.update.mockResolvedValue({
      ...existing,
      status: "APPROVED",
    });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "APPROVED" }) as any, { params: { briefId } });

    expect(res.status).toBe(200);
    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPROVED" },
      })
    );
  });

  it("rejects approve from DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(briefRow({ responsesJson: sampleDocument() }));

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "APPROVED" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/submitted before it can be approved/i);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("rejects submit from SUBMITTED", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(
      briefRow({
        briefStatus: "SUBMITTED",
        responsesJson: sampleDocument(),
        submittedAt: new Date("2026-01-04T00:00:00.000Z"),
      })
    );

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ status: "SUBMITTED" }) as any, { params: { briefId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/DRAFT status/i);
    expect(db.brief.update).not.toHaveBeenCalled();
  });

  it("preserves submittedAt when reopening and approving", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const submittedAt = new Date("2026-01-04T00:00:00.000Z");

    const submitted = briefRow({
      briefStatus: "SUBMITTED",
      responsesJson: sampleDocument(),
      submittedAt,
    });
    db.brief.findFirst.mockResolvedValue(submitted);
    db.brief.update.mockResolvedValue({ ...submitted, status: "DRAFT" });

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    await PATCH(request({ status: "DRAFT" }) as any, { params: { briefId } });

    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "DRAFT" },
      })
    );
    expect(db.brief.update.mock.calls[0][0].data.submittedAt).toBeUndefined();

    vi.clearAllMocks();
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());

    const inReview = briefRow({
      briefStatus: "IN_REVIEW",
      responsesJson: sampleDocument(),
      submittedAt,
    });
    db.brief.findFirst.mockResolvedValue(inReview);
    db.brief.update.mockResolvedValue({ ...inReview, status: "APPROVED" });

    await PATCH(request({ status: "APPROVED" }) as any, { params: { briefId } });

    expect(db.brief.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: "APPROVED" },
      })
    );
    expect(db.brief.update.mock.calls[0][0].data.submittedAt).toBeUndefined();
  });

  it("still rejects responsesJson edits outside DRAFT", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findFirst.mockResolvedValue(
      briefRow({
        briefStatus: "IN_REVIEW",
        responsesJson: sampleDocument(),
        submittedAt: new Date("2026-01-04T00:00:00.000Z"),
      })
    );

    const { PATCH } = await import("@/app/api/admin/briefs/[briefId]/route");
    const res = await PATCH(request({ responsesJson: { fields: sampleFields() } }) as any, {
      params: { briefId },
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/DRAFT status/i);
    expect(db.brief.update).not.toHaveBeenCalled();
  });
});
