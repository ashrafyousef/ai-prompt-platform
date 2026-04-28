import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { invitationId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const updated = await db.workspaceInvitation.updateMany({
      where: {
        id: params.invitationId,
        workspaceId: auth.workspaceId,
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
    const message = error instanceof Error ? error.message : "Failed to revoke invitation.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
