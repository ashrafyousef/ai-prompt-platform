import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  assertTeamContextForScopedAdmin,
  formatAdminRouteError,
  isTeamScopedWorkspaceAdmin,
  isWorkspaceWideManager,
  requireWorkspaceMemberManagerContext,
  validateTeamScopedMemberUpdate,
} from "@/lib/adminAuth";

const schema = z.object({
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    assertTeamContextForScopedAdmin(auth);
    const body = schema.parse(await req.json());
    if (body.role === undefined && body.isActive === undefined && body.teamId === undefined) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    const target = await db.workspaceMember.findFirst({
      where: { id: params.memberId, workspaceId: auth.workspaceId },
      select: {
        id: true,
        userId: true,
        role: true,
        isActive: true,
        teamId: true,
      },
    });
    if (!target) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    if (!isWorkspaceWideManager(auth) && !isTeamScopedWorkspaceAdmin(auth)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const teamScopedViolation = validateTeamScopedMemberUpdate(auth, target, body);
    if (teamScopedViolation) {
      return NextResponse.json({ error: teamScopedViolation }, { status: 403 });
    }

    const roleChangeRequested = body.role !== undefined && body.role !== target.role;
    const statusChangeRequested = body.isActive !== undefined && body.isActive !== target.isActive;

    if (target.userId === auth.userId && (roleChangeRequested || body.isActive === false)) {
      return NextResponse.json({ error: "You cannot demote or deactivate yourself." }, { status: 400 });
    }

    if (roleChangeRequested || statusChangeRequested) {
      const nextRole = body.role ?? target.role;
      const nextIsActive = body.isActive ?? target.isActive;
      const ownerImpact =
        target.role === "OWNER" &&
        target.isActive &&
        (nextRole !== "OWNER" || nextIsActive === false);
      if (ownerImpact) {
        const activeOwnerCount = await db.workspaceMember.count({
          where: {
            workspaceId: auth.workspaceId,
            role: "OWNER",
            isActive: true,
          },
        });
        if (activeOwnerCount <= 1) {
          return NextResponse.json({ error: "At least one active owner is required." }, { status: 400 });
        }
      }
    }

    if (body.teamId !== undefined && body.teamId !== null) {
      const team = await db.team.findFirst({
        where: {
          id: body.teamId,
          workspaceId: auth.workspaceId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Team not found." }, { status: 400 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      return tx.workspaceMember.update({
        where: { id: target.id },
        data: {
          role: body.role,
          isActive: body.isActive,
          teamId: body.teamId,
        },
        select: {
          id: true,
          userId: true,
          role: true,
          isActive: true,
          teamId: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
          team: { select: { name: true } },
        },
      });
    });

    return NextResponse.json({
      member: {
        id: updated.id,
        userId: updated.userId,
        name: updated.user.name ?? "",
        email: updated.user.email,
        role: updated.role,
        isActive: updated.isActive,
        teamId: updated.teamId,
        teamName: updated.team?.name ?? null,
        joinedAt: updated.createdAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to update member.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
