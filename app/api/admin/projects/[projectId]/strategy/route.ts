import { NextResponse } from "next/server";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canViewStrategyForActor,
  toStrategyActorContextFromManager,
} from "@/lib/strategyAccess";
import { parseBriefDocumentJson } from "@/lib/briefIntake";
import {
  buildPrefilledStrategyDocument,
  parseStrategyDocumentJson,
} from "@/lib/strategyDocument";

const strategySelect = {
  id: true,
  projectId: true,
  sourceBriefId: true,
  status: true,
  responsesJson: true,
  readyAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isStrategyProjectIdUniqueViolation(error: unknown): boolean {
  if (!(error instanceof PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.includes("projectId");
  if (typeof target === "string") {
    return target === "Strategy_projectId_key" || target.includes("projectId");
  }
  return false;
}

function serializeStrategy(strategy: {
  id: string;
  projectId: string;
  sourceBriefId: string;
  status: string;
  responsesJson: unknown;
  readyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: strategy.id,
    projectId: strategy.projectId,
    sourceBriefId: strategy.sourceBriefId,
    status: strategy.status,
    responsesJson: parseStrategyDocumentJson(strategy.responsesJson),
    readyAt: strategy.readyAt?.toISOString() ?? null,
    createdAt: strategy.createdAt.toISOString(),
    updatedAt: strategy.updatedAt.toISOString(),
  };
}

async function loadProjectForActor(
  projectId: string,
  auth: Awaited<ReturnType<typeof requireWorkspaceMemberManagerContext>>
) {
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId: auth.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
      teamAssignments: { select: { teamId: true } },
      brief: { select: { id: true, status: true, responsesJson: true } },
    },
  });
  return project;
}

export async function GET(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toStrategyActorContextFromManager(auth);
    const project = await loadProjectForActor(params.projectId, auth);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const assignedTeamIds = project.teamAssignments.map((a) => a.teamId);
    if (
      !canViewStrategyForActor(actor, {
        id: project.id,
        workspaceId: project.workspaceId,
        status: project.status,
        assignedTeamIds,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const strategy = await db.strategy.findUnique({
      where: { projectId: project.id },
      select: strategySelect,
    });

    if (!strategy) {
      return NextResponse.json({ error: "No strategy exists for this project." }, { status: 404 });
    }

    return NextResponse.json({ strategy: serializeStrategy(strategy) });
  } catch (error) {
    const { status, body } = formatAdminRouteError(error, "Failed to load strategy.");
    return NextResponse.json(body, { status });
  }
}

export async function POST(_req: Request, { params }: { params: { projectId: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toStrategyActorContextFromManager(auth);
    const project = await loadProjectForActor(params.projectId, auth);

    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const assignedTeamIds = project.teamAssignments.map((a) => a.teamId);
    if (
      !canViewStrategyForActor(actor, {
        id: project.id,
        workspaceId: project.workspaceId,
        status: project.status,
        assignedTeamIds,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (project.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot create a strategy for an archived project." },
        { status: 400 }
      );
    }

    if (!project.brief || project.brief.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Strategy can only be created once the project's brief is approved." },
        { status: 400 }
      );
    }

    const existing = await db.strategy.findUnique({
      where: { projectId: project.id },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "A strategy already exists for this project." },
        { status: 409 }
      );
    }

    const briefDocument = parseBriefDocumentJson(project.brief.responsesJson);
    const prefilled = buildPrefilledStrategyDocument(briefDocument);

    const created = await db.strategy.create({
      data: {
        projectId: project.id,
        sourceBriefId: project.brief.id,
        status: "DRAFT",
        responsesJson: prefilled,
      },
      select: strategySelect,
    });

    return NextResponse.json({ strategy: serializeStrategy(created) });
  } catch (error) {
    if (isStrategyProjectIdUniqueViolation(error)) {
      return NextResponse.json(
        { error: "A strategy already exists for this project." },
        { status: 409 }
      );
    }
    const { status, body } = formatAdminRouteError(error, "Failed to create strategy.");
    return NextResponse.json(body, { status });
  }
}
