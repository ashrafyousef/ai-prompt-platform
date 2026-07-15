import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authErrorStatus, requireUserIdWithWorkspace } from "@/lib/auth";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canViewProjectForActor,
  projectTeamAssignmentAccessSelect,
  toProjectAccessTargetFromAssignments,
  toProjectActorContextFromManager,
} from "@/lib/projectAccess";

export const dynamic = "force-dynamic";

async function readOptionalProjectId(req: NextRequest): Promise<string | undefined> {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return undefined;
  }

  const text = await req.text();
  if (!text.trim()) {
    return undefined;
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return undefined;
  }

  if (!body || typeof body !== "object" || !("projectId" in body)) {
    return undefined;
  }

  const raw = (body as { projectId?: unknown }).projectId;
  if (raw == null || raw === "") {
    return undefined;
  }

  if (typeof raw !== "string") {
    return undefined;
  }

  const trimmed = raw.trim();
  return trimmed || undefined;
}

export async function POST(req: NextRequest) {
  const projectId = await readOptionalProjectId(req);

  if (!projectId) {
    try {
      const { userId } = await requireUserIdWithWorkspace();
      const session = await db.chatSession.create({
        data: { userId, title: "New Chat" },
      });
      return NextResponse.json({ session });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to create chat." },
        { status: authErrorStatus(error, 500) }
      );
    }
  }

  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toProjectActorContextFromManager(auth);

    const project = await db.project.findFirst({
      where: { id: projectId, workspaceId: auth.workspaceId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        teamAssignments: { select: projectTeamAssignmentAccessSelect },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    if (
      !canViewProjectForActor(
        actor,
        toProjectAccessTargetFromAssignments(project, project.teamAssignments),
        { includeArchivedProjects: true }
      )
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const session = await db.chatSession.create({
      data: {
        userId: auth.userId,
        projectId: project.id,
        title: "New Chat",
      },
    });
    return NextResponse.json({ session });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to create chat.");
    return NextResponse.json(body, { status });
  }
}
