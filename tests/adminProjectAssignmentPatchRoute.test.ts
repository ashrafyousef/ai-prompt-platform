import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
  project: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
  },
  projectTeamAssignment: {
    deleteMany: vi.fn(),
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

function request(body: Record<string, unknown>) {
  return {
    method: "PATCH",
    headers: new Headers({ "Content-Type": "application/json" }),
    json: async () => body,
  };
}

function existingProject(overrides: { teamIds?: string[]; workspaceId?: string } = {}) {
  const teamIds = overrides.teamIds ?? [teamA];
  return {
    id: projectId,
    workspaceId: overrides.workspaceId ?? workspaceId,
    status: "ACTIVE" as const,
    teamAssignments: teamIds.map((teamId) => ({
      teamId,
      team: { id: teamId, workspaceId, isArchived: false },
    })),
  };
}

function serializedAfterUpdate(teamIds: string[]) {
  return {
    id: projectId,
    name: "Summer Campaign",
    slug: "summer-campaign",
    status: "ACTIVE",
    clientId: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    client: null,
    teamAssignments: teamIds.map((teamId) => ({
      team: { id: teamId, name: teamId, slug: teamId },
    })),
  };
}

describe("PATCH /api/admin/projects/[projectId] team assignments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access with 401", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamA] }) as any, { params: { projectId } });
    expect(res.status).toBe(401);
  });

  it("denies MEMBER access with 403", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamA] }) as any, { params: { projectId } });
    expect(res.status).toBe(403);
  });

  it("returns 400 for invalid body", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: "not-an-array" }) as any, { params: { projectId } });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);
  });

  it("returns 400 for malformed JSON body", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(
      {
        method: "PATCH",
        headers: new Headers({ "Content-Type": "application/json" }),
        json: async () => {
          throw new SyntaxError("Unexpected token in JSON");
        },
      } as any,
      { params: { projectId } }
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid project assignment input.");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("replaces assignments for OWNER including clearing all teams", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(existingProject({ teamIds: [teamA, teamB] }));

    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const update = vi.fn().mockResolvedValue({ id: projectId });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(serializedAfterUpdate([]));

    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        projectTeamAssignment: { deleteMany, createMany },
        project: { update, findUniqueOrThrow },
      };
      return callback(tx as unknown as typeof db);
    });

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [] }) as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.teams).toEqual([]);
    expect(deleteMany).toHaveBeenCalledWith({ where: { projectId } });
    expect(createMany).not.toHaveBeenCalled();
  });

  it("rejects archived or cross-workspace teams with 400 and no mutation", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(existingProject());
    db.team.findMany.mockResolvedValue([{ id: teamA }]);

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamA, teamB] }) as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/teams were not found/i);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("auto-assigns own team for team-scoped ADMIN when teamIds empty", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(existingProject({ teamIds: [teamA] }));
    db.team.findMany.mockResolvedValue([{ id: teamA }]);

    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const update = vi.fn().mockResolvedValue({ id: projectId });
    const findUniqueOrThrow = vi.fn().mockResolvedValue(serializedAfterUpdate([teamA]));

    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
      const tx = {
        projectTeamAssignment: { deleteMany, createMany },
        project: { update, findUniqueOrThrow },
      };
      return callback(tx as unknown as typeof db);
    });

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [] }) as any, { params: { projectId } });

    expect(res.status).toBe(200);
    expect(createMany).toHaveBeenCalledWith({
      data: [{ projectId, teamId: teamA }],
    });
  });

  it("returns 403 when team-scoped ADMIN assigns a foreign team", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamB] }) as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/own team/i);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("returns 404 for missing project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamA] }) as any, { params: { projectId } });
    expect(res.status).toBe(404);
  });

  it("returns sanitized 500 on unexpected transaction failure", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(existingProject());
    db.team.findMany.mockResolvedValue([{ id: teamA }]);
    db.$transaction.mockRejectedValue(new Error("Prisma P2028: connection exploded xyz"));

    const { PATCH } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await PATCH(request({ teamIds: [teamA] }) as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Internal server error");
    expect(JSON.stringify(body)).not.toMatch(/Prisma|exploded|P2028/i);
  });
});
