import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();

const db = {
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

function projectRow(overrides: {
  workspaceId?: string;
  status?: "DRAFT" | "ACTIVE" | "ARCHIVED";
  teamIds?: string[];
  brief?: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    responsesJson?: unknown;
    submittedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
} = {}) {
  const teamIds = overrides.teamIds ?? [teamA];
  return {
    id: projectId,
    name: "Summer Campaign",
    slug: "summer-campaign",
    status: overrides.status ?? "ACTIVE",
    clientId: null,
    workspaceId: overrides.workspaceId ?? workspaceId,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    client: null,
    teamAssignments: teamIds.map((teamId) => ({
      teamId,
      team: { id: teamId, name: teamId, slug: teamId },
    })),
    brief: overrides.brief ?? null,
  };
}

describe("admin project detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Unauthorized"));
    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    expect(res.status).toBe(401);
  });

  it("denies MEMBER access", async () => {
    requireWorkspaceMemberManagerContext.mockRejectedValue(new Error("Forbidden"));
    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    expect(res.status).toBe(403);
  });

  it("returns 404 for missing project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 404 for foreign workspace project", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(projectRow({ workspaceId: otherWorkspaceId }));

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 403 for team-scoped ADMIN without project visibility", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    db.project.findFirst.mockResolvedValue(projectRow({ teamIds: [teamB] }));

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe("Forbidden");
  });

  it("returns project without brief for OWNER", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(projectRow());

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.id).toBe(projectId);
    expect(body.project.brief).toBeNull();
    expect(body.project.teams).toHaveLength(1);
  });

  it("returns project with brief for visible team-scoped ADMIN", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(teamAdminContext());
    const brief = {
      id: "brief-1",
      projectId,
      title: "Campaign Brief",
      status: "ARCHIVED",
      responsesJson: { objective: "Legacy field" },
      submittedAt: null,
      createdAt: new Date("2026-01-03T00:00:00.000Z"),
      updatedAt: new Date("2026-01-04T00:00:00.000Z"),
    };
    db.project.findFirst.mockResolvedValue(projectRow({ brief }));

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.brief).toMatchObject({
      id: "brief-1",
      projectId,
      title: "Campaign Brief",
      status: "ARCHIVED",
      submittedAt: null,
      responsesJson: {
        version: 1,
        fields: expect.objectContaining({
          objective: "Legacy field",
        }),
      },
    });
  });

  it("includes archived project status on detail response", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue(ownerContext());
    db.project.findFirst.mockResolvedValue(projectRow({ status: "ARCHIVED" }));

    const { GET } = await import("@/app/api/admin/projects/[projectId]/route");
    const res = await GET({} as any, { params: { projectId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.project.status).toBe("ARCHIVED");
  });
});
