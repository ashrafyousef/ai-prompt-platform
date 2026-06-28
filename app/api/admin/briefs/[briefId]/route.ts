import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import { canViewBriefForActor, toBriefActorContextFromManager } from "@/lib/briefAccess";
import {
  briefDocumentPatchSchema,
  hasBriefIntakeContent,
  mergeBriefDocument,
  parseBriefDocumentJson,
} from "@/lib/briefIntake";

const patchSchema = z
  .object({
    responsesJson: briefDocumentPatchSchema.optional(),
    status: z.enum(["SUBMITTED", "DRAFT", "APPROVED"]).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.responsesJson === undefined && body.status === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "No changes provided.",
      });
    }
  });

const briefPatchSelect = {
  id: true,
  projectId: true,
  title: true,
  status: true,
  responsesJson: true,
  submittedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function serializePatchedBrief(brief: {
  id: string;
  projectId: string;
  title: string;
  status: string;
  responsesJson: unknown;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: brief.id,
    projectId: brief.projectId,
    title: brief.title,
    status: brief.status,
    responsesJson: parseBriefDocumentJson(brief.responsesJson),
    submittedAt: brief.submittedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
  };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { briefId: string } }
) {
  try {
    const auth = await requireWorkspaceMemberManagerContext();
    const actor = toBriefActorContextFromManager(auth);
    const briefId = params.briefId?.trim();
    if (!briefId) {
      return NextResponse.json({ error: "Brief not found." }, { status: 404 });
    }

    const body = patchSchema.parse(await req.json());

    const brief = await db.brief.findFirst({
      where: { id: briefId },
      select: {
        ...briefPatchSelect,
        project: {
          select: {
            id: true,
            workspaceId: true,
            status: true,
            teamAssignments: { select: { teamId: true } },
          },
        },
      },
    });

    if (!brief || brief.project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Brief not found." }, { status: 404 });
    }

    const assignedTeamIds = brief.project.teamAssignments.map((assignment) => assignment.teamId);
    if (
      !canViewBriefForActor(actor, {
        id: brief.project.id,
        workspaceId: brief.project.workspaceId,
        status: brief.project.status,
        assignedTeamIds,
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (brief.project.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot update a brief for an archived project." },
        { status: 400 }
      );
    }

    if (brief.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot update an archived brief." }, { status: 400 });
    }

    if (body.responsesJson !== undefined && brief.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Brief responses can only be edited while the brief is in DRAFT status." },
        { status: 400 }
      );
    }

    if (body.status === "SUBMITTED" && brief.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Brief can only be submitted from DRAFT status." },
        { status: 400 }
      );
    }

    if (body.status === "DRAFT") {
      if (brief.status === "APPROVED") {
        return NextResponse.json(
          { error: "Approved briefs cannot be reopened." },
          { status: 400 }
        );
      }
      if (brief.status !== "SUBMITTED" && brief.status !== "IN_REVIEW") {
        return NextResponse.json(
          { error: "Brief can only be reopened from SUBMITTED or IN_REVIEW status." },
          { status: 400 }
        );
      }
    }

    if (body.status === "APPROVED") {
      if (brief.status === "DRAFT") {
        return NextResponse.json(
          { error: "Brief must be submitted before it can be approved." },
          { status: 400 }
        );
      }
      if (brief.status !== "SUBMITTED" && brief.status !== "IN_REVIEW") {
        return NextResponse.json(
          { error: "Brief can only be approved from SUBMITTED or IN_REVIEW status." },
          { status: 400 }
        );
      }
    }

    const existingDocument = parseBriefDocumentJson(brief.responsesJson);
    const nextDocument =
      body.responsesJson !== undefined
        ? mergeBriefDocument(existingDocument, body.responsesJson)
        : existingDocument;

    if (body.status === "SUBMITTED" && !hasBriefIntakeContent(nextDocument)) {
      return NextResponse.json(
        { error: "Add at least one intake field before submitting the brief." },
        { status: 400 }
      );
    }

    const updateData: {
      responsesJson?: typeof nextDocument;
      status?: "SUBMITTED" | "DRAFT" | "APPROVED";
      submittedAt?: Date;
    } = {};

    if (body.responsesJson !== undefined) {
      updateData.responsesJson = nextDocument;
    }

    if (body.status === "SUBMITTED") {
      updateData.status = "SUBMITTED";
      if (!brief.submittedAt) {
        updateData.submittedAt = new Date();
      }
    }

    if (body.status === "DRAFT") {
      updateData.status = "DRAFT";
    }

    if (body.status === "APPROVED") {
      updateData.status = "APPROVED";
    }

    const updated = await db.brief.update({
      where: { id: brief.id },
      data: updateData,
      select: briefPatchSelect,
    });

    return NextResponse.json({ brief: serializePatchedBrief(updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Invalid brief input.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to update brief.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
