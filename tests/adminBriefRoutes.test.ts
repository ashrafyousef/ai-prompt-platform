import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  brief: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
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

function request(url: string, body?: Record<string, unknown>) {
  const nextUrl = new URL(url);
  return {
    method: body ? "POST" : "GET",
    headers: body ? new Headers({ "Content-Type": "application/json" }) : new Headers(),
    nextUrl,
    json: async () => body,
  };
}

function activeProject(overrides: Partial<{ id: string; workspaceId: string; teamIds: string[] }> = {}) {
  const id = overrides.id ?? projectId;
  const wsId = overrides.workspaceId ?? workspaceId;
  const teamIds = overrides.teamIds ?? [teamA];
  return {
    id,
    workspaceId: wsId,
    status: "ACTIVE" as const,
    teamAssignments: teamIds.map((teamId) => ({ teamId })),
  };
}

function briefProjectIdP2002() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.17.0",
    meta: { target: ["projectId"] },
  });
}

describe("admin briefs route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated GET", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/admin/briefs/route");
    const res = await GET(request("http://localhost/api/admin/briefs") as any);
    expect(res.status).toBe(401);
  });

  it("denies forbidden GET for MEMBER", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/admin/briefs/route");
    const res = await GET(request("http://localhost/api/admin/briefs") as any);
    expect(res.status).toBe(403);
  });

  it("lists briefs for OWNER with archived excluded by default", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findMany.mockResolvedValue([
      {
        id: "brief-1",
        projectId,
        title: "Brief",
        status: "DRAFT",
        responsesJson: { version: 1, fields: { objective: "hidden" } },
        submittedAt: null,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        project: {
          id: projectId,
          name: "Campaign",
          slug: "campaign",
          status: "ACTIVE",
          workspaceId,
          client: null,
          teamAssignments: [{ teamId: teamA }],
        },
      },
    ]);

    const { GET } = await import("@/app/api/admin/briefs/route");
    const res = await GET(request("http://localhost/api/admin/briefs") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.briefs[0]).not.toHaveProperty("responsesJson");
    expect(db.brief.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { workspaceId },
          status: { not: "ARCHIVED" },
        }),
      })
    );
  });

  it("includes archived briefs when includeArchived=true", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/briefs/route");
    const res = await GET(
      request("http://localhost/api/admin/briefs?includeArchived=true") as any
    );

    expect(res.status).toBe(200);
    expect(db.brief.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          project: { workspaceId },
        },
      })
    );
  });

  it("filters GET by projectId within workspace", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.brief.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/briefs/route");
    await GET(request(`http://localhost/api/admin/briefs?projectId=${projectId}`) as any);

    expect(db.brief.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: { workspaceId, id: projectId },
        }),
      })
    );
  });

  it("scopes team-scoped ADMIN GET to assigned projects", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.brief.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/briefs/route");
    await GET(request("http://localhost/api/admin/briefs") as any);

    expect(db.brief.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          project: {
            workspaceId,
            teamAssignments: { some: { teamId: teamA } },
          },
        }),
      })
    );
  });

  it("creates brief for OWNER on visible project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(activeProject());
    db.brief.findUnique.mockResolvedValue(null);
    db.brief.create.mockResolvedValue({
      id: "brief-1",
      projectId,
      title: "Brief",
      status: "DRAFT",
      responsesJson: null,
      submittedAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      project: {
        id: projectId,
        name: "Campaign",
        slug: "campaign",
        status: "ACTIVE",
        workspaceId,
        client: null,
        teamAssignments: [{ teamId: teamA }],
      },
    });

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.brief.projectId).toBe(projectId);
    expect(db.brief.create).toHaveBeenCalled();
  });

  it("rejects foreign workspace project on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId: "foreign-project" }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/project not found/i);
  });

  it("rejects archived project on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue({
      ...activeProject(),
      status: "ARCHIVED",
    });

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/archived project/i);
  });

  it("returns 403 when team-scoped ADMIN cannot view project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(activeProject({ teamIds: [teamB] }));

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );

    expect(res.status).toBe(403);
    expect(db.brief.create).not.toHaveBeenCalled();
  });

  it("allows team-scoped ADMIN to create on assigned project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(activeProject({ teamIds: [teamA] }));
    db.brief.findUnique.mockResolvedValue(null);
    db.brief.create.mockResolvedValue({
      id: "brief-2",
      projectId,
      title: "Brief",
      status: "DRAFT",
      responsesJson: null,
      submittedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      project: {
        id: projectId,
        name: "Campaign",
        slug: "campaign",
        status: "ACTIVE",
        workspaceId,
        client: null,
        teamAssignments: [{ teamId: teamA }],
      },
    });

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );

    expect(res.status).toBe(200);
  });

  it("rejects duplicate brief per project with 409", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(activeProject());
    db.brief.findUnique.mockResolvedValue({ id: "existing-brief" });

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
  });

  it("maps Prisma projectId unique violation to 409", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(activeProject());
    db.brief.findUnique.mockResolvedValue(null);
    db.brief.create.mockRejectedValue(briefProjectIdP2002());

    const { POST } = await import("@/app/api/admin/briefs/route");
    const res = await POST(
      request("http://localhost/api/admin/briefs", { projectId }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/already exists/i);
  });
});
