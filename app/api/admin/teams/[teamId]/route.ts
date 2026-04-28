import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { teamId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = updateSchema.parse(await req.json());
    if (body.name === undefined && body.isArchived === undefined) {
      return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    const team = await db.team.findFirst({
      where: { id: params.teamId, workspaceId: auth.workspaceId },
      select: { id: true, name: true, isArchived: true },
    });
    if (!team) {
      return NextResponse.json({ error: "Team not found." }, { status: 404 });
    }

    const viewerIsOwner = auth.workspaceRole === "OWNER" || auth.platformRole === "ADMIN";
    if (!viewerIsOwner && auth.teamId !== team.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!viewerIsOwner && body.isArchived !== undefined && body.isArchived !== team.isArchived) {
      return NextResponse.json({ error: "Only owners can archive teams." }, { status: 403 });
    }

    if (body.name !== undefined) {
      const existing = await db.team.findFirst({
        where: {
          workspaceId: auth.workspaceId,
          id: { not: team.id },
          name: { equals: body.name, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existing) {
        return NextResponse.json({ error: "A team with this name already exists." }, { status: 409 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.team.update({
        where: { id: team.id },
        data: {
          name: body.name,
          isArchived: body.isArchived,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          isArchived: true,
          _count: { select: { workspaceMembers: true } },
        },
      });

      if (body.isArchived === true && team.isArchived !== true) {
        await tx.workspaceMember.updateMany({
          where: {
            workspaceId: auth.workspaceId,
            teamId: team.id,
          },
          data: { teamId: null },
        });
      }

      return next;
    });

    return NextResponse.json({
      team: {
        id: updated.id,
        name: updated.name,
        slug: updated.slug,
        isArchived: updated.isArchived,
        memberCount: updated._count.workspaceMembers,
      },
    });
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? "Invalid team update input."
        : error instanceof Error
          ? error.message
          : "Failed to update team.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
