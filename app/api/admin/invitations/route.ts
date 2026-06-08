import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  activeInvitationRevokeFilter,
  assertTeamContextForScopedAdmin,
  formatAdminRouteError,
  isTeamScopedWorkspaceAdmin,
  requireWorkspaceMemberManagerContext,
} from "@/lib/adminAuth";
import { checkRateLimit } from "@/lib/rateLimit";
import { issueWorkspaceInvitationToken } from "@/lib/workspaceInvitations";
import { buildAppUrl } from "@/lib/appUrl";
import { sendWorkspaceInvitationEmail } from "@/lib/transactionalEmail";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).default("MEMBER"),
  teamId: z.string().nullable().optional(),
});

export async function GET() {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    assertTeamContextForScopedAdmin(auth);
    const scopedToOwnTeam = isTeamScopedWorkspaceAdmin(auth);
    const invitations = await db.workspaceInvitation.findMany({
      where: {
        workspaceId: auth.workspaceId,
        ...(scopedToOwnTeam ? { teamId: auth.teamId! } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        team: { select: { name: true } },
        invitedBy: { select: { email: true, name: true } },
      },
    });
    return NextResponse.json({
      invitations: invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        teamName: inv.team?.name ?? null,
        createdAt: inv.createdAt.toISOString(),
        expiresAt: inv.expiresAt.toISOString(),
        acceptedAt: inv.acceptedAt?.toISOString() ?? null,
        revokedAt: inv.revokedAt?.toISOString() ?? null,
        invitedByName: inv.invitedBy.name ?? null,
        invitedByEmail: inv.invitedBy.email,
      })),
    });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load invitations.");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    assertTeamContextForScopedAdmin(auth);
    const body = createSchema.parse(await req.json());
    const scopedToOwnTeam = isTeamScopedWorkspaceAdmin(auth);
    if (scopedToOwnTeam && body.role !== "MEMBER") {
      return NextResponse.json(
        { error: "Only owners can invite with ADMIN or OWNER roles." },
        { status: 403 }
      );
    }
    if (scopedToOwnTeam && body.teamId && body.teamId !== auth.teamId) {
      return NextResponse.json(
        { error: "You can only send invitations for your own team." },
        { status: 403 }
      );
    }
    const invitationTeamId = scopedToOwnTeam ? auth.teamId! : body.teamId ?? null;

    const limit = await checkRateLimit({
      userId: `invite:${auth.userId}`,
      endpoint: "/api/admin/invitations",
      limit: 20,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many invitation attempts. Try again later." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
      );
    }

    if (invitationTeamId) {
      const team = await db.team.findFirst({
        where: {
          id: invitationTeamId,
          workspaceId: auth.workspaceId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Team not found." }, { status: 400 });
      }
    }

    const existingUser = await db.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existingUser) {
      const existingMembership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: auth.workspaceId,
            userId: existingUser.id,
          },
        },
        select: { id: true },
      });
      if (existingMembership) {
        return NextResponse.json(
          { error: "That user is already a member of this workspace." },
          { status: 409 }
        );
      }
    }

    await db.workspaceInvitation.updateMany({
      where: activeInvitationRevokeFilter(auth, body.email),
      data: {
        revokedAt: new Date(),
      },
    });

    const issued = await issueWorkspaceInvitationToken({
      workspaceId: auth.workspaceId,
      invitedById: auth.userId,
      email: body.email,
      role: body.role,
      teamId: invitationTeamId,
    });

    const workspace = await db.workspace.findUnique({
      where: { id: auth.workspaceId },
      select: { name: true },
    });
    const inviteUrl = buildAppUrl(`/accept-invite?token=${encodeURIComponent(issued.rawToken)}`, req);
    let deliveryError = false;
    try {
      await sendWorkspaceInvitationEmail({
        to: body.email,
        workspaceName: workspace?.name ?? "workspace",
        role: body.role,
        inviteUrl,
      });
    } catch (error) {
      deliveryError = true;
      console.error("[auth] Failed to send invitation email", error);
    }

    return NextResponse.json({
      ok: !deliveryError,
      message: deliveryError
        ? "Invitation created, but email delivery failed. Check email configuration."
        : "Invitation created successfully.",
      invitation: {
        id: issued.invitationId,
        email: body.email,
        role: body.role,
        teamId: invitationTeamId,
        expiresAt: issued.expiresAt.toISOString(),
      },
      ...(process.env.NODE_ENV !== "production" ? { inviteUrl } : {}),
    }, { status: deliveryError ? 502 : 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid invitation input." }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to create invitation.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
