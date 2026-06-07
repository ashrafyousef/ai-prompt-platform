import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveWorkspaceAccessForUser } from "@/lib/workspaceAccess";

export const TEAM_CONTEXT_REQUIRED_CODE = "TEAM_CONTEXT_REQUIRED";
export const TEAM_CONTEXT_REQUIRED_MESSAGE =
  "Your admin account is not assigned to a team. Ask an owner to assign you to a team.";

export class TeamContextRequiredError extends Error {
  readonly code = TEAM_CONTEXT_REQUIRED_CODE;

  constructor() {
    super(TEAM_CONTEXT_REQUIRED_MESSAGE);
    this.name = "TeamContextRequiredError";
  }
}

export type WorkspaceMemberManagerContext = {
  userId: string;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
};

export function isPlatformAdmin(context: WorkspaceMemberManagerContext): boolean {
  return context.platformRole === "ADMIN";
}

export function isWorkspaceOwner(context: WorkspaceMemberManagerContext): boolean {
  return context.workspaceRole === "OWNER";
}

export function isWorkspaceWideManager(context: WorkspaceMemberManagerContext): boolean {
  return isWorkspaceOwner(context) || isPlatformAdmin(context);
}

/** Workspace ADMIN who is not platform ADMIN — constrained to own team. */
export function isTeamScopedWorkspaceAdmin(context: WorkspaceMemberManagerContext): boolean {
  return context.workspaceRole === "ADMIN" && !isPlatformAdmin(context);
}

export function assertTeamContextForScopedAdmin(context: WorkspaceMemberManagerContext): void {
  if (isTeamScopedWorkspaceAdmin(context) && !context.teamId) {
    throw new TeamContextRequiredError();
  }
}

/** Workspace-wide managers may assign/unassign members across teams. */
export function canCrossAssignMemberTeams(context: WorkspaceMemberManagerContext): boolean {
  return isWorkspaceWideManager(context);
}

export function canCreateTeams(context: WorkspaceMemberManagerContext): boolean {
  return isWorkspaceWideManager(context);
}

export function canArchiveTeams(context: WorkspaceMemberManagerContext): boolean {
  return isWorkspaceWideManager(context);
}

export function activeInvitationRevokeFilter(
  context: WorkspaceMemberManagerContext,
  email: string
) {
  return {
    workspaceId: context.workspaceId,
    email,
    acceptedAt: null,
    revokedAt: null,
    ...(isTeamScopedWorkspaceAdmin(context) ? { teamId: context.teamId! } : {}),
  };
}

export function validateTeamScopedMemberUpdate(
  context: WorkspaceMemberManagerContext,
  target: { teamId: string | null; role: "OWNER" | "ADMIN" | "MEMBER" },
  body: { role?: "OWNER" | "ADMIN" | "MEMBER"; teamId?: string | null }
): string | null {
  if (!isTeamScopedWorkspaceAdmin(context)) return null;
  if (target.teamId !== context.teamId) {
    return "You can only manage members in your team.";
  }
  if (target.role !== "MEMBER") {
    return "Only owners can manage admins or owners.";
  }
  if (body.role !== undefined && body.role !== target.role) {
    return "Only owners can change workspace roles.";
  }
  if (body.teamId !== undefined && body.teamId !== context.teamId) {
    return body.teamId === null
      ? "You cannot remove members from your team."
      : "You can only assign members to your own team.";
  }
  return null;
}

export function formatAdminRouteError(
  error: unknown,
  fallbackMessage: string
): { status: number; body: { error: string; message?: string } } {
  if (error instanceof TeamContextRequiredError) {
    return {
      status: 403,
      body: { error: TEAM_CONTEXT_REQUIRED_CODE, message: TEAM_CONTEXT_REQUIRED_MESSAGE },
    };
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  const status =
    message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
  return { status, body: { error: message } };
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("prismaclientinitializationerror") ||
    message.includes("timed out")
  );
}

export async function getAdminSessionOrRedirect() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/sign-in?callbackUrl=%2Fadmin");
  }

  const workspaceAccess = await resolveWorkspaceAccessForUser(session.user.id);
  if (!workspaceAccess.hasWorkspaceMembership) {
    redirect("/no-workspace");
  }

  let user: { role: "USER" | "TEAM_LEAD" | "ADMIN" } | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      redirect("/chat?error=service-unavailable");
    }
    throw error;
  }
  const workspaceManager =
    workspaceAccess.workspaceRole === "OWNER" || workspaceAccess.workspaceRole === "ADMIN";
  const platformManager = user?.role === "ADMIN";
  if (!workspaceManager && !platformManager) {
    // Phase 1.6: admin area can be reached by workspace OWNER/ADMIN,
    // while User.role=ADMIN remains a compatibility path.
    redirect("/unauthorized");
  }
  return { session, userId: session.user.id as string };
}

export async function requireAdminUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const workspaceAccess = await resolveWorkspaceAccessForUser(session.user.id);
  if (!workspaceAccess.hasWorkspaceMembership) {
    throw new Error("Forbidden");
  }

  let user: { role: "USER" | "TEAM_LEAD" | "ADMIN" } | null = null;
  try {
    user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      throw new Error("ServiceUnavailable");
    }
    throw error;
  }
  const workspaceManager =
    workspaceAccess.workspaceRole === "OWNER" || workspaceAccess.workspaceRole === "ADMIN";
  const platformManager = user?.role === "ADMIN";
  if (!workspaceManager && !platformManager) {
    // Phase 1.6 compatibility gate for legacy platform admins and workspace managers.
    throw new Error("Forbidden");
  }
  return session.user.id;
}

export async function requireWorkspaceMemberManagerContext(): Promise<WorkspaceMemberManagerContext> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const [workspaceAccess, user] = await Promise.all([
    resolveWorkspaceAccessForUser(session.user.id),
    db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    }),
  ]);

  if (!workspaceAccess.hasWorkspaceMembership || !workspaceAccess.workspaceId) {
    throw new Error("Forbidden");
  }

  const workspaceManager =
    workspaceAccess.workspaceRole === "OWNER" || workspaceAccess.workspaceRole === "ADMIN";
  const platformManager = user?.role === "ADMIN";
  if (!workspaceManager && !platformManager) {
    throw new Error("Forbidden");
  }

  return {
    userId: session.user.id,
    workspaceId: workspaceAccess.workspaceId,
    workspaceRole: workspaceAccess.workspaceRole,
    platformRole: user?.role ?? null,
    teamId: workspaceAccess.teamId ?? null,
  };
}
