import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  formatAdminRouteError,
  requireWorkspaceMemberManagerContext,
} from "@/lib/adminAuth";
import {
  parseIncludeArchivedParam,
  slugifyWorkspaceEntityName,
  WORKSPACE_ENTITY_SLUG_PATTERN,
  isWorkspaceSlugUniqueViolation,
  DUPLICATE_WORKSPACE_PROJECT_SLUG_MESSAGE,
} from "@/lib/adminSlug";
import {
  buildAdminProjectListWhere,
  toProjectActorContextFromManager,
} from "@/lib/projectAccess";
import {
  INVALID_PROJECT_TEAMS_MESSAGE,
  loadAssignmentTeamCatalog,
  resolveProjectTeamIdsForManager,
} from "@/lib/projectTeamAssignment";

const createSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(WORKSPACE_ENTITY_SLUG_PATTERN, "Slug must be lowercase letters, numbers, and hyphens.")
    .max(80)
    .optional(),
  clientId: z.string().trim().min(1).nullable().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT"),
  teamIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

function serializeProject(
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

const projectSelect = {
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

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toProjectActorContextFromManager(auth);
    const searchParams = req.nextUrl.searchParams;
    const includeArchived = parseIncludeArchivedParam(searchParams);
    const clientId = searchParams.get("clientId")?.trim() || null;

    const [projects, assignmentTeams] = await Promise.all([
      db.project.findMany({
        where: buildAdminProjectListWhere(actor, { includeArchived, clientId }),
        orderBy: { updatedAt: "desc" },
        select: projectSelect,
      }),
      loadAssignmentTeamCatalog(auth),
    ]);

    return NextResponse.json({
      viewer: {
        workspaceRole: auth.workspaceRole,
        platformRole: auth.platformRole,
        teamId: auth.teamId,
      },
      assignmentTeams,
      projects: projects.map(serializeProject),
    });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load projects.");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const body = createSchema.parse(await req.json());
    const slug = body.slug ?? slugifyWorkspaceEntityName(body.name);
    const resolvedTeams = resolveProjectTeamIdsForManager(auth, body.teamIds);
    if (!resolvedTeams.ok) {
      return NextResponse.json({ error: resolvedTeams.error }, { status: resolvedTeams.status });
    }
    const teamIds = resolvedTeams.teamIds;

    const existing = await db.project.findUnique({
      where: {
        workspaceId_slug: {
          workspaceId: auth.workspaceId,
          slug,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: DUPLICATE_WORKSPACE_PROJECT_SLUG_MESSAGE },
        { status: 409 }
      );
    }

    if (body.clientId) {
      const client = await db.client.findFirst({
        where: {
          id: body.clientId,
          workspaceId: auth.workspaceId,
          isArchived: false,
        },
        select: { id: true },
      });
      if (!client) {
        return NextResponse.json(
          { error: "Client not found in this workspace or is archived." },
          { status: 400 }
        );
      }
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

    const created = await db.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: auth.workspaceId,
          name: body.name,
          slug,
          status: body.status,
          clientId: body.clientId ?? null,
        },
        select: { id: true },
      });

      if (teamIds.length > 0) {
        await tx.projectTeamAssignment.createMany({
          data: teamIds.map((teamId) => ({
            projectId: project.id,
            teamId,
          })),
        });
      }

      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        select: projectSelect,
      });
    });

    return NextResponse.json({ project: serializeProject(created) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid project input." }, { status: 400 });
    }
    if (isWorkspaceSlugUniqueViolation(error)) {
      return NextResponse.json({ error: DUPLICATE_WORKSPACE_PROJECT_SLUG_MESSAGE }, { status: 409 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to create project.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
