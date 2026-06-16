import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  client: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  project: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
  },
  projectTeamAssignment: {
    createMany: vi.fn(),
  },
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

const workspaceId = "ws-1";
const otherWorkspaceId = "ws-2";
const teamA = "team-a";
const teamB = "team-b";
const clientId = "client-1";

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

function workspaceSlugP2002() {
  return new PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "5.17.0",
    meta: { target: ["workspaceId", "slug"] },
  });
}

describe("admin clients route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/admin/clients/route");
    const res = await GET(request("http://localhost/api/admin/clients") as any);
    expect(res.status).toBe(401);
  });

  it("denies MEMBER access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/admin/clients/route");
    const res = await GET(request("http://localhost/api/admin/clients") as any);
    expect(res.status).toBe(403);
  });

  it("lists workspace-scoped clients for OWNER", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.client.findMany.mockResolvedValue([
      {
        id: clientId,
        name: "ABK",
        slug: "abk",
        isArchived: false,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        _count: { projects: 1 },
      },
    ]);

    const { GET } = await import("@/app/api/admin/clients/route");
    const res = await GET(request("http://localhost/api/admin/clients") as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.clients).toHaveLength(1);
    expect(db.client.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId, isArchived: false },
      })
    );
  });

  it("rejects duplicate client slug on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.client.findUnique.mockResolvedValue({ id: "existing-client" });

    const { POST } = await import("@/app/api/admin/clients/route");
    const res = await POST(
      request("http://localhost/api/admin/clients", { name: "ABK", slug: "abk" }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/slug already exists/i);
  });

  it("creates a client in the current workspace", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.client.findUnique.mockResolvedValue(null);
    db.client.create.mockResolvedValue({
      id: clientId,
      name: "ABK",
      slug: "abk",
      isArchived: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      _count: { projects: 0 },
    });

    const { POST } = await import("@/app/api/admin/clients/route");
    const res = await POST(
      request("http://localhost/api/admin/clients", { name: "ABK", slug: "abk" }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.client.slug).toBe("abk");
    expect(db.client.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          workspaceId,
          name: "ABK",
          slug: "abk",
        },
      })
    );
  });

  it("maps Prisma P2002 workspace slug violation to 409 on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.client.findUnique.mockResolvedValue(null);
    db.client.create.mockRejectedValue(workspaceSlugP2002());

    const { POST } = await import("@/app/api/admin/clients/route");
    const res = await POST(
      request("http://localhost/api/admin/clients", { name: "ABK", slug: "abk" }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/slug already exists/i);
  });
});

describe("admin projects route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/admin/projects/route");
    const res = await GET(request("http://localhost/api/admin/projects") as any);
    expect(res.status).toBe(401);
  });

  it("denies MEMBER access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/admin/projects/route");
    const res = await GET(request("http://localhost/api/admin/projects") as any);
    expect(res.status).toBe(403);
  });

  it("lists all workspace projects for OWNER", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/projects/route");
    const res = await GET(request("http://localhost/api/admin/projects") as any);

    expect(res.status).toBe(200);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId,
          status: { not: "ARCHIVED" },
        }),
      })
    );
  });

  it("filters projects for team-scoped ADMIN", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/admin/projects/route");
    const res = await GET(request("http://localhost/api/admin/projects") as any);

    expect(res.status).toBe(200);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId,
          teamAssignments: { some: { teamId: teamA } },
        }),
      })
    );
  });

  it("rejects duplicate project slug on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findUnique.mockResolvedValue({ id: "existing-project" });

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/slug already exists/i);
  });

  it("rejects client from another workspace on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findUnique.mockResolvedValue(null);
    db.client.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
        clientId: "foreign-client",
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/client not found/i);
    expect(db.client.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: "foreign-client",
          workspaceId,
          isArchived: false,
        },
      })
    );
  });

  it("rejects team from another workspace on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findUnique.mockResolvedValue(null);
    db.team.findMany.mockResolvedValue([]);

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
        teamIds: [teamB],
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/teams were not found/i);
    expect(db.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [teamB] },
          workspaceId,
          isArchived: false,
        },
      })
    );
  });

  it("creates project team assignments on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findUnique.mockResolvedValue(null);
    db.team.findMany.mockResolvedValue([{ id: teamA }, { id: teamB }]);

    const createdProject = {
      id: "project-1",
      name: "Campaign",
      slug: "campaign",
      status: "DRAFT",
      clientId: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      client: null,
      teamAssignments: [
        { team: { id: teamA, name: "Team A", slug: "team-a" } },
        { team: { id: teamB, name: "Team B", slug: "team-b" } },
      ],
    };

    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        project: {
          create: vi.fn().mockResolvedValue({ id: "project-1" }),
          findUniqueOrThrow: vi.fn().mockResolvedValue(createdProject),
        },
        projectTeamAssignment: {
          createMany: vi.fn().mockResolvedValue({ count: 2 }),
        },
      };
      return callback(tx as unknown as typeof db);
    });

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
        teamIds: [teamA, teamB],
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.teams).toHaveLength(2);
    expect(db.$transaction).toHaveBeenCalled();
  });

  it("auto-assigns team-scoped ADMIN team when teamIds omitted on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findUnique.mockResolvedValue(null);
    db.team.findMany.mockResolvedValue([{ id: teamA }]);

    const assignmentCreateMany = vi.fn().mockResolvedValue({ count: 1 });
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        project: {
          create: vi.fn().mockResolvedValue({ id: "project-team-admin" }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "project-team-admin",
            name: "Campaign",
            slug: "campaign",
            status: "DRAFT",
            clientId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            client: null,
            teamAssignments: [{ team: { id: teamA, name: "Team A", slug: "team-a" } }],
          }),
        },
        projectTeamAssignment: { createMany: assignmentCreateMany },
      };
      return callback(tx as unknown as typeof db);
    });

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
      }) as any
    );

    expect(res.status).toBe(200);
    expect(db.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [teamA] }, workspaceId, isArchived: false },
      })
    );
    expect(assignmentCreateMany).toHaveBeenCalledWith({
      data: [{ projectId: "project-team-admin", teamId: teamA }],
    });
  });

  it("returns 403 when team-scoped ADMIN assigns foreign team on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
        teamIds: [teamB],
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/own team/i);
    expect(db.team.findMany).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("maps Prisma P2002 workspace slug violation to 409 on POST", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findUnique.mockResolvedValue(null);
    db.$transaction.mockRejectedValue(workspaceSlugP2002());

    const { POST } = await import("@/app/api/admin/projects/route");
    const res = await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
      }) as any
    );
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toMatch(/slug already exists/i);
  });

  it("scopes project create to current workspace", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      ...ownerContext(),
      workspaceId: otherWorkspaceId,
    });
    db.project.findUnique.mockResolvedValue(null);
    db.team.findMany.mockResolvedValue([{ id: teamA }]);
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        project: {
          create: vi.fn().mockResolvedValue({ id: "project-2" }),
          findUniqueOrThrow: vi.fn().mockResolvedValue({
            id: "project-2",
            name: "Campaign",
            slug: "campaign",
            status: "DRAFT",
            clientId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            client: null,
            teamAssignments: [],
          }),
        },
        projectTeamAssignment: { createMany: vi.fn() },
      };
      return callback(tx as unknown as typeof db);
    });

    const { POST } = await import("@/app/api/admin/projects/route");
    await POST(
      request("http://localhost/api/admin/projects", {
        name: "Campaign",
        slug: "campaign",
        teamIds: [teamA],
      }) as any
    );

    const txArg = db.$transaction.mock.calls[0][0];
    const tx = {
      project: { create: vi.fn().mockResolvedValue({ id: "project-2" }), findUniqueOrThrow: vi.fn() },
      projectTeamAssignment: { createMany: vi.fn() },
    };
    await txArg(tx);
    expect(tx.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ workspaceId: otherWorkspaceId }),
      })
    );
  });
});
