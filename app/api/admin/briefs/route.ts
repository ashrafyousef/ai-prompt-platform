import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { parseIncludeArchivedParam } from "@/lib/adminSlug";
import {
  buildAdminBriefListWhere,
  canViewBriefForActor,
  toBriefActorContextFromManager,
} from "@/lib/briefAccess";

const briefStatusValues = ["DRAFT", "SUBMITTED", "IN_REVIEW", "APPROVED", "ARCHIVED"] as const;

const createSchema = z.object({
  projectId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(160).optional(),
  status: z.enum(briefStatusValues).optional(),
  responsesJson: z.unknown().optional(),
});

const briefSelect = {
  id: true,
  projectId: true,
  title: true,
  status: true,
  responsesJson: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      workspaceId: true,
      client: { select: { id: true, name: true, slug: true } },
      teamAssignments: { select: { teamId: true } },
    },
  },
} as const;

type BriefRow = Prisma.BriefGetPayload<{ select: typeof briefSelect }>;

function serializeBrief(brief: BriefRow, options: { includeResponsesJson?: boolean } = {}) {
  const base = {
    id: brief.id,
    projectId: brief.projectId,
    title: brief.title,
    status: brief.status,
    submittedAt: brief.submittedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
    project: {
      id: brief.project.id,
      name: brief.project.name,
      slug: brief.project.slug,
      status: brief.project.status,
      client: brief.project.client,
    },
  };

  if (options.includeResponsesJson) {
    return { ...base, responsesJson: brief.responsesJson };
  }

  return base;
}

function isBriefProjectIdUniqueViolation(error: unknown): boolean {
  if (!(error instanceof PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes("projectId");
  if (typeof target === "string") {
    return target === "Brief_projectId_key" || target.includes("projectId");
  }
  return false;
}

function submittedAtForStatus(status: (typeof briefStatusValues)[number]): Date | null {
  if (status === "SUBMITTED" || status === "IN_REVIEW" || status === "APPROVED") {
    return new Date();
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toBriefActorContextFromManager(auth);
    const searchParams = req.nextUrl.searchParams;
    const includeArchived = parseIncludeArchivedParam(searchParams);
    const projectId = searchParams.get("projectId")?.trim() || null;

    const briefs = await db.brief.findMany({
      where: buildAdminBriefListWhere(actor, { includeArchived, projectId }),
      orderBy: { updatedAt: "desc" },
      select: briefSelect,
    });

    return NextResponse.json({
      viewer: {
        workspaceRole: auth.workspaceRole,
        platformRole: auth.platformRole,
        teamId: auth.teamId,
      },
      briefs: briefs.map((brief) => serializeBrief(brief)),
    });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load briefs.");
    return NextResponse.json(body, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toBriefActorContextFromManager(auth);
    const body = createSchema.parse(await req.json());
    const status = body.status ?? "DRAFT";

    const project = await db.project.findFirst({
      where: {
        id: body.projectId,
        workspaceId: auth.workspaceId,
      },
      select: {
        id: true,
        workspaceId: true,
        status: true,
        teamAssignments: { select: { teamId: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found in this workspace." }, { status: 400 });
    }

    if (project.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot create a brief for an archived project." }, { status: 400 });
    }

    const assignedTeamIds = project.teamAssignments.map((a) => a.teamId);
    if (
      !canViewBriefForActor(actor, {
        id: project.id,
        workspaceId: project.workspaceId,
        status: project.status,
        assignedTeamIds,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const existing = await db.brief.findUnique({
      where: { projectId: body.projectId },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A brief already exists for this project." },
        { status: 409 }
      );
    }

    const created = await db.brief.create({
      data: {
        projectId: body.projectId,
        title: body.title ?? "Brief",
        status,
        responsesJson: body.responsesJson ?? undefined,
        submittedAt: submittedAtForStatus(status),
      },
      select: briefSelect,
    });

    return NextResponse.json({ brief: serializeBrief(created, { includeResponsesJson: false }) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid brief input." }, { status: 400 });
    }
    if (isBriefProjectIdUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A brief already exists for this project." },
        { status: 409 }
      );
    }
    const { status, body } = formatAdminRouteError(error, "Failed to create brief.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
