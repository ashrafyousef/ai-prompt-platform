import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canEditStrategyResponses,
  canMarkStrategyReady,
  canViewStrategyForActor,
  toStrategyActorContextFromManager,
} from "@/lib/strategyAccess";
import {
  projectTeamAssignmentAccessSelect,
  toProjectAccessTargetFromAssignments,
} from "@/lib/projectAccess";
import {
  hasStrategyContent,
  mergeStrategyDocument,
  parseStrategyDocumentJson,
  strategyDocumentPatchSchema,
} from "@/lib/strategyDocument";

const patchSchema = z
  .object({
    responsesJson: strategyDocumentPatchSchema.optional(),
    status: z.enum(["READY_FOR_CREATIVE"]).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.responsesJson === undefined && body.status === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "No changes provided." });
    }
  });

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

export async function PATCH(req: NextRequest, { params }: { params: { strategyId: string } }) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toStrategyActorContextFromManager(auth);
    const strategyId = params.strategyId?.trim();
    if (!strategyId) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());

    const strategy = await db.strategy.findFirst({
      where: { id: strategyId },
      select: {
        ...strategySelect,
        project: {
          select: {
            id: true,
            workspaceId: true,
            status: true,
            teamAssignments: { select: projectTeamAssignmentAccessSelect },
          },
        },
      },
    });

    if (!strategy || strategy.project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Strategy not found." }, { status: 404 });
    }

    if (
      !canViewStrategyForActor(actor, {
        id: strategy.project.id,
        ...toProjectAccessTargetFromAssignments(
          strategy.project,
          strategy.project.teamAssignments
        ),
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (strategy.project.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot update a strategy for an archived project." },
        { status: 400 }
      );
    }

    if (
      body.responsesJson !== undefined &&
      !canEditStrategyResponses(strategy.status, strategy.project.status)
    ) {
      return NextResponse.json(
        { error: "This strategy is no longer editable." },
        { status: 400 }
      );
    }

    if (
      body.status === "READY_FOR_CREATIVE" &&
      !canMarkStrategyReady(strategy.status, strategy.project.status)
    ) {
      return NextResponse.json(
        { error: "This strategy cannot be marked ready from its current state." },
        { status: 400 }
      );
    }

    const existingDocument = parseStrategyDocumentJson(strategy.responsesJson);
    const nextDocument =
      body.responsesJson !== undefined
        ? mergeStrategyDocument(existingDocument, body.responsesJson)
        : existingDocument;

    if (body.status === "READY_FOR_CREATIVE" && !hasStrategyContent(nextDocument)) {
      return NextResponse.json(
        { error: "Add at least one field before marking the strategy ready for creative." },
        { status: 400 }
      );
    }

    const updateData: {
      responsesJson?: typeof nextDocument;
      status?: "READY_FOR_CREATIVE";
      readyAt?: Date;
    } = {};

    if (body.responsesJson !== undefined) {
      updateData.responsesJson = nextDocument;
    }

    if (body.status === "READY_FOR_CREATIVE") {
      updateData.status = "READY_FOR_CREATIVE";
      updateData.readyAt = new Date();
    }

    const updated = await db.strategy.update({
      where: { id: strategy.id },
      data: updateData,
      select: strategySelect,
    });

    return NextResponse.json({ strategy: serializeStrategy(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Invalid strategy input.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to update strategy.");
    return NextResponse.json(body, { status });
  }
}
