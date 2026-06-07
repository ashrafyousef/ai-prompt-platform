import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  assertTeamContextForScopedAdmin,
  formatAdminRouteError,
  isTeamScopedWorkspaceAdmin,
  requireWorkspaceMemberManagerContext,
} from "@/lib/adminAuth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { invitationId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    assertTeamContextForScopedAdmin(auth);
    const scopedToOwnTeam = isTeamScopedWorkspaceAdmin(auth);
    const updated = await db.workspaceInvitation.updateMany({
      where: {
        id: params.invitationId,
        workspaceId: auth.workspaceId,
        ...(scopedToOwnTeam ? { teamId: auth.teamId! } : {}),
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Invitation not found or already inactive." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to revoke invitation.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
