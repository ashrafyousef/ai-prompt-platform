import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canViewProjectForActor,
  toProjectActorContextFromManager,
} from "@/lib/projectAccess";

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toProjectActorContextFromManager(auth);
    const projectId = params.projectId?.trim();
    if (!projectId) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: auth.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        teamAssignments: { select: { teamId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const assignedTeamIds = project.teamAssignments.map((assignment) => assignment.teamId);
    if (
      !canViewProjectForActor(actor, {
        workspaceId: project.workspaceId,
        status: project.status,
        assignedTeamIds,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const sessions = await db.chatSession.findMany({
      where: {
        projectId,
        userId: auth.userId,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        summary: true,
      },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load project chats.");
    return NextResponse.json(body, { status });
  }
}
