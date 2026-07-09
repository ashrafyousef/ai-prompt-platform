import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const requireUserIdWithWorkspace = vi.fn();
const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  chatSession: {
    create: vi.fn(),
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

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    requireUserIdWithWorkspace,
  };
});

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
    teamAssignments: (overrides.teamIds ?? [teamA]).map((teamId) => ({ teamId })),
  };
}

function createdSession(overrides: { projectId?: string | null } = {}) {
  return {
    id: "session-1",
    userId,
    projectId: overrides.projectId ?? null,
    title: "New Chat",
    summary: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };
}

function makePostRequest(
  body?: Record<string, unknown> | null,
  options?: { includeContentType?: boolean }
): NextRequest {
  const hasBody = body !== undefined;
  const text = hasBody ? JSON.stringify(body) : "";
  const headers = new Headers();
  if (hasBody && options?.includeContentType !== false) {
    headers.set("Content-Type", "application/json");
  }
  return {
    headers,
    async text() {
      return text;
    },
  } as NextRequest;
}

describe("POST /api/chat/new", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUserIdWithWorkspace.mockResolvedValue({ userId, workspaceId, workspaceRole: "OWNER" });
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.chatSession.create.mockResolvedValue(createdSession());
    db.project.findFirst.mockResolvedValue(projectRow());
  });

  it("creates an unlinked chat when there is no body", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(requireWorkspaceMemberManagerContext).not.toHaveBeenCalled();
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
    expect(body.session.projectId).toBeNull();
  });

  it("creates an unlinked chat when projectId is missing", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({}));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
    expect(body.session.projectId).toBeNull();
  });

  it("treats null projectId as omitted", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId: null }));

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
  });

  it("treats empty-string projectId as omitted", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId: "" }));

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
  });

  it("treats whitespace projectId as omitted", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId: "   " }));

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
  });

  it("creates a linked chat for a valid projectId", async () => {
    db.chatSession.create.mockResolvedValue(createdSession({ projectId }));
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(requireWorkspaceMemberManagerContext).toHaveBeenCalledTimes(1);
    expect(requireUserIdWithWorkspace).not.toHaveBeenCalled();
    expect(db.project.findFirst).toHaveBeenCalledWith({
      where: { id: projectId, workspaceId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        teamAssignments: { select: { teamId: true } },
      },
    });
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: {
        userId,
        projectId,
        title: "New Chat",
      },
    });
    expect(body.session.projectId).toBe(projectId);
  });

  it("returns 404 for a nonexistent projectId", async () => {
    db.project.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId: "missing-project" }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Project not found.");
    expect(db.chatSession.create).not.toHaveBeenCalled();
  });

  it("returns 404 for a cross-workspace project", async () => {
    db.project.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId }));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Project not found.");
    expect(db.chatSession.create).not.toHaveBeenCalled();
  });

  it("returns 403 when the actor cannot view the project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(projectRow({ teamIds: [teamB] }));
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest({ projectId }));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
    expect(db.chatSession.create).not.toHaveBeenCalled();
  });

  it("keeps unlinked chat creation unchanged for non-manager users", async () => {
    const { POST } = await import("@/app/api/chat/new/route");
    const res = await POST(makePostRequest());

    expect(res.status).toBe(200);
    expect(requireUserIdWithWorkspace).toHaveBeenCalledTimes(1);
    expect(requireWorkspaceMemberManagerContext).not.toHaveBeenCalled();
    expect(db.project.findFirst).not.toHaveBeenCalled();
    expect(db.chatSession.create).toHaveBeenCalledWith({
      data: { userId, title: "New Chat" },
    });
  });
});
