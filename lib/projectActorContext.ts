import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ProjectActorContext } from "@/lib/projectAccess";

export type ProjectActor = ProjectActorContext & {
  userId: string;
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER";
  platformRole: "USER" | "TEAM_LEAD" | "ADMIN";
};

/**
 * DB-backed project authorization actor resolved from one consistent User query.
 * - Active WorkspaceMember only (earliest by createdAt, id)
 * - teamId from WorkspaceMember.teamId + nested Team metadata only
 * - Never User.teamId / JWT team
 * - Genuine null teamId remains null
 * - Invalid non-null Team → Forbidden (never coerced to null)
 */
export async function requireProjectActorContext(): Promise<ProjectActor> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      workspaceMembers: {
        where: { isActive: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        select: {
          id: true,
          workspaceId: true,
          role: true,
          teamId: true,
          team: {
            select: {
              id: true,
              workspaceId: true,
              isArchived: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("Forbidden");
  }

  const membership = user.workspaceMembers[0];
  if (!membership?.workspaceId || !membership.role) {
    throw new Error("Forbidden");
  }

  let teamId: string | null = null;

  if (membership.teamId) {
    const team = membership.team;
    const teamValid =
      team != null &&
      team.id === membership.teamId &&
      team.workspaceId === membership.workspaceId &&
      team.isArchived === false;

    if (!teamValid) {
      throw new Error("Forbidden");
    }

    teamId = team.id;
  }

  return {
    userId: user.id,
    workspaceId: membership.workspaceId,
    workspaceRole: membership.role,
    platformRole: user.role,
    teamId,
  };
}
