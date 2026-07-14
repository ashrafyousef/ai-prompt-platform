import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();

vi.mock("@/lib/db", () => ({
  db: {
    team: {
      findMany,
    },
  },
}));

describe("loadAssignmentTeamCatalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findMany.mockResolvedValue([]);
  });

  it("queries only active teams in the current workspace", async () => {
    const { loadAssignmentTeamCatalog } = await import("@/lib/projectTeamAssignment");
    await loadAssignmentTeamCatalog({
      userId: "owner-1",
      workspaceId: "ws-1",
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: "ws-1",
        isArchived: false,
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        isArchived: true,
      },
    });
  });

  it("still limits team-scoped ADMIN catalog to own active team", async () => {
    const { loadAssignmentTeamCatalog } = await import("@/lib/projectTeamAssignment");
    await loadAssignmentTeamCatalog({
      userId: "admin-1",
      workspaceId: "ws-1",
      workspaceRole: "ADMIN",
      platformRole: "USER",
      teamId: "team-a",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws-1",
          isArchived: false,
          id: "team-a",
        },
      })
    );
  });

  it("does not require team context for teamless workspace ADMIN", async () => {
    const { loadAssignmentTeamCatalog } = await import("@/lib/projectTeamAssignment");
    await loadAssignmentTeamCatalog({
      userId: "admin-2",
      workspaceId: "ws-1",
      workspaceRole: "ADMIN",
      platformRole: "USER",
      teamId: null,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId: "ws-1",
          isArchived: false,
        },
      })
    );
  });
});
