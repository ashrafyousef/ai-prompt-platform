import { beforeEach, describe, expect, it, vi } from "vitest";

const requireProjectActorContext = vi.fn();

const db = {
  project: {
    findMany: vi.fn(),
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

vi.mock("@/lib/projectActorContext", () => ({
  requireProjectActorContext,
}));

const workspaceId = "ws-1";
const teamA = "team-a";
const teamB = "team-b";
const projectId = "project-1";

function memberActor(overrides: Record<string, unknown> = {}) {
  return {
    userId: "member-1",
    workspaceId,
    workspaceRole: "MEMBER" as const,
    platformRole: "USER" as const,
    teamId: teamA,
    ...overrides,
  };
}

function ownerActor() {
  return {
    userId: "owner-1",
    workspaceId,
    workspaceRole: "OWNER" as const,
    platformRole: "USER" as const,
    teamId: null,
  };
}

function readProjectRow(overrides: {
  id?: string;
  teamIds?: Array<{
    id: string;
    workspaceId?: string | null;
    isArchived?: boolean;
    name?: string;
    slug?: string;
  } | null>;
  status?: string;
  workspaceId?: string;
} = {}) {
  const teams = overrides.teamIds ?? [{ id: teamA }];
  return {
    id: overrides.id ?? projectId,
    name: "Summer Campaign",
    slug: "summer-campaign",
    status: overrides.status ?? "ACTIVE",
    clientId: "client-1",
    workspaceId: overrides.workspaceId ?? workspaceId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    client: { id: "client-1", name: "ABK", slug: "abk" },
    teamAssignments: teams.map((team, index) => {
      if (!team) {
        return { teamId: `missing-${index}`, team: null };
      }
      return {
        teamId: team.id,
        team: {
          id: team.id,
          name: team.name ?? team.id,
          slug: team.slug ?? team.id,
          workspaceId: team.workspaceId === undefined ? workspaceId : team.workspaceId,
          isArchived: Boolean(team.isArchived),
        },
      };
    }),
  };
}

describe("GET /api/projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns matching-team projects for MEMBER with canManageProjects false", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockResolvedValue([readProjectRow()]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.viewer).toEqual({
      workspaceRole: "MEMBER",
      platformRole: "USER",
      teamId: teamA,
      canManageProjects: false,
    });
    expect(body.projects).toHaveLength(1);
    expect(body.projects[0]).toMatchObject({
      id: projectId,
      name: "Summer Campaign",
      teams: [{ id: teamA, name: teamA, slug: teamA }],
      client: { id: "client-1", name: "ABK", slug: "abk" },
    });
    expect(body).not.toHaveProperty("assignmentTeams");
    expect(JSON.stringify(body)).not.toMatch(/brief|strategy|chat|knowledge|memory|assignmentTeams/i);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          status: { not: "ARCHIVED" },
          teamAssignments: {
            some: {
              teamId: teamA,
              team: { isArchived: false, workspaceId },
            },
          },
        },
      })
    );
  });

  it("does not return another team project (DB filter only returns assigned)", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.projects).toEqual([]);
    expect(db.project.findMany.mock.calls[0][0].where.teamAssignments.some.teamId).toBe(teamA);
  });

  it("returns 200 with empty projects for teamless MEMBER", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor({ teamId: null }));
    db.project.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.projects).toEqual([]);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          status: { not: "ARCHIVED" },
          id: { in: [] },
        },
      })
    );
  });

  it("returns workspace projects for OWNER with canManageProjects true", async () => {
    requireProjectActorContext.mockResolvedValue(ownerActor());
    db.project.findMany.mockResolvedValue([readProjectRow()]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.viewer.canManageProjects).toBe(true);
    expect(db.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId,
          status: { not: "ARCHIVED" },
        },
      })
    );
  });

  it("keeps workspace ADMIN list scoped correctly", async () => {
    requireProjectActorContext.mockResolvedValue({
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN",
      platformRole: "USER",
      teamId: teamA,
    });
    db.project.findMany.mockResolvedValue([readProjectRow()]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    expect(res.status).toBe(200);
    expect(db.project.findMany.mock.calls[0][0].where.teamAssignments.some.teamId).toBe(teamA);
  });

  it("keeps platform ADMIN workspace-wide within membership workspace", async () => {
    requireProjectActorContext.mockResolvedValue({
      userId: "platform-1",
      workspaceId,
      workspaceRole: "MEMBER",
      platformRole: "ADMIN",
      teamId: teamA,
    });
    db.project.findMany.mockResolvedValue([readProjectRow()]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.viewer.canManageProjects).toBe(true);
    expect(db.project.findMany.mock.calls[0][0].where).toEqual({
      workspaceId,
      status: { not: "ARCHIVED" },
    });
  });

  it("excludes archived projects via list where", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/projects/route");
    await GET();
    expect(db.project.findMany.mock.calls[0][0].where.status).toEqual({ not: "ARCHIVED" });
  });

  it("excludes archived assignment Team via relation filter", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/projects/route");
    await GET();
    expect(db.project.findMany.mock.calls[0][0].where.teamAssignments.some.team.isArchived).toBe(
      false
    );
  });

  it("excludes cross-workspace projects via workspace constraint", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/projects/route");
    await GET();
    expect(db.project.findMany.mock.calls[0][0].where.workspaceId).toBe(workspaceId);
  });

  it("returns 401 when unauthenticated", async () => {
    requireProjectActorContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(db.project.findMany).not.toHaveBeenCalled();
  });

  it("returns 403 when actor team is invalid", async () => {
    requireProjectActorContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when authenticated session user cannot be resolved in the database", async () => {
    requireProjectActorContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({ error: "Forbidden" });
    expect(db.project.findMany).not.toHaveBeenCalled();
  });

  it("filters inactive assignment teams from serialized response", async () => {
    requireProjectActorContext.mockResolvedValue(ownerActor());
    db.project.findMany.mockResolvedValue([
      readProjectRow({
        teamIds: [
          { id: teamA },
          { id: teamB, isArchived: true },
          { id: "foreign", workspaceId: "ws-other" },
        ],
      }),
    ]);

    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(body.projects[0].teams).toEqual([{ id: teamA, name: teamA, slug: teamA }]);
  });

  it("sanitizes unexpected actor resolution errors to Internal server error", async () => {
    requireProjectActorContext.mockRejectedValue(
      new Error("PrismaClientKnownRequestError: connection refused to postgres://secret")
    );
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(body)).not.toMatch(/Prisma|postgres|connection refused/i);
  });

  it("sanitizes unexpected list query errors to Internal server error", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findMany.mockRejectedValue(new Error("relation Project does not exist"));
    const { GET } = await import("@/app/api/projects/route");
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(body)).not.toMatch(/relation Project/i);
  });
});

describe("GET /api/projects/[projectId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns restricted detail for matching-team MEMBER", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(readProjectRow());

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project).toMatchObject({
      id: projectId,
      name: "Summer Campaign",
      teams: [{ id: teamA, name: teamA, slug: teamA }],
    });
    expect(body.viewer.canManageProjects).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/brief|strategy|knowledge|memory/i);
    expect(body.project).not.toHaveProperty("brief");
    expect(body.project).not.toHaveProperty("strategy");
  });

  it("returns sanitized 404 for different-team MEMBER when findFirst misses", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Project not found." });
  });

  it("returns sanitized 404 for teamless MEMBER and preserves empty-id AND deny", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor({ teamId: null }));
    db.project.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({ error: "Project not found." });
    expect(db.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              workspaceId,
              status: { not: "ARCHIVED" },
              id: { in: [] },
            },
            { id: projectId },
          ],
        },
      })
    );
  });

  it("returns sanitized 404 for unassigned / inaccessible project ids", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId: "unassigned-or-any" } });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Project not found." });
  });

  it("returns sanitized 404 for archived, cross-workspace, and bad assignment cases", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    for (const id of ["archived", "foreign", "bad-assignment", "unknown"]) {
      const res = await GET({} as any, { params: { projectId: id } });
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "Project not found." });
    }
  });

  it("succeeds for valid multi-team project with one matching Team", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(
      readProjectRow({
        teamIds: [{ id: teamA }, { id: teamB, isArchived: true }],
      })
    );

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.teams).toEqual([{ id: teamA, name: teamA, slug: teamA }]);
  });

  it("allows manager reader", async () => {
    requireProjectActorContext.mockResolvedValue(ownerActor());
    db.project.findFirst.mockResolvedValue(readProjectRow({ teamIds: [{ id: teamB }] }));

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.viewer.canManageProjects).toBe(true);
  });

  it("uses the same 404 shape for unknown and unauthorized lookups", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const unknown = await GET({} as any, { params: { projectId: "missing" } });
    const unauthorized = await GET({} as any, { params: { projectId: "other-team" } });

    expect(await unknown.json()).toEqual(await unauthorized.json());
    expect(unknown.status).toBe(404);
    expect(unauthorized.status).toBe(404);
  });

  it("sanitizes unexpected detail query errors to Internal server error", async () => {
    requireProjectActorContext.mockResolvedValue(memberActor());
    db.project.findFirst.mockRejectedValue(
      new Error("PrismaClientInitializationError: Can't reach database server")
    );
    const { GET } = await import("@/app/api/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "Internal server error" });
    expect(JSON.stringify(body)).not.toMatch(/Prisma|database server/i);
  });
});
