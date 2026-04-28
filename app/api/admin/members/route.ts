import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

export async function GET() {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const scopedToOwnTeam =
      auth.workspaceRole === "ADMIN" && auth.platformRole !== "ADMIN";
    const members = await db.workspaceMember.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(scopedToOwnTeam ? { teamId: auth.teamId ?? "__no_team__" } : {}),
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        role: true,
        isActive: true,
        createdAt: true,
        userId: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        teamId: true,
        team: { select: { name: true } },
      },
    });

    return NextResponse.json({
      viewer: {
        userId: auth.userId,
        workspaceRole: auth.workspaceRole,
        platformRole: auth.platformRole,
      },
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name ?? "",
        email: m.user.email,
        role: m.role,
        isActive: m.isActive,
        teamId: m.teamId,
        teamName: m.team?.name ?? null,
        joinedAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load members.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
