import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { resolveWorkspaceAccessForUser } from "@/lib/workspaceAccess";

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

export async function requireWorkspaceMemberManagerContext(): Promise<{
  userId: string;
  workspaceId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN" | null;
  teamId: string | null;
}> {
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
