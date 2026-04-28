import { NextRequest, NextResponse } from "next/server";
import { getInvitationByRawToken } from "@/lib/workspaceInvitations";

function invitationState(invitation: {
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
}): "valid" | "expired" | "accepted" | "revoked" {
  if (invitation.revokedAt) return "revoked";
  if (invitation.acceptedAt) return "accepted";
  if (invitation.expiresAt <= new Date()) return "expired";
  return "valid";
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return NextResponse.json({ state: "invalid" }, { status: 400 });
  }

  const invitation = await getInvitationByRawToken(token);
  if (!invitation) {
    return NextResponse.json({ state: "invalid" }, { status: 404 });
  }

  const state = invitationState(invitation);
  return NextResponse.json({
    state,
    invitation:
      state === "valid"
        ? {
            email: invitation.email,
            role: invitation.role,
            workspaceName: invitation.workspace.name,
            expiresAt: invitation.expiresAt.toISOString(),
          }
        : undefined,
  });
}
