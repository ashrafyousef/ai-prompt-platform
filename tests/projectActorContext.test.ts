import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();

const db = {
  user: {
    findUnique: vi.fn(),
  },
  workspaceMember: {
    findFirst: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
};

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/db", () => ({ db }));

function userSnapshot(overrides: {
  role?: "USER" | "TEAM_LEAD" | "ADMIN";
  memberships?: Array<{
    id?: string;
    workspaceId: string;
    role: "OWNER" | "ADMIN" | "MEMBER";
    teamId: string | null;
    team?: { id: string; workspaceId: string | null; isArchived: boolean } | null;
  }> | null;
} = {}) {
  const memberships = overrides.memberships === null ? [] : overrides.memberships ?? [];
  return {
    id: "user-1",
    role: overrides.role ?? "USER",
    workspaceMembers: memberships.map((m, index) => ({
      id: m.id ?? `wm-${index}`,
      workspaceId: m.workspaceId,
      role: m.role,
      teamId: m.teamId,
      team: m.team === undefined ? null : m.team,
    })),
  };
}

describe("requireProjectActorContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("throws Unauthorized when there is no authenticated user", async () => {
    getServerSession.mockResolvedValue(null);
    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Unauthorized");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("throws Forbidden when authenticated session user is missing from the database", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(null);

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when there is no active workspace membership", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1", teamId: "jwt-team" } });
    db.user.findUnique.mockResolvedValue(userSnapshot({ memberships: null }));

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Forbidden");
  });

  it("uses one consistent user/membership/Team query and never selects User.teamId", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", teamId: "jwt-stale-team", role: "ADMIN" },
    });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        role: "USER",
        memberships: [
          {
            workspaceId: "ws-1",
            role: "MEMBER",
            teamId: "team-from-membership",
            team: {
              id: "team-from-membership",
              workspaceId: "ws-1",
              isArchived: false,
            },
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    const actor = await requireProjectActorContext();

    expect(actor).toEqual({
      userId: "user-1",
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      platformRole: "USER",
      teamId: "team-from-membership",
    });
    expect(db.user.findUnique).toHaveBeenCalledTimes(1);
    expect(db.workspaceMember.findFirst).not.toHaveBeenCalled();
    expect(db.team.findFirst).not.toHaveBeenCalled();

    const select = db.user.findUnique.mock.calls[0][0].select;
    expect(select).not.toHaveProperty("teamId");
    expect(select).toMatchObject({
      id: true,
      role: true,
      workspaceMembers: expect.objectContaining({
        where: { isActive: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
      }),
    });
  });

  it("does not use JWT or session team claims and keeps genuine null team", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", teamId: "session-team" },
    });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        memberships: [
          {
            workspaceId: "ws-1",
            role: "ADMIN",
            teamId: null,
            team: null,
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    const actor = await requireProjectActorContext();

    expect(actor.teamId).toBeNull();
    expect(db.team.findFirst).not.toHaveBeenCalled();
  });

  it("throws Forbidden when nested Team is missing for non-null teamId", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        role: "ADMIN",
        memberships: [
          {
            workspaceId: "ws-1",
            role: "OWNER",
            teamId: "missing-team",
            team: null,
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when nested Team is archived", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        memberships: [
          {
            workspaceId: "ws-1",
            role: "MEMBER",
            teamId: "archived-team",
            team: {
              id: "archived-team",
              workspaceId: "ws-1",
              isArchived: true,
            },
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Forbidden");
  });

  it("throws Forbidden when nested Team is cross-workspace", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        memberships: [
          {
            workspaceId: "ws-1",
            role: "ADMIN",
            teamId: "foreign-team",
            team: {
              id: "foreign-team",
              workspaceId: "ws-other",
              isArchived: false,
            },
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    await expect(requireProjectActorContext()).rejects.toThrow("Forbidden");
  });

  it("loads fresh User.role as platformRole", async () => {
    getServerSession.mockResolvedValue({
      user: { id: "user-1", role: "USER" },
    });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        role: "ADMIN",
        memberships: [
          {
            workspaceId: "ws-1",
            role: "MEMBER",
            teamId: null,
            team: null,
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    const actor = await requireProjectActorContext();
    expect(actor.platformRole).toBe("ADMIN");
  });

  it("selects earliest active membership deterministically via orderBy", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    db.user.findUnique.mockResolvedValue(
      userSnapshot({
        memberships: [
          {
            id: "wm-first",
            workspaceId: "ws-first",
            role: "MEMBER",
            teamId: null,
            team: null,
          },
        ],
      })
    );

    const { requireProjectActorContext } = await import("@/lib/projectActorContext");
    const actor = await requireProjectActorContext();

    expect(actor.workspaceId).toBe("ws-first");
    expect(db.user.findUnique.mock.calls[0][0].select.workspaceMembers.orderBy).toEqual([
      { createdAt: "asc" },
      { id: "asc" },
    ]);
  });
});
