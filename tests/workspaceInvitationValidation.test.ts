import { beforeEach, describe, expect, it, vi } from "vitest";

const requireWorkspaceMemberManagerContext = vi.fn();
const checkRateLimit = vi.fn();
const issueWorkspaceInvitationToken = vi.fn();
const getInvitationByRawToken = vi.fn();
const hashPassword = vi.fn();
const sendWorkspaceInvitationEmail = vi.fn();

const tx = {
  workspaceInvitation: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workspaceMember: {
    upsert: vi.fn(),
    update: vi.fn(),
  },
};

const db = {
  user: {
    findUnique: vi.fn(),
  },
  team: {
    findFirst: vi.fn(),
  },
  workspace: {
    findUnique: vi.fn(),
  },
  workspaceMember: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  workspaceInvitation: {
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
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

vi.mock("@/lib/rateLimit", () => ({ checkRateLimit }));
vi.mock("@/lib/password", () => ({ hashPassword }));
vi.mock("@/lib/workspaceInvitations", () => ({
  issueWorkspaceInvitationToken,
  getInvitationByRawToken,
}));
vi.mock("@/lib/appUrl", () => ({
  buildAppUrl: () => "http://localhost/accept-invite?token=test-token",
}));
vi.mock("@/lib/transactionalEmail", () => ({ sendWorkspaceInvitationEmail }));

const workspaceId = "workspace-1";
const teamId = "team-1";
const invitationId = "invitation-1";

function request(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validInvitation(overrides: Record<string, unknown> = {}) {
  return {
    id: invitationId,
    email: "invitee@example.com",
    role: "MEMBER",
    teamId,
    workspaceId,
    expiresAt: new Date(Date.now() + 60_000),
    acceptedAt: null,
    revokedAt: null,
    workspace: { name: "Workspace" },
    ...overrides,
  };
}

describe("invitation acceptance transaction safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkRateLimit.mockResolvedValue({ allowed: true });
    getInvitationByRawToken.mockResolvedValue(validInvitation());
    db.user.findUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: "existing-password",
      name: "Existing User",
    });
    tx.workspaceInvitation.findUnique.mockResolvedValue(validInvitation());
    tx.team.findFirst.mockResolvedValue({ id: teamId });
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 });
    tx.user.findUnique.mockResolvedValue({ id: "user-1", passwordHash: "existing-password" });
    tx.user.update.mockResolvedValue({ id: "user-1" });
    tx.workspaceMember.upsert.mockResolvedValue({ id: "member-1" });
  });

  it("does not reuse an already accepted invitation", async () => {
    getInvitationByRawToken.mockResolvedValue(validInvitation({ acceptedAt: new Date() }));
    const { POST } = await import("@/app/api/auth/invitations/accept/route");

    const response = await POST(
      request("http://localhost/api/auth/invitations/accept", {
        token: "accepted-token",
        name: "Existing User",
      }) as never
    );

    expect(response.status).toBe(400);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
  });

  it("does not mutate membership when conditional consumption loses a race", async () => {
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 0 });
    const { POST } = await import("@/app/api/auth/invitations/accept/route");

    const response = await POST(
      request("http://localhost/api/auth/invitations/accept", {
        token: "race-token",
        name: "Existing User",
      }) as never
    );

    expect(response.status).toBe(400);
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
    expect(tx.user.create).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("revalidates the invitation team before consuming or mutating membership", async () => {
    tx.team.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/invitations/accept/route");

    const response = await POST(
      request("http://localhost/api/auth/invitations/accept", {
        token: "archived-team-token",
        name: "Existing User",
      }) as never
    );

    expect(response.status).toBe(400);
    expect(tx.team.findFirst).toHaveBeenCalledWith({
      where: { id: teamId, workspaceId, isArchived: false },
      select: { id: true },
    });
    expect(tx.workspaceInvitation.updateMany).not.toHaveBeenCalled();
    expect(tx.workspaceMember.upsert).not.toHaveBeenCalled();
  });

  it("consumes the invitation before updating the user or membership", async () => {
    const { POST } = await import("@/app/api/auth/invitations/accept/route");

    const response = await POST(
      request("http://localhost/api/auth/invitations/accept", {
        token: "valid-token",
        name: "Existing User",
      }) as never
    );

    expect(response.status).toBe(200);
    expect(tx.workspaceInvitation.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.user.update.mock.invocationCallOrder[0]
    );
    expect(tx.workspaceInvitation.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.workspaceMember.upsert.mock.invocationCallOrder[0]
    );
  });
});

describe("invitation creation team validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      userId: "owner-1",
      workspaceId,
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });
    checkRateLimit.mockResolvedValue({ allowed: true });
    db.team.findFirst.mockResolvedValue(null);
  });

  it.each(["archived", "cross-workspace", "workspace-less"])(
    "rejects an %s team",
    async () => {
      const { POST } = await import("@/app/api/admin/invitations/route");
      const response = await POST(
        request("http://localhost/api/admin/invitations", {
          email: "invitee@example.com",
          role: "MEMBER",
          teamId,
        }) as never
      );

      expect(response.status).toBe(400);
      expect(db.team.findFirst).toHaveBeenCalledWith({
        where: { id: teamId, workspaceId, isArchived: false },
        select: { id: true },
      });
      expect(issueWorkspaceInvitationToken).not.toHaveBeenCalled();
    }
  );

  it("validates a team admin's forced team when teamId is omitted", async () => {
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      userId: "admin-1",
      workspaceId,
      workspaceRole: "ADMIN",
      platformRole: "USER",
      teamId,
    });
    const { POST } = await import("@/app/api/admin/invitations/route");
    const response = await POST(
      request("http://localhost/api/admin/invitations", {
        email: "invitee@example.com",
        role: "MEMBER",
      }) as never
    );

    expect(response.status).toBe(400);
    expect(db.team.findFirst).toHaveBeenCalledWith({
      where: { id: teamId, workspaceId, isArchived: false },
      select: { id: true },
    });
    expect(issueWorkspaceInvitationToken).not.toHaveBeenCalled();
  });
});

describe("member team assignment validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireWorkspaceMemberManagerContext.mockResolvedValue({
      userId: "owner-1",
      workspaceId,
      workspaceRole: "OWNER",
      platformRole: "USER",
      teamId: null,
    });
    db.workspaceMember.findFirst.mockResolvedValue({
      id: "member-1",
      userId: "user-1",
      role: "MEMBER",
      isActive: true,
      teamId: null,
    });
    db.team.findFirst.mockResolvedValue(null);
  });

  it.each(["archived", "cross-workspace", "workspace-less"])(
    "rejects assignment to an %s team",
    async () => {
      const { PATCH } = await import("@/app/api/admin/members/[memberId]/route");
      const response = await PATCH(
        request("http://localhost/api/admin/members/member-1", { teamId }) as never,
        { params: { memberId: "member-1" } }
      );

      expect(response.status).toBe(400);
      expect(db.team.findFirst).toHaveBeenCalledWith({
        where: { id: teamId, workspaceId, isArchived: false },
        select: { id: true },
      });
      expect(tx.workspaceMember.update).not.toHaveBeenCalled();
    }
  );
});
