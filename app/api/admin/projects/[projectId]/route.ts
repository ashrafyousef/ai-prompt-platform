import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canViewProjectForActor,
  toProjectActorContextFromManager,
} from "@/lib/projectAccess";

const projectDetailSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  clientId: true,
  workspaceId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, slug: true } },
  teamAssignments: {
    select: {
      teamId: true,
      team: { select: { id: true, name: true, slug: true } },
    },
  },
  brief: {
    select: {
      id: true,
      projectId: true,
      title: true,
      status: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

function serializeProjectDetail(
  project: {
    id: string;
    name: string;
    slug: string;
    status: string;
    clientId: string | null;
    createdAt: Date;
    updatedAt: Date;
    client: { id: string; name: string; slug: string } | null;
    teamAssignments: Array<{
      team: { id: string; name: string; slug: string };
    }>;
    brief: {
      id: string;
      projectId: string;
      title: string;
      status: string;
      submittedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
  }
) {
  return {
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    clientId: project.clientId,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    client: project.client
      ? {
          id: project.client.id,
          name: project.client.name,
          slug: project.client.slug,
        }
      : null,
    teams: project.teamAssignments.map((assignment) => ({
      id: assignment.team.id,
      name: assignment.team.name,
      slug: assignment.team.slug,
    })),
    brief: project.brief
      ? {
          id: project.brief.id,
          projectId: project.brief.projectId,
          title: project.brief.title,
          status: project.brief.status,
          submittedAt: project.brief.submittedAt?.toISOString() ?? null,
          createdAt: project.brief.createdAt.toISOString(),
          updatedAt: project.brief.updatedAt.toISOString(),
        }
      : null,
  };
}

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
      where: { id: projectId },
      select: projectDetailSelect,
    });

    if (!project || project.workspaceId !== auth.workspaceId) {
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

    return NextResponse.json({
      viewer: {
        workspaceRole: auth.workspaceRole,
        platformRole: auth.platformRole,
        teamId: auth.teamId,
      },
      project: serializeProjectDetail(project),
    });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load project.");
    return NextResponse.json(body, { status });
  }
}
