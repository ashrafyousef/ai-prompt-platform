import { beforeEach, describe, expect, it, vi } from "vitest";

const getServerSession = vi.fn();
const resolveWorkspaceAccessForUser = vi.fn();
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`);
});

const db = {
  user: {
    findUnique: vi.fn(),
  },
};

vi.mock("next/navigation", () => ({
  redirect,
}));

vi.mock("next-auth", () => ({
  getServerSession,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("@/lib/workspaceAccess", () => ({
  resolveWorkspaceAccessForUser,
}));

vi.mock("@/lib/db", () => ({
  db,
}));

describe("getAdminSessionOrRedirect manager contract (projects parity)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("allows workspace OWNER", async () => {
    getServerSession.mockResolvedValue({ user: { id: "owner-1" } });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: true,
      workspaceId: "ws-1",
      workspaceRole: "OWNER",
      teamId: null,
    });
    db.user.findUnique.mockResolvedValue({ role: "USER" });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");
    const result = await getAdminSessionOrRedirect();

    expect(result.userId).toBe("owner-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows workspace ADMIN", async () => {
    getServerSession.mockResolvedValue({ user: { id: "admin-1" } });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: true,
      workspaceId: "ws-1",
      workspaceRole: "ADMIN",
      teamId: "team-a",
    });
    db.user.findUnique.mockResolvedValue({ role: "USER" });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");
    const result = await getAdminSessionOrRedirect();

    expect(result.userId).toBe("admin-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("allows platform ADMIN even when workspace role is MEMBER", async () => {
    getServerSession.mockResolvedValue({ user: { id: "platform-admin-1" } });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: true,
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      teamId: "team-a",
    });
    db.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");
    const result = await getAdminSessionOrRedirect();

    expect(result.userId).toBe("platform-admin-1");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("denies plain workspace MEMBER", async () => {
    getServerSession.mockResolvedValue({ user: { id: "member-1" } });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: true,
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      teamId: "team-a",
    });
    db.user.findUnique.mockResolvedValue({ role: "USER" });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
    expect(redirect).toHaveBeenCalledWith("/unauthorized");
  });

  it("redirects unauthenticated users to sign-in", async () => {
    getServerSession.mockResolvedValue(null);

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in?callbackUrl=%2Fadmin"
    );
    expect(redirect).toHaveBeenCalledWith("/sign-in?callbackUrl=%2Fadmin");
  });

  it("redirects users without workspace membership to /no-workspace", async () => {
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: false,
      workspaceId: null,
      workspaceRole: null,
      teamId: null,
    });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/no-workspace");
    expect(redirect).toHaveBeenCalledWith("/no-workspace");
  });

  it("redirects inactive membership to /no-workspace even when the session still identifies the user", async () => {
    // Session/JWT may still identify the user; resolveWorkspaceAccessForUser only returns
    // active memberships (isActive: true), so inactive membership looks like no access.
    getServerSession.mockResolvedValue({
      user: {
        id: "inactive-member-1",
        workspaceRole: "ADMIN",
        role: "USER",
      },
    });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: false,
      workspaceId: null,
      workspaceRole: null,
      teamId: null,
    });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/no-workspace");
    expect(redirect).toHaveBeenCalledWith("/no-workspace");
    expect(resolveWorkspaceAccessForUser).toHaveBeenCalledWith("inactive-member-1");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("redirects removed membership to /no-workspace when the database membership is absent", async () => {
    getServerSession.mockResolvedValue({
      user: {
        id: "removed-member-1",
        workspaceRole: "OWNER",
        role: "USER",
      },
    });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: false,
      workspaceId: null,
      workspaceRole: null,
      teamId: null,
    });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/no-workspace");
    expect(redirect).toHaveBeenCalledWith("/no-workspace");
    expect(resolveWorkspaceAccessForUser).toHaveBeenCalledWith("removed-member-1");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("denies stale manager JWT claims after demotion when DB workspace role is MEMBER", async () => {
    // getAdminSessionOrRedirect does not read workspaceRole/role from the session.
    // Stale OWNER/ADMIN-like session fields must lose to current DB-backed membership.
    getServerSession.mockResolvedValue({
      user: {
        id: "demoted-1",
        workspaceRole: "OWNER",
        role: "ADMIN",
        workspaceId: "ws-1",
      },
    });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: true,
      workspaceId: "ws-1",
      workspaceRole: "MEMBER",
      teamId: "team-a",
    });
    db.user.findUnique.mockResolvedValue({ role: "USER" });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/unauthorized");
    expect(redirect).toHaveBeenCalledWith("/unauthorized");
    expect(resolveWorkspaceAccessForUser).toHaveBeenCalledWith("demoted-1");
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "demoted-1" },
      select: { role: true },
    });
  });

  it("redirects stale manager JWT claims after removal/inactivation to /no-workspace", async () => {
    // Session still looks manager-authorized; current DB membership is absent/inactive.
    getServerSession.mockResolvedValue({
      user: {
        id: "stale-removed-1",
        workspaceRole: "ADMIN",
        role: "ADMIN",
        workspaceId: "ws-1",
      },
    });
    resolveWorkspaceAccessForUser.mockResolvedValue({
      hasWorkspaceMembership: false,
      workspaceId: null,
      workspaceRole: null,
      teamId: null,
    });

    const { getAdminSessionOrRedirect } = await import("@/lib/adminAuth");

    await expect(getAdminSessionOrRedirect()).rejects.toThrow("NEXT_REDIRECT:/no-workspace");
    expect(redirect).toHaveBeenCalledWith("/no-workspace");
    expect(resolveWorkspaceAccessForUser).toHaveBeenCalledWith("stale-removed-1");
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
