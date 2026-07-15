import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logJson } from "@/lib/logger";
import { requireProjectActorContext } from "@/lib/projectActorContext";
import { buildProjectReadTargetWhere } from "@/lib/projectAccess";
import {
  projectReadSummarySelect,
  serializeProjectReadDetail,
  serializeProjectReadViewer,
} from "@/lib/projectReadModel";

export const dynamic = "force-dynamic";

const notFound = () =>
  NextResponse.json({ error: "Project not found." }, { status: 404 });

function formatProjectReadRouteError(error: unknown): {
  status: number;
  body: { error: string };
} {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") {
    return { status: 401, body: { error: "Unauthorized" } };
  }
  if (message === "Forbidden") {
    return { status: 403, body: { error: "Forbidden" } };
  }

  logJson("error", {
    source: "api.projects.[projectId]",
    message: "Failed to load project.",
    error: error instanceof Error ? error.message : String(error),
  });

  return { status: 500, body: { error: "Internal server error" } };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
) {
  try {
    const actor = await requireProjectActorContext();
    const projectId = params.projectId?.trim();
    if (!projectId) {
      return notFound();
    }

    const project = await db.project.findFirst({
      where: buildProjectReadTargetWhere(actor, projectId),
      select: projectReadSummarySelect,
    });

    if (!project) {
      return notFound();
    }

    return NextResponse.json({
      viewer: serializeProjectReadViewer(actor),
      project: serializeProjectReadDetail(project),
    });
  } catch (error) {
    const { status, body } = formatProjectReadRouteError(error);
    return NextResponse.json(body, { status });
  }
}
