import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatAdminRouteError, requireWorkspaceMemberManagerContext } from "@/lib/adminAuth";
import {
  canAnalyzeBrief,
  canViewBriefForActor,
  toBriefActorContextFromManager,
} from "@/lib/briefAccess";
import {
  projectTeamAssignmentAccessSelect,
  toProjectAccessTargetFromAssignments,
} from "@/lib/projectAccess";
import { buildDeterministicBriefAnalysis } from "@/lib/briefAnalyze";
import {
  BRIEF_RAW_TEXT_MAX_LENGTH,
  mergeBriefDocument,
  parseBriefDocumentJson,
} from "@/lib/briefIntake";

const analyzeSchema = z.object({
  rawText: z.string().max(BRIEF_RAW_TEXT_MAX_LENGTH).optional(),
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

function serializeAnalyzedBrief(brief: {
  id: string;
  projectId: string;
  title: string;
  status: string;
  responsesJson: unknown;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const document = parseBriefDocumentJson(brief.responsesJson);
  return {
    id: brief.id,
    projectId: brief.projectId,
    title: brief.title,
    status: brief.status,
    responsesJson: document,
    submittedAt: brief.submittedAt?.toISOString() ?? null,
    createdAt: brief.createdAt.toISOString(),
    updatedAt: brief.updatedAt.toISOString(),
  };
}

export async function POST(
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

    const body = analyzeSchema.parse(await req.json().catch(() => ({})));

    const brief = await db.brief.findFirst({
      where: { id: briefId },
      select: {
        ...briefPatchSelect,
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

    if (!brief || brief.project.workspaceId !== auth.workspaceId) {
      return NextResponse.json({ error: "Brief not found." }, { status: 404 });
    }

    if (
      !canViewBriefForActor(actor, {
        id: brief.project.id,
        ...toProjectAccessTargetFromAssignments(brief.project, brief.project.teamAssignments),
      })
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (brief.project.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Cannot analyze a brief for an archived project." },
        { status: 400 }
      );
    }

    if (brief.status === "ARCHIVED") {
      return NextResponse.json({ error: "Cannot analyze an archived brief." }, { status: 400 });
    }

    if (!canAnalyzeBrief(brief.status, brief.project.status)) {
      return NextResponse.json(
        { error: "Brief can only be analyzed while it is in DRAFT status." },
        { status: 400 }
      );
    }

    const existingDocument = parseBriefDocumentJson(brief.responsesJson);
    const rawText = (body.rawText ?? existingDocument.source?.rawText ?? "").trim();
    if (!rawText) {
      return NextResponse.json(
        { error: "Save a raw client brief before running analysis." },
        { status: 400 }
      );
    }

    const analysis = buildDeterministicBriefAnalysis(rawText);
    const nextDocument = mergeBriefDocument(existingDocument, {
      analysis,
      ...(body.rawText !== undefined
        ? { source: { rawText, savedAt: new Date().toISOString() } }
        : {}),
    });

    const updated = await db.brief.update({
      where: { id: brief.id },
      data: { responsesJson: nextDocument },
      select: briefPatchSelect,
    });

    const document = parseBriefDocumentJson(updated.responsesJson);

    return NextResponse.json({
      brief: serializeAnalyzedBrief(updated),
      analysis: document.analysis ?? analysis,
      proposedFields: document.analysis?.proposedFields ?? analysis.proposedFields,
      issues: document.analysis?.issues ?? analysis.issues,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.issues[0]?.message ?? "Invalid brief analysis input.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const { status, body } = formatAdminRouteError(error, "Failed to analyze brief.");
    return NextResponse.json(body, { status: status === 500 ? 400 : status });
  }
}
