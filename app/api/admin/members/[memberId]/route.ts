import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

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

    const actorRole = auth.workspaceRole;
    const actorIsOwner = actorRole === "OWNER";
    const actorIsAdmin = actorRole === "ADMIN" || auth.platformRole === "ADMIN";
    if (!actorIsOwner && !actorIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const roleChangeRequested = body.role !== undefined && body.role !== target.role;
    const statusChangeRequested = body.isActive !== undefined && body.isActive !== target.isActive;

    if (target.userId === auth.userId && (roleChangeRequested || body.isActive === false)) {
      return NextResponse.json({ error: "You cannot demote or deactivate yourself." }, { status: 400 });
    }

    // Admins can only manage active-state/team for MEMBER users.
    if (!actorIsOwner) {
      if (target.teamId !== auth.teamId) {
        return NextResponse.json({ error: "You can only manage members in your team." }, { status: 403 });
      }
      if (target.role !== "MEMBER") {
        return NextResponse.json({ error: "Only owners can manage admins or owners." }, { status: 403 });
      }
      if (roleChangeRequested) {
        return NextResponse.json({ error: "Only owners can change workspace roles." }, { status: 403 });
      }
      if (body.teamId !== undefined && body.teamId !== null && body.teamId !== auth.teamId) {
        return NextResponse.json({ error: "You can only assign members to your team." }, { status: 403 });
      }
    }

    if (actorIsOwner && body.role === "OWNER" && target.role !== "OWNER") {
      // Owner promotion is allowed, but keep the update explicit.
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
      const team = await db.team.findUnique({
        where: { id: body.teamId },
        select: { id: true, workspaceId: true },
      });
      if (!team || (team.workspaceId && team.workspaceId !== auth.workspaceId)) {
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
    const message =
      error instanceof z.ZodError
        ? "Invalid request body."
        : error instanceof Error
          ? error.message
          : "Failed to update member.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
