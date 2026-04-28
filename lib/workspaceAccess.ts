import { db } from "@/lib/db";

export type ResolvedWorkspaceAccess = {
  hasWorkspaceMembership: boolean;
  workspaceId: string | null;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  teamId: string | null;
};

/**
 * Phase 1.2 resolver: picks the earliest workspace membership as active context.
 * Multi-workspace selection UX is intentionally deferred.
 */
export async function resolveWorkspaceAccessForUser(
  userId: string
): Promise<ResolvedWorkspaceAccess> {
  const membership = await db.workspaceMember.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true, role: true, teamId: true },
  });

  if (!membership) {
    return {
      hasWorkspaceMembership: false,
      workspaceId: null,
      workspaceRole: null,
      teamId: null,
    };
  }

  return {
    hasWorkspaceMembership: true,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
    teamId: membership.teamId,
  };
}
