import crypto from "crypto";
import { db } from "@/lib/db";

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function issueWorkspaceInvitationToken(params: {
  workspaceId: string;
  invitedById: string;
  email: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
  teamId?: string | null;
}): Promise<{ rawToken: string; invitationId: string; expiresAt: Date }> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  const invitation = await db.workspaceInvitation.create({
    data: {
      workspaceId: params.workspaceId,
      invitedById: params.invitedById,
      email: params.email.trim().toLowerCase(),
      role: params.role,
      teamId: params.teamId ?? null,
      tokenHash,
      expiresAt,
    },
    select: { id: true },
  });

  return { rawToken, invitationId: invitation.id, expiresAt };
}

export async function getInvitationByRawToken(rawToken: string) {
  const tokenHash = hashInvitationToken(rawToken);
  return db.workspaceInvitation.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      role: true,
      teamId: true,
      workspaceId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      workspace: { select: { name: true } },
    },
  });
}

export async function markInvitationAccepted(invitationId: string): Promise<boolean> {
  const now = new Date();
  const updated = await db.workspaceInvitation.updateMany({
    where: {
      id: invitationId,
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: { acceptedAt: now },
  });
  return updated.count === 1;
}
