import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { parseBriefDocumentJson } from "@/lib/briefIntake";
import { parseStrategyDocumentJson } from "@/lib/strategyDocument";
import {
  canViewProjectForActor,
  toProjectActorContextFromManager,
} from "@/lib/projectAccess";
import {
  INVALID_PROJECT_TEAMS_MESSAGE,
  resolveProjectTeamIdsForManager,
} from "@/lib/projectTeamAssignment";

const patchSchema = z.object({
  teamIds: z.array(z.string().trim().min(1)).max(20),
});

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
      responsesJson: true,
      submittedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  strategy: {
    select: {
      id: true,
      projectId: true,
      sourceBriefId: true,
      status: true,
      responsesJson: true,
      readyAt: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} as const;

const projectAssignmentSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  clientId: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, slug: true } },
  teamAssignments: {
    select: {
      team: { select: { id: true, name: true, slug: true } },
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
      responsesJson: unknown;
      submittedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    } | null;
    strategy: {
      id: string;
      projectId: string;
      sourceBriefId: string;
      status: string;
      responsesJson: unknown;
      readyAt: Date | null;
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
          responsesJson: parseBriefDocumentJson(project.brief.responsesJson),
          submittedAt: project.brief.submittedAt?.toISOString() ?? null,
          createdAt: project.brief.createdAt.toISOString(),
          updatedAt: project.brief.updatedAt.toISOString(),
        }
      : null,
    strategy: project.strategy
      ? {
          id: project.strategy.id,
          projectId: project.strategy.projectId,
          sourceBriefId: project.strategy.sourceBriefId,
          status: project.strategy.status,
          readyAt: project.strategy.readyAt?.toISOString() ?? null,
          createdAt: project.strategy.createdAt.toISOString(),
          updatedAt: project.strategy.updatedAt.toISOString(),
          responsesJson: parseStrategyDocumentJson(project.strategy.responsesJson),
        }
      : null,
  };
}

function serializeProjectAssignment(
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

/**
 * Replace project-team assignments. Mirrors POST create team policy.
 * Does not alter project metadata beyond assignment rows + updatedAt.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toProjectActorContextFromManager(auth);
    const projectId = params.projectId?.trim();
    if (!projectId) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid project assignment input." }, { status: 400 });
    }

    const body = patchSchema.parse(rawBody);
    const resolvedTeams = resolveProjectTeamIdsForManager(auth, body.teamIds);
    if (!resolvedTeams.ok) {
      return NextResponse.json({ error: resolvedTeams.error }, { status: resolvedTeams.status });
    }
    const teamIds = resolvedTeams.teamIds;

    const project = await db.project.findFirst({
      where: { id: projectId },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        teamAssignments: { select: { teamId: true } },
      },
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

    if (teamIds.length > 0) {
      const teams = await db.team.findMany({
        where: {
          id: { in: teamIds },
          workspaceId: auth.workspaceId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (teams.length !== teamIds.length) {
        return NextResponse.json({ error: INVALID_PROJECT_TEAMS_MESSAGE }, { status: 400 });
      }
    }

    const updated = await db.$transaction(async (tx) => {
      await tx.projectTeamAssignment.deleteMany({ where: { projectId: project.id } });
      if (teamIds.length > 0) {
        await tx.projectTeamAssignment.createMany({
          data: teamIds.map((teamId) => ({
            projectId: project.id,
            teamId,
          })),
        });
      }
      await tx.project.update({
        where: { id: project.id },
        data: { updatedAt: new Date() },
        select: { id: true },
      });
      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        select: projectAssignmentSelect,
      });
    });

    return NextResponse.json({ project: serializeProjectAssignment(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid project assignment input." }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to update project teams.");
    if (status === 500) {
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    return NextResponse.json(body, { status });
  }
}
