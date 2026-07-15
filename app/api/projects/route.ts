import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logJson } from "@/lib/logger";
import { requireProjectActorContext } from "@/lib/projectActorContext";
import { buildProjectReadListWhere } from "@/lib/projectAccess";
import {
  projectReadSummarySelect,
  serializeProjectReadSummary,
  serializeProjectReadViewer,
} from "@/lib/projectReadModel";

export const dynamic = "force-dynamic";

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
    source: "api.projects",
    message: "Failed to load projects.",
    error: error instanceof Error ? error.message : String(error),
  });

  return { status: 500, body: { error: "Internal server error" } };
}

export async function GET() {
  try {
    const actor = await requireProjectActorContext();

    const projects = await db.project.findMany({
      where: buildProjectReadListWhere(actor),
      orderBy: { updatedAt: "desc" },
      select: projectReadSummarySelect,
    });

    return NextResponse.json({
      viewer: serializeProjectReadViewer(actor),
      projects: projects.map(serializeProjectReadSummary),
    });
  } catch (error) {
    const { status, body } = formatProjectReadRouteError(error);
    return NextResponse.json(body, { status });
  }
}
