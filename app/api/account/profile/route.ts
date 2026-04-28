import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authErrorStatus, requireAuthorizedUserContext } from "@/lib/auth";
import { db } from "@/lib/db";

const updateSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export async function GET() {
  try {
    const auth = await requireAuthorizedUserContext();
    const user = await db.user.findUnique({
      where: { id: auth.userId },
      select: {
        name: true,
        email: true,
        role: true,
        team: { select: { name: true } },
        workspaceMembers: {
          where: { workspaceId: auth.workspaceId },
          select: {
            workspace: { select: { name: true } },
          },
          take: 1,
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      profile: {
        name: user.name ?? "",
        email: user.email,
        workspaceName: user.workspaceMembers[0]?.workspace.name ?? "Unknown workspace",
        workspaceRole: auth.workspaceRole,
        platformRole: user.role,
        teamName: user.team?.name ?? null,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load profile." },
      { status: authErrorStatus(error, 500) }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAuthorizedUserContext();
    const body = updateSchema.parse(await req.json());
    const user = await db.user.update({
      where: { id: auth.userId },
      data: { name: body.name },
      select: {
        name: true,
        email: true,
      },
    });

    return NextResponse.json({
      profile: {
        name: user.name ?? "",
        email: user.email,
      },
    });
  } catch (error) {
    const status = error instanceof z.ZodError ? 400 : authErrorStatus(error, 500);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update profile." },
      { status }
    );
  }
}
