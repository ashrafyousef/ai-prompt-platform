import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  project: {
    findFirst: vi.fn(),
  },
  chatSession: {
    findMany: vi.fn(),
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
const teamA = "team-a";
const teamB = "team-b";
const projectId = "project-1";
const userId = "owner-1";

function ownerContext() {
  return {
    userId,
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

function projectRow(overrides: {
  workspaceId?: string;
  teamIds?: string[];
} = {}) {
  return {
    id: projectId,
    workspaceId: overrides.workspaceId ?? workspaceId,
    status: "ACTIVE" as const,
    teamAssignments: (overrides.teamIds ?? [teamA]).map((teamId) => ({
      teamId,
      team: { id: teamId, workspaceId, isArchived: false },
    })),
  };
}

function sessionRow(overrides: {
  id?: string;
  title?: string;
  updatedAt?: Date;
  summary?: string | null;
} = {}) {
  return {
    id: overrides.id ?? "session-1",
    title: overrides.title ?? "Campaign brainstorm",
    updatedAt: overrides.updatedAt ?? new Date("2026-01-03T00:00:00.000Z"),
    summary: overrides.summary ?? "Latest notes",
  };
}

describe("GET /api/admin/projects/[projectId]/chats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(projectRow());
    db.chatSession.findMany.mockResolvedValue([
      sessionRow({ id: "session-new", updatedAt: new Date("2026-01-04T00:00:00.000Z") }),
      sessionRow({ id: "session-old", updatedAt: new Date("2026-01-02T00:00:00.000Z") }),
    ]);
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    expect(res.status).toBe(401);
  });

  it("denies non-manager access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    expect(res.status).toBe(403);
  });

  it("returns 404 for a missing project", async () => {
    db.project.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Project not found.");
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("returns 404 for a cross-workspace project", async () => {
    db.project.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Project not found.");
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor cannot view the project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(projectRow({ teamIds: [teamB] }));
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 and skips chat list when assignment Team metadata is invalid", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue({
      ...projectRow({ teamIds: [teamA] }),
      teamAssignments: [
        {
          teamId: teamA,
          team: { id: teamA, workspaceId, isArchived: true },
        },
      ],
    });
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });

    expect(res.status).toBe(403);
    expect(db.chatSession.findMany).not.toHaveBeenCalled();
  });

  it("queries only the current user's sessions for the requested project", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    await GET({} as any, { params: { projectId } });

    expect(db.chatSession.findMany).toHaveBeenCalledWith({
      where: {
        projectId,
        userId,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        summary: true,
      },
    });
  });

  it("excludes another user's chat linked to the same project via userId filtering", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    await GET({} as any, { params: { projectId } });

    const call = db.chatSession.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe(userId);
    expect(call.where.userId).not.toBe("other-user");
  });

  it("excludes unlinked chats via projectId filtering", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    await GET({} as any, { params: { projectId } });

    const call = db.chatSession.findMany.mock.calls[0][0];
    expect(call.where.projectId).toBe(projectId);
  });

  it("excludes chats linked to another project via projectId filtering", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    await GET({} as any, { params: { projectId: "other-project" } });

    const call = db.chatSession.findMany.mock.calls[0][0];
    expect(call.where.projectId).toBe("other-project");
    expect(call.where.projectId).not.toBe(projectId);
  });

  it("orders sessions by updatedAt desc", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    await GET({} as any, { params: { projectId } });

    const call = db.chatSession.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ updatedAt: "desc" });
  });

  it("returns lightweight session fields under sessions", async () => {
    const { GET } = await import("@/app/api/admin/projects/[projectId]/chats/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessions).toEqual([
      {
        id: "session-new",
        title: "Campaign brainstorm",
        updatedAt: new Date("2026-01-04T00:00:00.000Z"),
        summary: "Latest notes",
      },
      {
        id: "session-old",
        title: "Campaign brainstorm",
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        summary: "Latest notes",
      },
    ]);
    expect(body.sessions[0]).not.toHaveProperty("userId");
    expect(body.sessions[0]).not.toHaveProperty("projectId");
    expect(body.sessions[0]).not.toHaveProperty("messages");
    expect(body.sessions[0]).not.toHaveProperty("shares");
  });
});
